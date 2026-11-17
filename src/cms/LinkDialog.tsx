import { toast } from 'sonner';
import { safeHref, safeButtonColor } from './content.ts';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { Checkbox } from '../components/ui/checkbox.tsx';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { pageList, menuName } from '@/site/cms-adapter';
import { useRouterState } from '@tanstack/react-router';
import { cmsPath, languageEnabled, publicPath, DEFAULT_SITE_LANGUAGES, type SiteLanguages } from './languages.ts';

export type LinkValue = { label?: string; href: string; newWindow: boolean; buttonBackground?: string | undefined; buttonForeground?: string | undefined };

/** Dialog to set a link: a site page or a free URL, opened in the same or a new window. */
export function LinkDialog({ open, title, initial, withLabel, withColors, onClose, onSave, onRemove }: {
  open: boolean; title: string; initial: LinkValue; withLabel?: boolean; withColors?: boolean;
  onClose: () => void; onSave: (v: LinkValue) => void; onRemove?: (() => void) | undefined;
}) {
  const settings = (useRouterState({ select: s => s.matches.find(m => m.routeId === '__root__')?.loaderData }) as { siteLanguages?: SiteLanguages } | undefined)?.siteLanguages ?? DEFAULT_SITE_LANGUAGES;
  const isPage = (h: string) => h.startsWith('/') && pageList.some(p => p.path === cmsPath(h));
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<'page' | 'url'>('page');
  const [page, setPage] = useState('');
  const [url, setUrl] = useState('');
  const [newWindow, setNewWindow] = useState(false);
  const [background, setBackground] = useState('');
  const [foreground, setForeground] = useState('');
  const [colorsChanged, setColorsChanged] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLabel(initial.label ?? '');
    const p = isPage(initial.href) || !initial.href;
    setMode(p ? 'page' : 'url');
    setPage(p && initial.href ? cmsPath(initial.href) : '');
    setUrl(p ? '' : initial.href);
    setNewWindow(initial.newWindow);
    setBackground(initial.buttonBackground ?? '');
    setForeground(initial.buttonForeground ?? '');
    setColorsChanged(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const href = mode === 'page' ? (page ? publicPath(page) : '') : url.trim();
  const lang = typeof window !== 'undefined' && window.location.pathname.startsWith('/en') ? '/en' : '/nl';
  const pages = pageList.filter(p => languageEnabled(p.path, settings)).sort((a, b) => Number(!a.path.startsWith(lang)) - Number(!b.path.startsWith(lang)));
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin max-w-md bg-background text-foreground">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (href && safeHref(href) === '#' && href !== '#') { toast.error('Alleen links naar webpagina\'s (https://), e-mail (mailto:) of telefoon (tel:) zijn toegestaan.'); return; } if (href) onSave({ label: label.trim(), href, newWindow, ...(withColors && colorsChanged ? { buttonBackground: safeButtonColor(background), buttonForeground: safeButtonColor(foreground) } : {}) }); }}>
          {withLabel && <div className="space-y-1"><Label htmlFor="cms-link-label">Naam van de knop</Label><Input id="cms-link-label" required value={label} onChange={e => setLabel(e.target.value)} /></div>}
          <div className="space-y-2">
            <Label>Link naar</Label>
            <div className="flex flex-wrap gap-3">
              <Button type="button" size="sm" className="sw-choice" data-active={mode === 'page'} onClick={() => setMode('page')}>Pagina van de website</Button>
              <Button type="button" size="sm" className="sw-choice" data-active={mode === 'url'} onClick={() => setMode('url')}>Eigen URL</Button>
            </div>
            {mode === 'page' ? (
              <select aria-label="Pagina" required value={page} onChange={e => setPage(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground">
                <option value="">Kies een pagina…</option>
                {pages.map(p => <option key={p.path} value={p.path}>{menuName(p.path)} ({publicPath(p.path)})</option>)}
              </select>
            ) : (
              <Input aria-label="URL" required placeholder="https://… of mailto:… of tel:…" value={url} onChange={e => setUrl(e.target.value)} />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={newWindow} onCheckedChange={v => setNewWindow(v === true)} />Openen in een nieuw venster</label>
          {withColors && <div className="space-y-3 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="cms-button-background">Knopkleur</Label><Input id="cms-button-background" type="color" className="h-10 w-full cursor-pointer p-1" value={background} onChange={e => { setBackground(e.target.value); setColorsChanged(true); }} /></div>
              <div className="space-y-1"><Label htmlFor="cms-button-foreground">Tekstkleur</Label><Input id="cms-button-foreground" type="color" className="h-10 w-full cursor-pointer p-1" value={foreground} onChange={e => { setForeground(e.target.value); setColorsChanged(true); }} /></div>
            </div>
            <span className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 text-sm" style={{ backgroundColor: safeButtonColor(background), color: safeButtonColor(foreground) }}>{label || 'Knop'}</span>
          </div>}
          <DialogFooter className="gap-2">
            {onRemove && <Button type="button" variant="ghost" onClick={onRemove}>Link verwijderen</Button>}
            <Button type="button" variant="outline" onClick={onClose}>Annuleren</Button>
            <Button type="submit" disabled={!href}>Toepassen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
