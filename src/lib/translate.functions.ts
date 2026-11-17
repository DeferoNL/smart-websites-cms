import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { CmsContent } from '../cms/content.ts';
import type { BlockItem, Layout } from '../cms/blocks.ts';

const LANG_NAMES: Record<string, string> = { nl: 'Dutch', en: 'English', de: 'German', fr: 'French' };

async function translateAll(texts: string[], from: string, to: string): Promise<string[]> {
  if (!texts.length) return [];
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error('Vertaaldienst niet beschikbaar.');
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      reasoning_effort: 'low',
      response_format: { type: 'json_schema', json_schema: { name: 'translations', strict: true, schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'string' } } }, required: ['items'], additionalProperties: false } } },
      messages: [
        { role: 'system', content: `Translate website copy from ${LANG_NAMES[from] ?? from} to ${LANG_NAMES[to] ?? to}. Keep all HTML tags and attributes exactly. Return JSON {"items": [...]} with the translations in the same order and count as the input array.` },
        { role: 'user', content: JSON.stringify(texts) },
      ],
    }),
  });
  if (res.status === 429) throw new Error('Vertalen tijdelijk te druk, probeer het zo opnieuw.');
  if (res.status === 402) throw new Error('Vertaaltegoed is op.');
  if (!res.ok) throw new Error('Vertalen mislukt.');
  const json = await res.json() as { choices: { message: { content: string } }[] };
  const arr = (JSON.parse(json.choices[0]?.message.content ?? '{}') as { items?: unknown }).items;
  if (!Array.isArray(arr) || arr.length !== texts.length) throw new Error('Vertalen gaf een onverwacht antwoord.');
  return arr.map(String);
}

/** After publishing a page in the default language, translate its edits into the other site languages. */
export const translatePublished = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => ({ path: String(d.path) }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: ok } = await sb.rpc('can_edit', { _user_id: context.userId });
    if (!ok) throw new Error('Geen rechten.');
    const { data: s } = await sb.from('site_settings').select('*').eq('id', 1).maybeSingle();
    const { langOf, counterpart, transferable, mapHref } = await import('../cms/translate-map.ts');
    const { data: cps } = await sb.from('custom_pages').select('path, source_path, pair_path');
    const custom = { pairs: {} as Record<string, string>, sources: {} as Record<string, string> };
    for (const c of cps ?? []) { custom.sources[c.path] = c.source_path; if (c.pair_path) { custom.pairs[c.path] = c.pair_path; custom.pairs[c.pair_path] = c.path; } }
    const from = langOf(data.path);
    if (!s?.auto_translate || from !== s.default_lang) return { translated: [] as string[] };
    const { data: src } = await sb.from('page_content').select('data, layout').eq('path', data.path).eq('state', 'published').maybeSingle();
    const source = (src?.data ?? {}) as CmsContent;
    const done: string[] = [];
    for (const to of s.languages.filter(l => l !== from)) {
      const target = counterpart(data.path, to, custom);
      if (!target) continue;
      const carry = transferable(source, data.path, target, custom);
      for (const [id, o] of Object.entries(source)) if (id.includes(':')) carry[id] = o;
      const ids = Object.keys(carry);
      const { data: cur } = await sb.from('page_content').select('data, layout').eq('path', target).eq('state', 'published').maybeSingle();
      // Copy the block layout; copied blocks get their markup translated (reused when unchanged).
      let layout: Layout | null | undefined = undefined;
      if (src?.layout) {
        const prev = new Map(((cur?.layout ?? []) as Layout).filter((b): b is Extract<BlockItem, { i: string }> => 'i' in b).map(b => [b.i, b]));
        const items = src.layout as unknown as Layout;
        const todo = items.filter((b): b is Extract<BlockItem, { i: string }> => 'i' in b && prev.get(b.i)?.v !== b.v);
        const translated = await translateAll(todo.map(b => b.html), from, to);
        const map = new Map(todo.map((b, k) => [b.i, translated[k]!]));
        layout = items.map(b => 'o' in b ? b : { ...b, html: map.get(b.i) ?? prev.get(b.i)?.html ?? b.html });
      }
      if (!ids.length && layout === undefined) continue;
      const texts: string[] = []; const slots: [string, 'html' | 'alt'][] = [];
      for (const id of ids) {
        const o = carry[id]!;
        if (o.html) { texts.push(o.html); slots.push([id, 'html']); }
        if (o.alt) { texts.push(o.alt); slots.push([id, 'alt']); }
      }
      const out = await translateAll(texts, from, to);
      const patch: CmsContent = {};
      for (const id of ids) { const o = { ...carry[id]! }; if (o.href) o.href = mapHref(o.href, to, custom); patch[id] = o; }
      slots.forEach(([id, f], i) => { patch[id]![f] = out[i]!; });
      const merged = { ...((cur?.data ?? {}) as CmsContent), ...patch };
      const now = new Date().toISOString();
      const { error } = await sb.from('page_content').upsert([
        { path: target, state: 'draft', data: merged, updated_by: context.userId, updated_at: now, ...(layout !== undefined ? { layout: layout as never } : {}) },
        { path: target, state: 'published', data: merged, updated_by: context.userId, updated_at: now, ...(layout !== undefined ? { layout: layout as never } : {}) },
      ]);
      if (error) throw new Error(error.message);
      done.push(target);
    }
    return { translated: done };
  });
