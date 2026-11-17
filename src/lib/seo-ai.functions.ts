import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { SEO_AI_DAILY_LIMIT } from '../cms/seo-ai.ts';

type Field = 'title' | 'description' | 'keywords';
const RULES: Record<Field, string> = {
  title: 'Write one SEO meta title of 41-60 characters.',
  description: 'Write one SEO meta description of 126-155 characters, inviting to click.',
  keywords: 'Write 5-10 relevant SEO keywords, comma separated.',
};

/** Generates a meta title/description/keywords suggestion; limited per user per day. */
export const generateSeo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { field: Field; path: string; lang: string; name: string; text: string }) => {
    if (!(d.field in RULES)) throw new Error('Ongeldig veld.');
    return { field: d.field, path: String(d.path).slice(0, 200), lang: d.lang === 'en' ? 'English' : 'Dutch', name: String(d.name).slice(0, 200), text: String(d.text).slice(0, 4000) };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [{ data: ok }, { data: adm }, { data: s }] = await Promise.all([
      sb.rpc('can_edit', { _user_id: context.userId }),
      sb.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
      sb.from('site_settings').select('seo_ai_enabled, project_name').eq('id', 1).maybeSingle(),
    ]);
    if (!ok) throw new Error('Geen rechten.');
    if (!adm && !s?.seo_ai_enabled) throw new Error('De SEO-assistent staat uit.');
    const since = new Date(Date.now() - 864e5).toISOString();
    const { count } = await sb.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', context.userId).eq('feature', 'seo').gte('created_at', since);
    if ((count ?? 0) >= SEO_AI_DAILY_LIMIT) throw new Error(`Daglimiet bereikt (${SEO_AI_DAILY_LIMIT} suggesties per 24 uur).`);
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error('AI-dienst niet beschikbaar.');
    const { error: logErr } = await sb.from('ai_usage').insert({ user_id: context.userId, feature: 'seo' });
    if (logErr) throw new Error('Kon gebruik niet registreren.');
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: `You are an SEO copywriter for the website "${s?.project_name ?? ''}". ${RULES[data.field]} Write in ${data.lang}. Reply with only the text, no quotes.` },
          { role: 'user', content: `Page name: ${data.name}\nURL: ${data.path}\nPage text:\n${data.text}` },
        ],
      }),
    });
    if (res.status === 429) throw new Error('AI tijdelijk te druk, probeer het zo opnieuw.');
    if (res.status === 402) throw new Error('AI-tegoed is op.');
    if (!res.ok) throw new Error('Genereren mislukt.');
    const json = await res.json() as { choices: { message: { content: string } }[] };
    return { text: (json.choices[0]?.message.content ?? '').trim().replace(/^["']|["']$/g, ''), remaining: SEO_AI_DAILY_LIMIT - (count ?? 0) - 1 };
  });
