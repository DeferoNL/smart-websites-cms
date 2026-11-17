import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { sitePages } from '@/site/cms-adapter';
import { BLOCK_CATEGORIES, categoryLabel, indexSite } from './block-index.ts';
import DOMPurify from 'dompurify';
import { safeBackground } from './block-background.ts';

type Row = { id: string; name: string; category: string; hidden: boolean; source: string };

/** Settings section: index the site's blocks into the library and manage them. */
export function BlockLibraryAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => void supabase.from('block_templates').select('id, name, category, hidden, source').order('category').order('name').then(({ data }) => setRows((data ?? []) as Row[])), []);
  useEffect(() => { load(); }, [load]);

  const runIndex = async () => {
    setBusy(true);
    // Match the real page's CSS without executing forms/scripts or displaying a second page.
    const computed = new Map<string, { background: string; color: string }[]>();
    for (const [path, page] of Object.entries(sitePages)) {
      const host = document.createElement('div');
      host.inert = true; host.style.cssText = 'position:fixed;left:-100000px;width:1280px;visibility:hidden;pointer-events:none';
      host.innerHTML = DOMPurify.sanitize(page.html, { FORBID_TAGS: ['script', 'iframe', 'style', 'link'] });
      document.body.appendChild(host);
      const sections = Array.from(host.querySelectorAll<HTMLElement>('div.page > section')).filter(el => !el.querySelector('header,nav,footer') && !/\bblock-(121|47|48|55)-\d+\b/.test(el.className));
      computed.set(path, sections.map(el => { const css = getComputedStyle(el); return { background: css.backgroundColor, color: css.color }; }));
      host.remove();
    }
    const blocks = indexSite(sitePages, (path, _section, i) => {
      const appearance = computed.get(path)?.[i];
      if (!appearance) return undefined;
      // Computed rgb values are browser-generated, never arbitrary stylesheet declarations.
      const bg = appearance.background.replace(/^rgb\((.*)\)$/, 'rgba($1, 1)');
      return safeBackground(bg) ? { background: bg, color: appearance.color } : undefined;
    });
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('block_templates')
      .upsert(blocks.map(b => ({ ...b, source: 'index', created_by: u.user?.id ?? null })), { onConflict: 'fingerprint', ignoreDuplicates: true })
      .select('id');
    setBusy(false);
    if (error) { toast.error('Indexeren mislukt: ' + error.message); return; }
    const added = data?.length ?? 0;
    toast.success(`${added} nieuwe blokken toegevoegd, ${blocks.length - added} al aanwezig.`);
    void supabase.rpc('log_audit', { _action: 'Blokken geïndexeerd', _target: `${added} nieuw` });
    load();
  };
  const update = async (id: string, patch: Partial<Row>) => {
    const { error } = await supabase.from('block_templates').update(patch).eq('id', id);
    if (error) toast.error(error.message); else setRows(r => r?.map(x => (x.id === id ? { ...x, ...patch } : x)) ?? null);
  };
  const remove = async (r: Row) => {
    if (!window.confirm(`"${r.name}" uit de bibliotheek verwijderen? Bij opnieuw indexeren komt een websiteblok terug.`)) return;
    const { error } = await supabase.from('block_templates').delete().eq('id', r.id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Blokkenbibliotheek</h3>
          <p className="text-xs text-muted-foreground">Zoekt alle blokken op de website en zet nieuwe unieke blokken in de juiste categorie. Header, menu en footer worden overgeslagen.</p>
        </div>
        <Button disabled={busy} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => void runIndex()}>{busy ? 'Bezig…' : 'Blokken indexeren'}</Button>
      </div>
      {!rows ? <p>Laden…</p> : !rows.length ? <p className="text-sm text-muted-foreground">Nog geen blokken. Klik op "Blokken indexeren".</p> : (
        <ul className="divide-y divide-border">
          {rows.map(r => (
            <li key={r.id} className={`flex items-center gap-2 py-2 ${r.hidden ? 'opacity-50' : ''}`}>
              <Input className="h-8 flex-1" defaultValue={r.name} onBlur={e => { const v = e.target.value.trim(); if (v && v !== r.name) void update(r.id, { name: v }); }} />
              <select aria-label="Categorie" className="h-8 rounded-md border border-border bg-muted text-sm" value={r.category} onChange={e => void update(r.id, { category: e.target.value })}>
                {BLOCK_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <Button size="sm" variant="ghost" title={r.hidden ? 'Tonen' : 'Verbergen'} onClick={() => void update(r.id, { hidden: !r.hidden })}>{r.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
              <Button size="sm" variant="ghost" title="Verwijderen" onClick={() => void remove(r)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      {rows && <p className="text-xs text-muted-foreground">{rows.length} blokken in {new Set(rows.map(r => r.category)).size} categorieën ({[...new Set(rows.map(r => categoryLabel(r.category)))].join(', ')}).</p>}
    </div>
  );
}
