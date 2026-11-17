import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Folder, Image as ImageIcon, Plus, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { Checkbox } from '../components/ui/checkbox.tsx';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import iconLibrary from './icon-library.json';
import { siteMedia } from './site-media.ts';
import { cn } from '../lib/utils.ts';
import { belongsToMediaFolder, mediaFolderName, type MediaFolderKey } from './media-folders.ts';
import { coloredIconUrl, DEFAULT_ICON_COLOR, ICON_COLORS, isIconColor } from './icon-colors.ts';
import { enableCmsMediaPreview } from '../lib/media.functions.ts';

type Item = { key: string; id?: string; storagePath?: string; svg?: string; url: string; name: string; alt: string; folder: 'site' | 'icons' | 'uploads'; kind: 'image' | 'video'; type: string; size?: number | undefined; folderId?: string | null };
type FolderKey = MediaFolderKey;
const ICONS: Item[] = (iconLibrary as { name: string; svg: string }[]).map(ic => ({
  key: `lib:${ic.name}`, svg: ic.svg, url: coloredIconUrl(ic.svg, DEFAULT_ICON_COLOR), name: `${ic.name}.svg`, alt: '', folder: 'icons', kind: 'image', type: 'SVG',
}));

const QUALITY = [{ l: 'Laag', v: 60 }, { l: 'Gemiddeld', v: 75 }, { l: 'Hoog', v: 85 }, { l: 'Max', v: 100 }];
const SIZES = [{ l: '1280 px', v: 1280 }, { l: '1920 px', v: 1920 }, { l: '2560 px', v: 2560 }, { l: 'Geen resize', v: 0 }];

export const kb = (n?: number) => (n == null ? '–' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} kB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Converts an image to WebP in the browser; returns null when not convertible or not smaller. */
export async function toWebp(file: File, quality: number, maxSide: number): Promise<Blob | null> {
  if (!/^image\/(png|jpeg|webp|bmp)$/.test(file.type)) return null;
  const bmp = await createImageBitmap(file);
  const scale = maxSide ? Math.min(1, maxSide / Math.max(bmp.width, bmp.height)) : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/webp', quality / 100));
  return blob && blob.type === 'image/webp' && blob.size < file.size ? blob : null;
}

export function MediaManager({ open, onClose, initialAlt = '', accept = 'image', onInsert }: {
  open: boolean; onClose: () => void; initialAlt?: string; accept?: 'image' | 'any';
  onInsert?: (url: string, alt: string) => void;
}) {
  const [uploads, setUploads] = useState<Item[]>([]);
  const [folder, setFolder] = useState<FolderKey>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Item | null>(null);
  const [alt, setAlt] = useState(initialAlt);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [iconColor, setIconColor] = useState(DEFAULT_ICON_COLOR);

  const load = useCallback(async () => {
    await enableCmsMediaPreview();
    const { data: fs } = await supabase.from('media_folders').select('id, name').order('name');
    setFolders(fs ?? []);
    const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false });
    setUploads((data ?? []).map(m => ({
      key: m.id, id: m.id, storagePath: m.storage_path, url: m.url, name: m.name ?? m.storage_path, alt: m.alt ?? '',
      folder: 'uploads', kind: m.kind === 'video' ? 'video' : 'image', type: (m.mime ?? '').split('/')[1]?.toUpperCase() ?? '', size: m.size_bytes ?? undefined, folderId: m.folder_id,
    })));
  }, []);
  useEffect(() => { if (open) { void load(); setSel(null); setAlt(initialAlt); } }, [open, load, initialAlt]);

  const all = useMemo<Item[]>(() => [...uploads, ...siteMedia.map(s => ({ key: s.url, url: s.url, name: s.name, alt: '', folder: 'site' as const, kind: 'image' as const, type: s.type }))], [uploads]);
  const items = (folder === 'icons' ? ICONS : all).filter(i => {
    if (folder !== 'icons' && !belongsToMediaFolder(i, folder)) return false;
    return !q || i.name.toLowerCase().includes(q.toLowerCase());
  });

  const pick = (i: Item) => { setSel(i); setAlt(i.alt || (onInsert ? alt : '')); };
  const saveAlt = async () => {
    if (!sel?.id) return;
    const { error } = await supabase.from('media').update({ alt }).eq('id', sel.id);
    if (error) toast.error('Opslaan mislukt'); else { toast.success('Opgeslagen'); void load(); }
  };
  const remove = async () => {
    if (!sel?.id || !window.confirm(`"${sel.name}" verwijderen?`)) return;
    const { error } = await supabase.from('media').delete().eq('id', sel.id);
    if (error) { toast.error('Verwijderen mislukt (alleen beheerders)'); return; }
    if (sel.storagePath) await supabase.storage.from('cms-media').remove([sel.storagePath]);
    setSel(null); void load();
  };
  const newFolder = async () => {
    const name = window.prompt('Naam van de nieuwe map')?.trim();
    if (!name) return;
    if (name.length > 60) { toast.error('Maximaal 60 tekens'); return; }
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('media_folders').insert({ name, created_by: u.user?.id ?? null }).select('id').single();
    if (error) { toast.error('Map aanmaken mislukt'); return; }
    await load(); setFolder(`f:${data.id}`);
  };
  const removeFolder = async (id: string) => {
    if (!window.confirm('Map verwijderen? De bestanden blijven bewaard in Mijn Bestanden.')) return;
    const { error } = await supabase.from('media_folders').delete().eq('id', id);
    if (error) { toast.error('Verwijderen mislukt (alleen beheerders)'); return; }
    setFolder('all'); void load();
  };
  const moveTo = async (fid: string, id = sel?.id) => {
    if (!id) return;
    const { error } = await supabase.from('media').update({ folder_id: fid || null }).eq('id', id);
    if (error) { toast.error('Verplaatsen mislukt'); return; }
    toast.success('Bestand verplaatst');
    if (sel?.id === id) setSel({ ...sel, folderId: fid || null });
    void load();
  };
  const dropOn = (fid: string) => ({
    onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes('text/cms-media')) e.preventDefault(); },
    onDrop: (e: DragEvent) => { const id = e.dataTransfer.getData('text/cms-media'); if (id) { e.preventDefault(); void moveTo(fid, id); } },
  });
  const canInsert = !!sel && !!onInsert && (accept === 'any' || sel.kind === 'image');
  const itemUrl = (item: Item) => item.svg ? coloredIconUrl(item.svg, iconColor) : item.url;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin z-[2147483001] flex h-[90vh] max-w-[96vw] flex-col gap-0 overflow-hidden border-border bg-background p-0 text-foreground sm:max-w-[96vw] [&>button]:hidden">
        <DialogTitle className="sr-only">Bestandsbeheer</DialogTitle>
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-56 shrink-0 border-r border-border bg-card p-4 md:block">
            <p className="mb-4 font-semibold">Bestandsbeheer</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" {...dropOn('')} onClick={() => setFolder('all')} className={cn('min-w-0 flex-1 justify-start px-2', folder === 'all' && 'bg-accent text-primary')}><Folder />Mijn Bestanden</Button>
              <Button variant="ghost" size="icon" title="Nieuwe map" aria-label="Nieuwe map" onClick={() => void newFolder()}><Plus /></Button>
            </div>
            {folders.map(f => (
              <div key={f.id} className="group flex items-center">
                <Button variant="ghost" {...dropOn(f.id)} onClick={() => setFolder(`f:${f.id}`)} className={cn('min-w-0 flex-1 justify-start pl-6 pr-2', folder === `f:${f.id}` && 'bg-accent text-primary')}><Folder /><span className="truncate">{f.name}</span></Button>
                <Button variant="ghost" size="icon" aria-label={`Map ${f.name} verwijderen`} onClick={() => void removeFolder(f.id)} className="text-muted-foreground opacity-0 hover:text-destructive focus:opacity-100 group-hover:opacity-100"><Trash2 /></Button>
              </div>
            ))}
            <p className="mb-1 mt-5 text-xs text-muted-foreground">Bibliotheek</p>
            <Button variant="ghost" onClick={() => setFolder('icons')} className={cn('w-full justify-start px-2', folder === 'icons' && 'bg-accent text-primary')}><ImageIcon />Iconen (200)</Button>
          </aside>
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
              <Button size="sm" onClick={() => setUploadOpen(true)}><UploadCloud className="mr-1 h-4 w-4" />Bestanden uploaden</Button>
              <div className="flex items-center gap-1 md:hidden"><select aria-label="Map openen" className="h-9 min-w-0 rounded-md border border-border bg-background text-sm" value={folder} onChange={e => setFolder(e.target.value as FolderKey)}><option value="all">Mijn Bestanden</option>{folders.map(f => <option key={f.id} value={`f:${f.id}`}>{f.name}</option>)}<option value="icons">Iconen (200)</option></select><Button variant="ghost" size="icon" aria-label="Nieuwe map" title="Nieuwe map" onClick={() => void newFolder()}><Plus /></Button></div>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length} bestanden</span>
              <div className="relative w-56"><Input className="h-9 pr-9" placeholder="Zoeken" value={q} onChange={e => setQ(e.target.value)} /><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></div>
              <Button size="icon" variant="ghost" aria-label="Sluiten" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-auto p-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {items.map(i => (
                  <button key={i.key} type="button" draggable={!!i.id} onDragStart={e => { if (i.id) e.dataTransfer.setData('text/cms-media', i.id); }} onClick={() => pick(i)} onDoubleClick={() => { if (onInsert && (accept === 'any' || i.kind === 'image')) onInsert(itemUrl(i), i.alt || alt); }}
                  className={cn('overflow-hidden rounded-md border bg-background text-left', sel?.key === i.key ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-muted-foreground')}>
                  
                  <div className={cn('flex aspect-[4/3] items-center justify-center', i.folder === 'icons' ? 'bg-foreground/90 p-6' : 'bg-muted/40')}>
                    {i.kind === 'video' ? <video src={i.url} className="h-full w-full object-cover" muted preload="metadata" /> : <img src={i.folder === 'icons' && sel?.key === i.key ? itemUrl(i) : i.url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />}
                  </div>
                  <p className="truncate px-3 py-2 text-xs">{i.name}</p>
                </button>
              ))}
              {items.length === 0 && <p className="col-span-full p-8 text-center text-sm text-muted-foreground">Geen bestanden gevonden.</p>}
            </div>
            {sel?.svg && <div className="shrink-0 border-t border-border p-3 lg:hidden"><IconColorPicker color={iconColor} onChange={setIconColor} id="mm-icon-color-small" /></div>}
          </main>
          <aside className="hidden w-72 shrink-0 space-y-4 overflow-auto border-l border-border bg-card p-4 lg:block">
            {!sel ? <p className="text-sm text-muted-foreground">Selecteer een bestand om details te zien.</p> : (
              <>
                <div className={cn('flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-border', sel.folder === 'icons' ? 'bg-foreground/90 p-10' : 'bg-muted/40')}>
                  {sel.kind === 'video' ? <video src={sel.url} controls className="max-h-full max-w-full" /> : <img src={itemUrl(sel)} alt="" className="max-h-full max-w-full object-contain" />}
                </div>
                {sel.svg && <IconColorPicker color={iconColor} onChange={setIconColor} id="mm-icon-color" />}
                <div className="space-y-1"><Label>Bestand</Label><p className="break-all text-sm text-foreground">{sel.name}</p></div>
                <div className="space-y-1"><Label htmlFor="mm-alt">Omschrijving (alt-tekst)</Label><Input id="mm-alt" value={alt} onChange={e => setAlt(e.target.value)} /></div>
                {sel.id && <div className="flex justify-between"><Button size="sm" variant="ghost" onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Verwijderen</Button><Button size="sm" variant="secondary" onClick={saveAlt}>Opslaan</Button></div>}
                 {sel.folder !== 'icons' && (
                  <div className="space-y-1"><Label htmlFor="mm-folder">Map</Label>
                    <select id="mm-folder" disabled={!sel.id} className="h-10 w-full rounded-lg border border-border bg-muted text-sm" value={sel.folderId ?? ''} onChange={e => void moveTo(e.target.value)}>
                      <option value="">Mijn Bestanden</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                )}
                <dl className="space-y-3 border-t border-border pt-4 text-sm">
                  <div><dt className="font-medium">Locatie</dt><dd className="text-muted-foreground">{sel.folder === 'icons' ? 'Iconen' : mediaFolderName(sel.folderId, folders)}</dd></div>
                  <div><dt className="font-medium">Type</dt><dd className="text-muted-foreground">{sel.kind === 'video' ? 'Video' : 'Afbeelding'}{sel.type && ` (${sel.type})`}</dd></div>
                  <div><dt className="font-medium">Grootte</dt><dd className="text-muted-foreground">{kb(sel.size)}</dd></div>
                </dl>
              </>
            )}
          </aside>
        </div>
        {onInsert && (
          <div className="flex justify-end gap-2 border-t border-border p-3">
            <Button variant="ghost" onClick={onClose}>Annuleren</Button>
            <Button disabled={!canInsert} onClick={() => sel && onInsert(itemUrl(sel), alt)}>Invoegen</Button>
          </div>
        )}
        <UploadDialog open={uploadOpen} folderId={folder.startsWith('f:') ? folder.slice(2) : null} onClose={() => setUploadOpen(false)} onDone={() => { void load(); if (!folder.startsWith('f:')) setFolder('all'); }} />
      </DialogContent>
    </Dialog>
  );
}

function IconColorPicker({ color, onChange, id }: { color: string; onChange: (color: string) => void; id: string }) {
  const [hex, setHex] = useState(color);
  useEffect(() => { setHex(color); }, [color]);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Icoonkleur</Label>
      <div className="flex flex-wrap gap-1">
        {ICON_COLORS.map(option => (
          <Button key={option.color} size="icon" variant="ghost" title={option.name} aria-label={option.name} aria-pressed={color.toLowerCase() === option.color} onClick={() => onChange(option.color)} className={cn('h-8 w-8 border border-border', color.toLowerCase() === option.color && 'ring-2 ring-unpublished')}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><circle cx="12" cy="12" r="10" fill={option.color} /></svg>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input id={id} type="color" aria-label="Vrije icoonkleur" value={color} onChange={e => onChange(e.target.value)} className="h-10 w-14 shrink-0 cursor-pointer" />
        <Input aria-label="Hexkleur" value={hex} maxLength={7} spellCheck={false} aria-invalid={!isIconColor(hex)} onChange={e => { const value = e.target.value; setHex(value); if (isIconColor(value)) onChange(value); }} onBlur={() => { if (!isIconColor(hex)) setHex(color); }} className="min-w-0 font-mono" />
      </div>
    </div>
  );
}

type Row = { file: File; optimize: boolean; status: 'wait' | 'busy' | 'done' | 'error'; finalName?: string; finalSize?: number; optimized?: boolean };

function UploadDialog({ open, folderId, onClose, onDone }: { open: boolean; folderId: string | null; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [quality, setQuality] = useState(85);
  const [maxSide, setMaxSide] = useState(2560);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setRows([]); }, [open]);
  const finished = rows.length > 0 && rows.every(r => r.status === 'done' || r.status === 'error');
  const add = (files: FileList | null) => {
    if (!files) return;
    const ok = [...files].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const big = ok.filter(f => f.size > 200 * 1024 * 1024);
    if (big.length) toast.error('Bestanden groter dan 200 MB worden overgeslagen');
    setRows(r => [...r, ...ok.filter(f => f.size <= 200 * 1024 * 1024).map(file => ({ file, optimize: true, status: 'wait' as const }))]);
  };
  const upd = (i: number, p: Partial<Row>) => setRows(r => r.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const run = async () => {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      upd(i, { status: 'busy' });
      try {
        const webp = row.optimize ? await toWebp(row.file, quality, maxSide) : null;
        const blob: Blob = webp ?? row.file;
        const base = row.file.name.replace(/\.[^.]+$/, '');
        const ext = webp ? 'webp' : (row.file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
        const kind = row.file.type.startsWith('video/') ? 'video' : 'image';
        const path = `${kind}s/${crypto.randomUUID()}.${ext}`;
        const mime = webp ? 'image/webp' : row.file.type;
        const { error } = await supabase.storage.from('cms-media').upload(path, blob, { contentType: mime });
        if (error) throw error;
        const { error: e2 } = await supabase.from('media').insert({ path, storage_path: path, url: `/cms-media/${path}`, kind, name: `${base}.${ext}`, mime, size_bytes: blob.size, folder_id: folderId, created_by: u.user?.id ?? null });
        if (e2) { await supabase.storage.from('cms-media').remove([path]); throw e2; }
        upd(i, { status: 'done', finalName: `${base}.${ext}`, finalSize: blob.size, optimized: !!webp });
      } catch {
        upd(i, { status: 'error' });
      }
    }
    setBusy(false);
    onDone();
  };

  const done = rows.filter(r => r.status === 'done');
  const total = done.reduce((s, r) => s + (r.finalSize ?? 0), 0);
  const saved = done.reduce((s, r) => s + (r.optimized ? r.file.size - (r.finalSize ?? 0) : 0), 0);

  const pick = () => input.current?.click();
  const dropProps = { onDragOver: (e: DragEvent) => { e.preventDefault(); setDrag(true); }, onDragLeave: () => setDrag(false), onDrop: (e: DragEvent) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); } };
  const selCls = 'h-10 w-full rounded-md border border-border bg-muted px-3 text-sm';

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="dark sw-admin z-[2147483002] max-w-4xl gap-0 overflow-hidden border-border bg-background p-0 text-foreground">
        <DialogHeader className="border-b border-border px-6 py-4"><DialogTitle className="flex items-center gap-2 text-base"><UploadCloud className="h-5 w-5 text-primary" />Media toevoegen</DialogTitle></DialogHeader>
        <input ref={input} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => { add(e.target.files); e.target.value = ''; }} />
        {finished ? (
          <div className="grid gap-3 p-6 sm:grid-cols-3">
            <p className="col-span-full flex items-center gap-2 font-medium"><CheckCircle2 className="h-5 w-5 text-success" />{done.length === rows.length ? 'Alle bestanden zijn succesvol geüpload.' : `${done.length} van ${rows.length} bestanden geüpload.`}</p>
            {[['Totale grootte', kb(total)], ['Geoptimaliseerd', String(done.filter(r => r.optimized).length)], ['Bespaard', kb(saved)]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-muted p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold">{v}</p></div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[22rem] md:grid-cols-[1fr_17rem]">
            <section {...dropProps} className={cn('flex min-w-0 flex-col p-6 transition-colors', drag && 'bg-primary/10')}>
              {rows.length === 0 ? (
                <button type="button" onClick={pick} className={cn('flex flex-1 items-center gap-5 rounded-xl border-2 p-6 text-left', drag ? 'border-primary' : 'border-muted')}>
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Plus className="h-7 w-7" /></span>
                  <span><span className="block font-semibold">Kies foto's of video's</span><span className="text-sm text-muted-foreground">Je kunt bestanden ook op dit vlak neerzetten.</span></span>
                </button>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-semibold">Wachtrij <span className="text-muted-foreground">({rows.length})</span></p>{!busy && <Button size="sm" variant="outline" onClick={pick}><Plus className="mr-1 h-4 w-4" />Meer toevoegen</Button>}</div>
                  <ul className="max-h-72 divide-y divide-border overflow-auto rounded-lg border border-border">
                    {rows.map((r, i) => (
                      <li key={i} className="relative flex items-center gap-3 px-3 py-2.5 text-sm">
                        <span className="absolute inset-y-0 left-0 w-1 bg-success transition-all" style={{ opacity: r.status === 'done' ? 1 : r.status === 'busy' ? 0.5 : 0 }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{r.finalName ?? r.file.name}</p>
                          <p className="text-xs text-muted-foreground">{kb(r.file.size)}{r.finalSize != null && <span className="text-success"> → {kb(r.finalSize)}{r.finalSize < r.file.size && ` (−${Math.round((1 - r.finalSize / r.file.size) * 100)}%)`}</span>}</p>
                        </div>
                        {r.status === 'wait' ? (
                          <>
                            {r.file.type.startsWith('image/') && <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={r.optimize} onCheckedChange={c => upd(i, { optimize: !!c })} />WebP</label>}
                            <Button size="icon" variant="ghost" aria-label="Verwijderen" onClick={() => setRows(x => x.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                          </>
                        ) : <span className={cn('text-xs', r.status === 'done' ? 'text-success' : r.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{r.status === 'busy' ? 'Bezig…' : r.status === 'error' ? 'Mislukt' : r.optimized ? 'Geoptimaliseerd' : 'Geüpload'}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
            <aside className="space-y-4 border-t border-border bg-card p-6 md:border-l md:border-t-0">
              <div><p className="text-sm font-semibold">Optimalisatie</p><p className="mt-1 text-xs text-muted-foreground">Afbeeldingen worden naar WebP omgezet als dat kleiner uitvalt.</p></div>
              <div className="space-y-1"><Label htmlFor="up-quality">Kwaliteit</Label><select id="up-quality" className={selCls} value={quality} onChange={e => setQuality(Number(e.target.value))}>{QUALITY.map(o => <option key={o.v} value={o.v}>{o.l} ({o.v})</option>)}</select></div>
              <div className="space-y-1"><Label htmlFor="up-size">Langste zijde maximaal</Label><select id="up-size" className={selCls} value={maxSide} onChange={e => setMaxSide(Number(e.target.value))}>{SIZES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
            </aside>
          </div>
        )}
        <DialogFooter className="border-t border-border px-6 py-3">
          {finished ? <Button onClick={onClose}>Klaar</Button> : (
            <><Button variant="ghost" disabled={busy} onClick={onClose}>Annuleren</Button><Button disabled={busy || rows.length === 0} onClick={run}>{busy ? 'Bezig…' : rows.length ? `${rows.length} uploaden` : 'Uploaden'}</Button></>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
