import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { TEXT_AI_DAILY_LIMIT } from '../cms/seo-ai.ts';

export type TextAction = 'rewrite' | 'shorten' | 'improve' | 'spelling';
const RULES: Record<TextAction, string> = {
  rewrite: 'Rewrite the text with different wording, same meaning and roughly the same length.',
  shorten: 'Make the text clearly shorter (about half), keeping the key message.',
  improve: 'Improve the text: clearer, more engaging and professional, same meaning and similar length.',
  spelling: 'Only correct spelling, grammar and punctuation. Change nothing else.',
};

/** Rewrites, shortens, improves or spell-checks one text block; limited per user per day. */
export const assistText = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { action: TextAction; html: string }) => {
    if (!(d.action in RULES)) throw new Error('Ongeldige actie.');
    const html = String(d.html ?? '').slice(0, 6000);
    if (!html.trim()) throw new Error('Geen tekst.');
    return { action: d.action, html };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [{ data: ok }, { data: adm }, { data: s }] = await Promise.all([
      sb.rpc('can_edit', { _user_id: context.userId }),
      sb.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
      sb.from('site_settings').select('seo_ai_enabled').eq('id', 1).maybeSingle(),
    ]);
    if (!ok) throw new Error('Geen rechten.');
    if (!adm && !s?.seo_ai_enabled) throw new Error('De AI-assistent staat uit.');
    const since = new Date(Date.now() - 864e5).toISOString();
    const { count } = await sb.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', context.userId).eq('feature', 'text').gte('created_at', since);
    if ((count ?? 0) >= TEXT_AI_DAILY_LIMIT) throw new Error(`Daglimiet bereikt (${TEXT_AI_DAILY_LIMIT} keer per 24 uur).`);
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error('AI-dienst niet beschikbaar.');
    const { error: logErr } = await sb.from('ai_usage').insert({ user_id: context.userId, feature: 'text' });
    if (logErr) throw new Error('Kon gebruik niet registreren.');
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: `You edit website copy. ${RULES[data.action]} Keep the same language as the input. The input is an HTML fragment: keep its simple tags (p, br, strong, em, a with href, ul, ol, li) and links. Reply with only the resulting HTML fragment, no code fences, no explanations.` },
          { role: 'user', content: data.html },
        ],
      }),
    });
    if (res.status === 429) throw new Error('AI tijdelijk te druk, probeer het zo opnieuw.');
    if (res.status === 402) throw new Error('AI-tegoed is op.');
    if (!res.ok) throw new Error('AI-hulp mislukt.');
    const json = await res.json() as { choices: { message: { content: string } }[] };
    const html = (json.choices[0]?.message.content ?? '').trim().replace(/^```(?:html)?\s*|\s*```$/g, '');
    return { html, remaining: TEXT_AI_DAILY_LIMIT - (count ?? 0) - 1 };
  });
