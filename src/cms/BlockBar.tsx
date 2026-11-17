import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Palette, Plus, Star, Trash2 } from 'lucide-react';
import { BlockBackgroundDialog } from './BlockBackgroundDialog.tsx';
import type { BlockAppearance } from './block-background.ts';
import { colorInputValue } from './content.ts';
import { STARTER_BLOCKS } from './starter-blocks.ts';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { BLOCK_CATEGORIES, categorize, categoryLabel } from './block-index.ts';
import { ANNOUNCEMENT_COLORS, announcementHtml, blockKey, ensureContainer, hashHtml, isDeleteConfirmed, type Layout } from './blocks.ts';

const GREEN = 'rounded-full bg-success px-4 text-success-foreground hover:bg-success/90';

function RemoveDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const [word, setWord] = useState('');
  useEffect(() => { if (open) setWord(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Blok verwijderen?</DialogTitle></DialogHeader>
        <p className="text-sm">Weet je zeker dat je dit blok wilt verwijderen? Dit kan niet ongedaan worden gemaakt. Staat het blok niet in de blokkenbibliotheek, dan kun je het niet opnieuw toevoegen.</p>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (isDeleteConfirmed(word)) onConfirm(); }}>
          <Input autoFocus placeholder="Typ: verwijderen" value={word} onChange={e => setWord(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>Annuleren</Button>
            <Button type="submit" variant="destructive" disabled={!isDeleteConfirmed(word)}>Verwijderen</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Template = { id: string; name: string; html: string; category: string };

/** Hover toolbar for page sections: move, copy, save to library, remove, insert from library. */
export function BlockBar({ layout, onMove, onCopy, onRemove, onInsert, onToggle, onBackground, getHtml }: {
  layout: Layout;
  onMove: (index: number, dir: -1 | 1) => void;
  onCopy: (index: number) => void;
  onRemove: (index: number) => void;
  onInsert: (index: number, html: string) => void;
  onToggle: (index: number) => void;
  onBackground: (index: number, appearance?: BlockAppearance) => void;
  getHtml: (index: number) => string;
}) {
  const [hover, setHover] = useState<{ key: string; rect: DOMRect } | null>(null);
  const [libraryAt, setLibraryAt] = useState<number | null>(null);
  const [saveIndex, setSaveIndex] = useState<number | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [background, setBackground] = useState<{ index: number; background: string; contrast: boolean; accent?: string | undefined } | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const loadSaved = useCallback(() => void supabase.from('block_templates').select('html').then(({ data }) => setSaved(new Set((data ?? []).map(t => hashHtml(t.html))))), []);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  useEffect(() => {
    let current: HTMLElement | null = null;
    const update = () => { const key = current?.dataset['cmsBlock']; if (current?.isConnected && key) setHover({ key, rect: current.getBoundingClientRect() }); else setHover(null); };
    const onMoveMouse = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-cms-toolbar], [data-cms-blockbar], [role="dialog"]')) return;
      const el = t.closest<HTMLElement>('[data-cms-block]');
      if (el !== current) { current = el; update(); }
    };
    document.addEventListener('mousemove', onMoveMouse);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { document.removeEventListener('mousemove', onMoveMouse); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, []);
  // After a move the block re-renders elsewhere; re-measure it.
  useEffect(() => {
    if (!hover) return;
    const id = setTimeout(() => { const el = document.querySelector<HTMLElement>(`[data-cms-block="${hover.key}"]`); setHover(el ? { key: hover.key, rect: el.getBoundingClientRect() } : null); }, 50);
    return () => clearTimeout(id);
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps

  const index = hover ? layout.findIndex(b => blockKey(b) === hover.key) : -1;
  const isSaved = index >= 0 && saved.has(hashHtml(getHtml(index)));
  return (
    <>
      {layout.length === 0 && (
        <div data-cms-blockbar className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 2147483646 }}>
          <button type="button" onClick={() => setLibraryAt(0)}
            style={{ background: 'var(--success)', color: 'var(--success-foreground)', borderRadius: 9999, padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, boxShadow: '0 6px 18px rgba(0,0,0,.25)', cursor: 'pointer' }}>
            <Plus className="h-5 w-5" />Eerste blok toevoegen
          </button>
        </div>
      )}
      {hover && index >= 0 && (
        <>
          <div aria-hidden className="pointer-events-none fixed z-[2147482990] rounded-md border-2 border-primary" style={{ top: hover.rect.top, left: hover.rect.left, width: hover.rect.width, height: hover.rect.height }} />
          <div data-cms-blockbar className="fixed z-[2147483000] flex gap-1 rounded-md border border-border bg-background p-1 text-foreground shadow-lg" style={{ top: Math.max(hover.rect.top + 8, 8), left: Math.max(hover.rect.right - 380, 8) }}>
            <Button size="sm" variant="ghost" title="Omhoog" disabled={index === 0} onClick={() => onMove(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" title="Omlaag" disabled={index === layout.length - 1} onClick={() => onMove(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" title="Dupliceren" onClick={() => onCopy(index)}><Copy className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" title="Achtergrond" aria-label="Achtergrond" onClick={() => {
              const el = document.querySelector<HTMLElement>(`[data-cms-block="${hover.key}"]`);
              if (!el) return;
              const button = el.querySelector<HTMLElement>('[class*="button-"]') ?? document.querySelector<HTMLElement>('.page [class*="button-"]');
              setBackground({ index, background: getComputedStyle(el).backgroundColor, contrast: el.hasAttribute('data-cms-block-contrast'), accent: button ? colorInputValue(getComputedStyle(button).backgroundColor) : undefined });
            }}><Palette className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" title={isSaved ? 'Staat in de blokkenbibliotheek' : 'Bewaren in blokkenbibliotheek'} onClick={() => setSaveIndex(index)}>
              <Star className={isSaved ? 'h-4 w-4 fill-primary text-primary' : 'h-4 w-4'} />
            </Button>
            <Button size="sm" variant="ghost" title="Blok hieronder invoegen" onClick={() => setLibraryAt(index + 1)}><Plus className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" title={layout[index]?.off ? 'Blok weer inschakelen' : 'Blok tijdelijk uitschakelen'} aria-label={layout[index]?.off ? 'Blok weer inschakelen' : 'Blok tijdelijk uitschakelen'} onClick={() => onToggle(index)}>
              {layout[index]?.off ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" title="Verwijderen" onClick={() => setRemoveIndex(index)}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div data-cms-blockbar className="fixed -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 2147483646, top: Math.min(hover.rect.bottom, window.innerHeight - 20), left: hover.rect.left + hover.rect.width / 2 }}>
            <button type="button" onClick={() => setLibraryAt(index + 1)}
              style={{ background: 'var(--success)', color: 'var(--success-foreground)', border: '1px solid var(--success-foreground)', borderRadius: 9999, padding: '6px 18px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, lineHeight: 1.2, boxShadow: '0 6px 18px rgba(0,0,0,.25)', cursor: 'pointer', position: 'relative' }}>
              <Plus className="h-4 w-4" />Blok toevoegen
            </button>
          </div>
        </>
      )}
      <SaveTemplateDialog index={saveIndex} getHtml={getHtml} onClose={() => setSaveIndex(null)} onSaved={loadSaved} />
      {background && <BlockBackgroundDialog initial={background} accent={background.accent} onChange={appearance => onBackground(background.index, appearance)} onClose={() => setBackground(null)} />}
      <RemoveDialog open={removeIndex !== null} onClose={() => setRemoveIndex(null)} onConfirm={() => { if (removeIndex !== null) onRemove(removeIndex); setRemoveIndex(null); }} />
      <LibraryDialog at={libraryAt} onClose={() => setLibraryAt(null)} onChanged={loadSaved} onPick={html => { if (libraryAt !== null) onInsert(libraryAt, ensureContainer(html)); setLibraryAt(null); }} />
    </>
  );
}

function SaveTemplateDialog({ index, getHtml, onClose, onSaved }: { index: number | null; getHtml: (i: number) => string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState('overig');
  useEffect(() => { if (index !== null) setCat(categorize(getHtml(index))); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (index === null) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('block_templates').insert({ name: name.trim(), html: getHtml(index), category: cat, created_by: u.user?.id ?? null });
    if (error) { toast.error('Opslaan mislukt: ' + error.message); return; }
    toast.success('Blok bewaard in de bibliotheek.'); setName(''); onSaved(); onClose();
  };
  return (
    <Dialog open={index !== null} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Blok bewaren in bibliotheek</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}>
          <Input required placeholder="Naam, bijv. Foto links + tekst rechts" value={name} onChange={e => setName(e.target.value)} />
          <select aria-label="Categorie" className="h-10 w-full rounded-md border border-border bg-muted text-sm" value={cat} onChange={e => setCat(e.target.value)}>
            {BLOCK_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose}>Annuleren</Button><Button type="submit" className="bg-success text-success-foreground hover:bg-success/90">Opslaan</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LibraryDialog({ at, onClose, onPick, onChanged }: { at: number | null; onClose: () => void; onPick: (html: string) => void; onChanged: () => void }) {
  const [items, setItems] = useState<Template[] | null>(null);
  const [color, setColor] = useState<keyof typeof ANNOUNCEMENT_COLORS>('Rood');
  const [tab, setTab] = useState('alle');
  const [q, setQ] = useState('');
  const load = () => void supabase.from('block_templates').select('id, name, html, category').eq('hidden', false).order('sort_order').order('created_at', { ascending: false }).then(({ data }) => setItems(data ?? []));
  // Website-own blocks come first; a standard block is only offered when the site has none of its kind.
  const all = items ? [...items, ...STARTER_BLOCKS.filter(b => !items.some(t => t.category === b.category)).map(b => ({ ...b, id: 'std:' + b.id }))] : null;
  const cats = BLOCK_CATEGORIES.filter(([k]) => all?.some(t => t.category === k));
  const shown = (all ?? []).filter(t => (tab === 'alle' || t.category === tab) && t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const showAnnouncement = (tab === 'alle' || tab === 'content') && 'mededeling'.includes(q.trim().toLowerCase());
  useEffect(() => { if (at !== null) load(); }, [at]);
  const remove = async (t: Template) => {
    if (!window.confirm(`"${t.name}" uit de bibliotheek verwijderen?`)) return;
    const { error } = await supabase.from('block_templates').delete().eq('id', t.id);
    if (error) toast.error(error.message); else { load(); onChanged(); }
  };
  return (
    <Dialog open={at !== null} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader><DialogTitle>Blokkenbibliotheek</DialogTitle></DialogHeader>
        {items && (
          <div className="space-y-3">
            <Input placeholder="Zoek een blok…" value={q} onChange={e => setQ(e.target.value)} />
            <div data-cms-library-tabs className="flex flex-wrap gap-3" role="group" aria-label="Blokcategorieën">
              {[['alle', 'Alle'] as const, ...cats].map(([k, l]) => (
                <Button key={k} type="button" size="sm" variant={tab === k ? 'brand' : 'secondary'} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</Button>
              ))}
            </div>
          </div>
        )}
        {!items ? <p>Laden…</p> : (
          <div className="grid max-h-[70vh] gap-4 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
            {showAnnouncement && <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <Thumb html={announcementHtml(ANNOUNCEMENT_COLORS[color])} />
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate font-medium">Mededeling <span className="text-xs text-muted-foreground">(standaard)</span></span>
                <Button size="sm" className={GREEN} onClick={() => onPick(announcementHtml(ANNOUNCEMENT_COLORS[color]))}>Invoegen</Button>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Kleur">
                {(Object.keys(ANNOUNCEMENT_COLORS) as (keyof typeof ANNOUNCEMENT_COLORS)[]).map(k => (
                  <button key={k} type="button" title={k} aria-pressed={color === k} onClick={() => setColor(k)}
                    className={`h-6 w-6 rounded-full border-2 ${color === k ? 'border-primary' : 'border-border'}`} style={{ background: ANNOUNCEMENT_COLORS[k] }} />
                ))}
              </div>
            </div>}
            {shown.map(t => (
              <div key={t.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <Thumb html={t.html} />
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate font-medium" title={t.name}>{t.name} <span className="text-xs text-muted-foreground">({t.id.startsWith('std:') ? 'standaard' : categoryLabel(t.category)})</span></span>
                  {!t.id.startsWith('std:') && <Button size="sm" variant="ghost" title="Weggooien" onClick={() => void remove(t)}><Trash2 className="h-4 w-4" /></Button>}
                  <Button size="sm" className={GREEN} onClick={() => onPick(t.html)}>Invoegen</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Miniature of a block: real site markup rendered at 25% scale, not interactive. */
function Thumb({ html }: { html: string }) {
  return (
    <div className="pointer-events-none relative h-44 overflow-hidden rounded border border-border bg-background" aria-hidden>
      <div className="absolute left-0 top-0 w-[400%] origin-top-left scale-[0.25]" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
    </div>
  );
}
