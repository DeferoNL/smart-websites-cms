import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useRouterState } from '@tanstack/react-router';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import { Eye, ImageIcon, Monitor, Tablet, Smartphone, X, Plus, ArrowUp, ArrowDown, Trash2, LifeBuoy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { MediaManager } from './MediaManager.tsx';
import { FormatBar } from './FormatBar.tsx';
import { LinkDialog } from './LinkDialog.tsx';
import { translatePublished } from '../lib/translate.functions.ts';
import { enableCmsMediaPreview } from '../lib/media.functions.ts';
import { IMAGE_POSITIONS, imageShapeStyle, mergeContent, pageKey, buttonColorStyle, colorInputValue, type CmsContent, type ImageShape } from './content.ts';
import { Label } from '../components/ui/label.tsx';
import { BlockBar } from './BlockBar.tsx';
import { blockHtml, defaultLayout, insertBlock, moveBlock, removeBlock, toggleBlock, updateBlockBackground, type Layout } from './blocks.ts';
import { Checkbox } from '../components/ui/checkbox.tsx';
import { setCmsPreview } from './preview-store.ts';
import { sitePages as originalPages, sourceOf } from '@/site/cms-adapter';
import { GALLERY_EFFECTS, GALLERY_MAX_SPEED, GALLERY_MIN_SPEED, safeGallery, removeGalleryPhoto, type GallerySettings, type GalleryPhoto } from './gallery.ts';
import { Slider } from '../components/ui/slider.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select.tsx';

type Perms = { text: boolean; images: boolean; blocks: boolean; translate: boolean; pages: boolean; buttonColors: boolean };
const NO_PERMS: Perms = { text: false, images: false, blocks: false, translate: false, pages: false, buttonColors: false };
let customSources: Record<string, string> = {};
const pageHtml = (p: string) => (originalPages as unknown as Record<string, { html: string }>)[sourceOf(p, customSources)]?.html ?? '';

const SANITIZE = { ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'font', 'a', 'ul', 'ol', 'li', 'span'], ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'color', 'size'] };

export function CmsEditor() {
  const location = useLocation();
  const [canEdit, setCanEdit] = useState(false);
  const [perms, setPerms] = useState<Perms>(NO_PERMS);
  const [defaultLang, setDefaultLang] = useState('nl');
  const [layout, setLayout] = useState<Layout | null>(null);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState<CmsContent>({});
  const [busy, setBusy] = useState(false);
  const [imageTarget, setImageTarget] = useState<HTMLImageElement | null>(null);
  const [photoTarget, setPhotoTarget] = useState<HTMLImageElement | null>(null);
  const [bgTarget, setBgTarget] = useState<HTMLElement | null>(null);
  const [bgPick, setBgPick] = useState<HTMLElement | null>(null);
  const [galleryTarget, setGalleryTarget] = useState<HTMLElement | null>(null);
  const [device, setDevice] = useState<'tablet' | 'phone' | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const inFrame = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('frame') === '1';
  const [linkTarget, setLinkTarget] = useState<HTMLAnchorElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const draftRef = useRef<CmsContent>({});
  customSources = (useRouterState({ select: s => s.matches.find(m => m.routeId === '__root__')?.loaderData }) as { customPages?: Record<string, string> } | undefined)?.customPages ?? {};
  const page = pageKey(location.pathname);
  const onSite = page in originalPages || page in customSources;

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setCanEdit(false); return; }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') { setCanEdit(false); return; }
      const { data: adm } = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' });
      const { data: ok } = await supabase.rpc('can_edit', { _user_id: data.user.id });
      setCanEdit(Boolean(ok));
      if (!ok) return;
      await enableCmsMediaPreview();
      const { data: p } = await supabase.rpc('my_perms');
      setPerms({ ...NO_PERMS, ...((p ?? {}) as Partial<Perms>) });
      const { data: st } = await supabase.from('site_settings').select('default_lang, seo_ai_enabled').eq('id', 1).maybeSingle();
      if (st?.default_lang) setDefaultLang(st.default_lang);
      setAiOn(Boolean(adm || st?.seo_ai_enabled));
    };
    void check();
    const mediaTimer = window.setInterval(() => { void check(); }, 240000);
    const { data } = supabase.auth.onAuthStateChange(() => { void check(); });
    return () => { window.clearInterval(mediaTimer); data.subscription.unsubscribe(); };
  }, []);

  const startEditing = useCallback(async () => {
    await enableCmsMediaPreview();
    const { data: rows } = await supabase.from('page_content').select('state, data, layout').eq('path', page);
    const draft = rows?.find(r => r.state === 'draft') ?? rows?.find(r => r.state === 'published');
    draftRef.current = (draft?.data ?? {}) as CmsContent;
    const l = (draft?.layout ?? null) as unknown as Layout | null;
    setLayout(l); setLayoutDirty(false);
    setCmsPreview({ page, content: draftRef.current, layout: l });
    setEditing(true);
    setVersion(v => v + 1);
  }, [page]);

  useEffect(() => {
    if (!canEdit || !onSite) return;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const prev = icon?.href;
    if (icon) icon.href = '/smart-websites-favicon.png';
    const mode = new URLSearchParams(window.location.search).get('cms');
    if (mode === 'edit') {
      window.history.replaceState(window.history.state, '', window.location.pathname);
      void startEditing();
    } else if (mode === 'preview') {
      // Show the saved concept version to signed-in editors without entering edit mode.
      void supabase.from('page_content').select('state, data, layout').eq('path', page).then(({ data: rows }) => {
        const draft = rows?.find(r => r.state === 'draft');
        if (draft) setCmsPreview({ page, content: (draft.data ?? {}) as CmsContent, layout: (draft.layout ?? null) as unknown as Layout | null });
        setPreviewing(true);
      });
    }
    return () => { if (icon && prev) icon.href = prev; };
  }, [canEdit, onSite, startEditing]);

  useEffect(() => {
    if (!editing) return;
    document.documentElement.dataset['cmsEditing'] = '';
    const texts = perms.text ? Array.from(document.querySelectorAll<HTMLElement>('[data-cms-kind="text"]')) : [];
    texts.forEach(el => { el.contentEditable = 'true'; el.spellcheck = true; });
    const onInput = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cms-kind="text"]');
      if (!el?.dataset['cmsId']) return;
      const id = el.dataset['cmsId'];
      setDirty(d => ({ ...d, [id]: { html: DOMPurify.sanitize(el.innerHTML, SANITIZE) } }));
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-cms-toolbar], [data-cms-blockbar], [role="dialog"]')) return;
      if (t.closest('[data-slider-control]')) return;
      const gallery = t.closest<HTMLElement>('[data-cms-kind="gallery"]');
      if (gallery && perms.images && !t.closest('[data-cms-kind="text"], [data-cms-kind="link"]')) { e.preventDefault(); e.stopImmediatePropagation(); setGalleryTarget(gallery); return; }
      const img = t.closest<HTMLImageElement>('[data-cms-kind="image"]');
      if (img && perms.images) { e.preventDefault(); e.stopImmediatePropagation(); setPhotoTarget(img); return; }
      const link = t.closest<HTMLAnchorElement>('[data-cms-kind="link"]');
      if (link && perms.text) { e.preventDefault(); e.stopImmediatePropagation(); setLinkTarget(link); return; }
      // Slider controls stay usable so editors can step through slides manually.
      if (t.closest('.carousel .previous, .carousel .next, .carousel .bullet, .carousel .thumbnail')) { e.preventDefault(); return; }
      if (t.closest('a, button, [data-action]') && !t.closest('[contenteditable="true"]')) { e.preventDefault(); e.stopImmediatePropagation(); }
      if (t.closest('[contenteditable="true"]')) e.stopImmediatePropagation();
    };
    const onLeave = (e: BeforeUnloadEvent) => { if (Object.keys(dirtyRef.current).length) e.preventDefault(); };
    document.addEventListener('input', onInput, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      delete document.documentElement.dataset['cmsEditing'];
      texts.forEach(el => el.removeAttribute('contenteditable'));
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [editing, version, perms]);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;

  const layoutDirtyRef = useRef(layoutDirty); layoutDirtyRef.current = layoutDirty;
  const layoutRef = useRef(layout); layoutRef.current = layout;
  const savingRef = useRef<Promise<boolean> | null>(null);

  /** Saves the concept (and optionally publishes). Edits typed during the save stay pending. */
  const save = async (publish: boolean, silent = false): Promise<boolean> => {
    if (savingRef.current) await savingRef.current;
    const run = (async () => {
      setBusy(true);
      const snapshot = dirtyRef.current;
      const { data: u } = await supabase.auth.getUser();
      const merged = mergeContent(draftRef.current, snapshot);
      const rows = [{ path: page, state: 'draft', data: merged, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString(), ...(perms.blocks ? { layout: layoutRef.current as never } : {}) }];
      if (publish) rows.push({ ...rows[0]!, state: 'published' });
      const { error } = await supabase.from('page_content').upsert(rows);
      setBusy(false);
      if (error) { toast.error('Opslaan mislukt: ' + error.message); return false; }
      draftRef.current = merged;
      setDirty(d => Object.fromEntries(Object.entries(d).filter(([k, v]) => snapshot[k] !== v)));
      setLayoutDirty(false); setSavedAt(new Date());
      if (!silent) toast.success(publish ? 'Gepubliceerd — bezoekers zien de wijzigingen nu.' : 'Concept opgeslagen. Nog niet zichtbaar voor bezoekers.');
      if (publish && perms.text) {
        try {
          const r = await translatePublished({ data: { path: page } });
          if (r.translated.length) toast.success('Automatisch vertaald naar: ' + r.translated.join(', '));
        } catch (e) { toast.error('Vertalen mislukt: ' + (e as Error).message); }
      }
      return true;
    })();
    savingRef.current = run;
    try { return await run; } finally { if (savingRef.current === run) savingRef.current = null; }
  };

  // Autosave every change as a concept shortly after typing stops.
  useEffect(() => {
    if (!editing || (!Object.keys(dirty).length && !layoutDirty)) return;
    const t = setTimeout(() => { void save(false, true); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, layoutDirty, editing]);

  const backToDashboard = async () => {
    if ((Object.keys(dirtyRef.current).length || layoutDirtyRef.current) && !(await save(false, true))) return;
    if (savingRef.current) await savingRef.current;
    window.location.href = '/smart-websites';
  };

  const showPreview = async () => {
    // Open the tab synchronously so popup blockers allow it; load it after the draft is saved.
    const tab = window.open('about:blank', '_blank');
    const ok = !(savingRef.current && !(await savingRef.current))
      && !((Object.keys(dirtyRef.current).length || layoutDirtyRef.current) && !(await save(false, true)));
    if (!ok) { tab?.close(); return; }
    const url = `${location.pathname}?cms=preview`;
    if (tab) tab.location.href = url; else window.open(url, '_blank');
  };


  if (!canEdit || !onSite || inFrame) return null;
  const lockedLang = !perms.translate && !page.startsWith('/' + defaultLang);
  const changes = Object.keys(dirty).length + (layoutDirty ? 1 : 0);
  const current = layout ?? defaultLayout(pageHtml(page));
  const changeLayout = (next: Layout) => {
    const content = mergeContent(draftRef.current, dirty);
    draftRef.current = content; setDirty({});
    setLayout(next); setLayoutDirty(true);
    setCmsPreview({ page, content, layout: next });
    setTimeout(() => setVersion(v => v + 1), 0);
  };
  const htmlOf = (i: number) => blockHtml(pageHtml(page), current[i]!, mergeContent(draftRef.current, dirty));
  const status = changes || busy ? 'Opslaan…' : savedAt ? 'Concept opgeslagen' : 'Selecteer tekst of klik op een foto';
  return (
    <>
      <div data-cms-toolbar className="fixed bottom-4 left-1/2 z-[2147483000] flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2 text-foreground shadow-lg">
        {previewing ? <>
          <span className="px-2 text-sm text-muted-foreground">Voorbeeld van het concept</span>
          <Button size="icon" variant={device === null ? 'default' : 'outline'} title="Desktop" aria-label="Desktop" onClick={() => setDevice(null)}><Monitor className="h-4 w-4" /></Button>
          <Button size="icon" variant={device === 'tablet' ? 'default' : 'outline'} title="Tablet" aria-label="Tablet" onClick={() => setDevice('tablet')}><Tablet className="h-4 w-4" /></Button>
          <Button size="icon" variant={device === 'phone' ? 'default' : 'outline'} title="Telefoon" aria-label="Telefoon" onClick={() => setDevice('phone')}><Smartphone className="h-4 w-4" /></Button>
        </> : !editing ? (
          lockedLang
            ? <span className="px-2 text-sm text-muted-foreground">Deze taal wordt automatisch vertaald. Bewerk de pagina in de standaardtaal.</span>
            : <>
                {previewing && <span className="px-2 text-sm text-muted-foreground">Voorbeeld van het concept</span>}
                <Button size="sm" onClick={() => { setPreviewing(false); void startEditing(); }}>Pagina bewerken</Button>
                {previewing && <Button size="sm" disabled={busy} className="bg-success text-success-foreground hover:bg-success/90" onClick={async () => {
                  setBusy(true);
                  const { data: d } = await supabase.from('page_content').select('data, layout').eq('path', page).eq('state', 'draft').maybeSingle();
                  const { data: u } = await supabase.auth.getUser();
                  const { error } = d ? await supabase.from('page_content').upsert({ path: page, state: 'published', data: d.data, layout: d.layout, updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() }) : { error: null };
                  setBusy(false);
                  if (error) toast.error('Publiceren mislukt: ' + error.message); else toast.success('Gepubliceerd — bezoekers zien de wijzigingen nu.');
                }}>Publiceren</Button>}
              </>
        ) : (
          <>
            <span className="px-2 text-sm text-muted-foreground">{status}</span>
            <Button size="sm" disabled={busy} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => void save(true)}>Publiceren</Button>
            <Button size="icon" variant="outline" asChild title="Helpdesk"><a href="https://helpdesk.smart-websites.nl" target="_blank" rel="noopener noreferrer" aria-label="Helpdesk"><LifeBuoy className="h-4 w-4" /></a></Button>
            <Button size="icon" variant="outline" title="Voorbeeld bekijken" aria-label="Voorbeeld bekijken" disabled={busy} onClick={() => void showPreview()}><Eye className="h-4 w-4" /></Button>
          </>
        )}
        {!previewing && <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>Geschiedenis</Button>}
        <Button size="sm" variant="secondary" disabled={busy && !changes} onClick={() => void backToDashboard()}>← Terug naar dashboard</Button>
      </div>
      {editing && perms.blocks && (
        <BlockBar
          layout={current}
          getHtml={htmlOf}
          onMove={(i, d) => changeLayout(moveBlock(current, i, d))}
          onCopy={i => changeLayout(insertBlock(current, i + 1, htmlOf(i)))}
          onRemove={i => changeLayout(removeBlock(current, i))}
          onToggle={i => changeLayout(toggleBlock(current, i))}
          onBackground={(i, appearance) => changeLayout(updateBlockBackground(current, i, appearance))}
          onInsert={(i, html) => changeLayout(insertBlock(current, i, html))}
        />
      )}
      {previewing && device && (
        <div data-cms-blockbar className="fixed inset-0 z-[2147482999] flex items-start justify-center overflow-auto bg-muted/95 pb-24 pt-6">
          <div className="relative overflow-hidden rounded-[28px] border-8 border-foreground/80 bg-background shadow-2xl" style={{ width: device === 'tablet' ? 820 : 406, height: device === 'tablet' ? 1100 : 860, maxHeight: 'calc(100vh - 120px)' }}>
            <iframe title={device === 'tablet' ? 'Voorbeeld op tablet' : 'Voorbeeld op telefoon'} src={`${location.pathname}?cms=preview&frame=1`} className="h-full w-full border-0" />
          </div>
          <Button size="icon" variant="outline" className="absolute right-4 top-4" aria-label="Sluiten" onClick={() => setDevice(null)}><X className="h-4 w-4" /></Button>
        </div>
      )}
      {editing && perms.images && <BackgroundButtons version={version} onPick={setBgTarget} />}
      {editing && perms.text && <FormatBar ai={aiOn} onChange={el => { const id = el.dataset['cmsId']; if (id) setDirty(d => ({ ...d, [id]: { html: DOMPurify.sanitize(el.innerHTML, SANITIZE) } })); }} />}
      <LinkDialog
        open={!!linkTarget} withLabel withColors={perms.buttonColors} title="Knop of link wijzigen"
        initial={{ label: linkTarget?.textContent?.trim() ?? '', href: linkTarget?.getAttribute('href') ?? '', newWindow: linkTarget?.target === '_blank', buttonBackground: linkTarget ? colorInputValue(getComputedStyle(linkTarget).backgroundColor) : undefined, buttonForeground: linkTarget ? colorInputValue(getComputedStyle(linkTarget).color) : undefined }}
        onClose={() => setLinkTarget(null)}
        onSave={v => {
          const a = linkTarget; const id = a?.dataset['cmsId'];
          if (!a || !id) return;
          const label = DOMPurify.sanitize(v.label ?? '', { ALLOWED_TAGS: [] });
          a.textContent = label; a.setAttribute('href', v.href);
          if (v.newWindow) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
          const colors = perms.buttonColors ? { ...(v.buttonBackground ? { buttonBackground: v.buttonBackground } : {}), ...(v.buttonForeground ? { buttonForeground: v.buttonForeground } : {}) } : {};
          Object.assign(a.style, buttonColorStyle(colors));
          setDirty(d => ({ ...d, [id]: { ...d[id], html: label, href: v.href, target: v.newWindow ? '_blank' : '', ...colors } }));
          setLinkTarget(null);
        }}
      />
      {historyOpen && <HistoryDialog page={page} onClose={() => setHistoryOpen(false)} />}
      {photoTarget && (
        <PhotoDialog
          img={photoTarget}
          onClose={() => setPhotoTarget(null)}
          onPickOther={() => { setImageTarget(photoTarget); setPhotoTarget(null); }}
          onSave={v => {
            const img = photoTarget; const id = img.dataset['cmsId']!;
            img.style.objectPosition = v.position; img.alt = v.alt;
            for (const k of ['aspectRatio', 'objectFit', 'height', 'borderRadius'] as const) img.style[k] = '';
            Object.assign(img.style, imageShapeStyle(v));
            setDirty(d => ({ ...d, [id]: { ...d[id], position: v.position, alt: v.alt, link: v.link, shape: v.shape, rounded: v.rounded } }));
            setPhotoTarget(null);
          }}
        />
      )}
      {galleryTarget && (
        <GalleryDialog
          initial={safeGallery(JSON.parse(galleryTarget.dataset['gallery'] || '{}'))}
          photos={JSON.parse(galleryTarget.dataset['galleryPhotos'] || '[]')}
          onClose={() => setGalleryTarget(null)}
          onSave={g => {
            const id = galleryTarget.dataset['cmsId'];
            if (!id) return;
            const next = { ...dirty, [id]: { ...dirty[id], gallery: g } };
            setDirty(next);
            setCmsPreview({ page, content: mergeContent(draftRef.current, next), layout });
            setGalleryTarget(null);
          }}
        />
      )}
      {bgTarget && (
        <BackgroundDialog
          el={bgTarget}
          onClose={() => setBgTarget(null)}
          onPickOther={() => { setBgPick(bgTarget); setBgTarget(null); }}
          onSave={position => {
            const el = bgTarget; const id = el.dataset['cmsId']!;
            el.style.backgroundPosition = position;
            setDirty(d => ({ ...d, [id]: { ...d[id], position } }));
            setBgTarget(null);
          }}
        />
      )}
      <MediaManager
        open={!!bgPick}
        initialAlt=""
        onClose={() => setBgPick(null)}
        onInsert={url => {
          const el = bgPick!; const id = el.dataset['cmsId']!;
          el.style.backgroundImage = `url("${url}")`;
          setDirty(d => ({ ...d, [id]: { ...d[id], bg: url } }));
          setBgPick(null);
          setBgTarget(el);
        }}
      />
      <MediaManager
        open={!!imageTarget}
        initialAlt={imageTarget?.alt ?? ''}
        onClose={() => setImageTarget(null)}
        onInsert={(url, alt) => {
          const img = imageTarget!; const id = img.dataset['cmsId']!;
          img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = url; img.alt = alt;
          setDirty(d => ({ ...d, [id]: { ...d[id], src: url, srcset: null, alt } }));
          setImageTarget(null);
          setPhotoTarget(img);
        }}
      />
    </>
  );
}

type Revision = { id: string; created_at: string; data: unknown };
function HistoryDialog({ page, onClose }: { page: string; onClose: () => void }) {
  const [rows, setRows] = useState<Revision[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase.from('page_revisions').select('id, created_at, data').eq('path', page).order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Revision[]));
  }, [page]);
  const restore = async (r: Revision) => {
    if (!window.confirm('Deze versie terugzetten en direct publiceren? De huidige versie blijft in de geschiedenis staan.')) return;
    setBusy(true);
    const { error } = await supabase.rpc('restore_page_revision', { _id: r.id });
    setBusy(false);
    if (error) { toast.error('Terugzetten mislukt: ' + error.message); return; }
    await supabase.rpc('log_audit', { _action: 'Versie teruggezet', _target: page });
    toast.success('Versie teruggezet.');
    window.location.reload();
  };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Versiegeschiedenis</DialogTitle></DialogHeader>
        {!rows ? <p className="text-sm text-muted-foreground">Laden…</p> : !rows.length
          ? <p className="text-sm text-muted-foreground">Nog geen gepubliceerde versies van deze pagina.</p>
          : <ul className="max-h-96 space-y-2 overflow-auto">
              {rows.map((r, i) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                  <span>{new Date(r.created_at).toLocaleString('nl-NL')} · {Object.keys((r.data ?? {}) as object).length} aanpassing(en){i === 0 && <span className="ml-2 text-success">huidig</span>}</span>
                  {i > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => void restore(r)}>Terugzetten</Button>}
                </li>
              ))}
            </ul>}
      </DialogContent>
    </Dialog>
  );
}

const POS_LABELS: Record<string, string> = {
  'left top': 'Links boven', 'center top': 'Boven', 'right top': 'Rechts boven',
  'left center': 'Links', 'center center': 'Midden', 'right center': 'Rechts',
  'left bottom': 'Links onder', 'center bottom': 'Onder', 'right bottom': 'Rechts onder',
};
const SHAPES: [ImageShape, string][] = [['', 'Origineel'], ['landscape', 'Liggend'], ['portrait', 'Staand'], ['square', 'Vierkant'], ['round', 'Rond']];
type PhotoValues = { position: string; alt: string; link: string; shape: ImageShape; rounded: boolean };
function PhotoDialog({ img, onClose, onPickOther, onSave }: { img: HTMLImageElement; onClose: () => void; onPickOther: () => void; onSave: (v: PhotoValues) => void }) {
  const st = img.style;
  const [shape, setShape] = useState<ImageShape>(st.borderRadius === '50%' ? 'round' : st.aspectRatio === '4 / 3' ? 'landscape' : st.aspectRatio === '3 / 4' ? 'portrait' : st.aspectRatio === '1 / 1' ? 'square' : '');
  const [rounded, setRounded] = useState(st.borderRadius === '16px');
  const parentLink = img.closest('a');
  const [link, setLink] = useState(img.dataset['cmsLink'] ?? parentLink?.getAttribute('href') ?? '');
  const initial = (() => { const [x = 'center', y = 'center'] = getComputedStyle(img).objectPosition.split(' ').map(v => v === '0%' ? 'left' : v === '100%' ? 'right' : v === '50%' ? 'center' : v); const p = `${x} ${y === 'left' ? 'top' : y === 'right' ? 'bottom' : y}`; return (IMAGE_POSITIONS as readonly string[]).includes(p) ? p : 'center center'; })();
  const [pos, setPos] = useState(initial);
  const [alt, setAlt] = useState(img.alt);
  const rect = img.getBoundingClientRect();
  const ratio = shape === 'landscape' ? 4 / 3 : shape === 'portrait' ? 3 / 4 : shape === 'square' || shape === 'round' ? 1 : rect.width && rect.height ? rect.width / rect.height : 16 / 9;
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Afbeelding bewerken</DialogTitle></DialogHeader>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Zo komt de foto op de website te staan:</p>
            <div className="mx-auto overflow-hidden border border-border bg-muted" style={{ aspectRatio: String(Math.min(Math.max(ratio, 0.6), 3)), maxHeight: 320, borderRadius: shape === 'round' ? '50%' : rounded ? 16 : 8 }}>
              <img src={img.currentSrc || img.src} alt="" className="h-full w-full object-cover" style={{ objectPosition: pos }} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Uitlijning</p>
            <div className="grid w-36 grid-cols-3 gap-1.5" role="radiogroup" aria-label="Uitlijning">
              {IMAGE_POSITIONS.map(p => (
                <button key={p} type="button" role="radio" aria-checked={pos === p} aria-label={POS_LABELS[p]} title={POS_LABELS[p]} onClick={() => setPos(p)}
                  className={`flex h-11 items-center justify-center rounded-md border transition-colors ${pos === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${pos === p ? 'bg-primary-foreground' : 'bg-muted-foreground/50'}`} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{POS_LABELS[pos]}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="photo-alt">Omschrijving (alt-tekst)</Label>
          <Input id="photo-alt" value={alt} onChange={e => setAlt(e.target.value)} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Vorm</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Vorm">
            {SHAPES.map(([k, l]) => (
              <button key={k || 'orig'} type="button" role="radio" aria-checked={shape === k} onClick={() => setShape(k)}
                className={`rounded-md border px-3 py-1.5 text-sm ${shape === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={rounded || shape === 'round'} disabled={shape === 'round'} onCheckedChange={v => setRounded(v === true)} />Afgeronde hoeken</label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="photo-link">Link bij klikken op de foto (optioneel)</Label>
          <Input id="photo-link" placeholder="Bijv. / voor de homepagina of https://…" value={link} onChange={e => setLink(e.target.value)} />
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" className="cms-btn-blue" onClick={onPickOther}>Andere foto kiezen</button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annuleren</Button>
            <Button onClick={() => { img.dataset['cmsLink'] = link.trim(); onSave({ position: pos, alt, link: link.trim(), shape, rounded }); }}>Opslaan</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small "Achtergrond wijzigen" buttons on sections that have a background photo. */
function BackgroundButtons({ version, onPick }: { version: number; onPick: (el: HTMLElement) => void }) {
  const [items, setItems] = useState<{ el: HTMLElement; rect: DOMRect }[]>([]);
  useEffect(() => {
    const update = () => setItems(Array.from(document.querySelectorAll<HTMLElement>('[data-cms-kind="background"]')).map(el => ({ el, rect: el.getBoundingClientRect() })).filter(i => i.rect.bottom > 0 && i.rect.top < window.innerHeight));
    update();
    const t = setInterval(update, 1000);
    window.addEventListener('scroll', update, true); window.addEventListener('resize', update);
    return () => { clearInterval(t); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [version]);
  return <>{items.map(({ el, rect }, i) => (
    <button key={i} type="button" data-cms-blockbar onClick={() => onPick(el)} className="cms-btn-blue fixed z-[2147482995] inline-flex items-center gap-2 shadow-lg"
      style={{ top: Math.max(rect.top + 12, 8), left: rect.left + 12 }}><ImageIcon className="h-4 w-4" />Achtergrond wijzigen</button>
  ))}</>;
}

function BackgroundDialog({ el, onClose, onPickOther, onSave }: { el: HTMLElement; onClose: () => void; onPickOther: () => void; onSave: (position: string) => void }) {
  const cs = getComputedStyle(el);
  const src = cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] ?? '';
  const initial = (() => { const p = cs.backgroundPosition.split(' ').map(v => v === '0%' ? 'left' : v === '100%' ? 'right' : v === '50%' ? 'center' : v); const q = `${p[0] ?? 'center'} ${p[1] === 'left' ? 'top' : p[1] === 'right' ? 'bottom' : p[1] ?? 'center'}`; return (IMAGE_POSITIONS as readonly string[]).includes(q) ? q : 'center center'; })();
  const [pos, setPos] = useState(initial);
  const rect = el.getBoundingClientRect();
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Achtergrondfoto bewerken</DialogTitle></DialogHeader>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <div className="overflow-hidden rounded-lg border border-border bg-muted" style={{ aspectRatio: String(Math.min(Math.max(rect.width / (rect.height || 1), 0.6), 3)), backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: pos }} />
          <div>
            <p className="mb-2 text-sm font-medium">Uitlijning</p>
            <div className="grid w-36 grid-cols-3 gap-1.5" role="radiogroup" aria-label="Uitlijning">
              {IMAGE_POSITIONS.map(p => (
                <button key={p} type="button" role="radio" aria-checked={pos === p} aria-label={POS_LABELS[p]} title={POS_LABELS[p]} onClick={() => setPos(p)}
                  className={`flex h-11 items-center justify-center rounded-md border ${pos === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${pos === p ? 'bg-primary-foreground' : 'bg-muted-foreground/50'}`} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{POS_LABELS[pos]}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" className="cms-btn-blue" onClick={onPickOther}>Andere foto kiezen</button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annuleren</Button>
            <Button onClick={() => onSave(pos)}>Opslaan</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GalleryDialog({ initial, photos, onClose, onSave }: { initial: GallerySettings; photos: GalleryPhoto[]; onClose: () => void; onSave: (g: GallerySettings) => void }) {
  const [g, setG] = useState(initial);
  const [pick, setPick] = useState<number | 'add' | null>(null);
  const selected = g.folder ? photos : g.photos ?? photos;
  const move = (index: number, delta: number) => {
    const next = [...selected];
    const other = next[index + delta]; const current = next[index];
    if (!other || !current) return;
    next[index] = other; next[index + delta] = current;
    setG({ ...g, folder: '', photos: next });
  };
  const [folders, setFolders] = useState<{ id: string; name: string; count: number }[]>([]);
  useEffect(() => {
    void (async () => {
      const { data: fs } = await supabase.from('media_folders').select('id, name').order('name');
      const { data: ms } = await supabase.from('media').select('folder_id').eq('kind', 'image');
      setFolders((fs ?? []).map(f => ({ ...f, count: (ms ?? []).filter(m => m.folder_id === f.id).length })));
    })();
  }, []);
  if (pick !== null) return <MediaManager open initialAlt={typeof pick === 'number' ? selected[pick]?.alt ?? '' : ''} onClose={() => setPick(null)} onInsert={(src, alt) => {
    setG({ ...g, folder: '', photos: pick === 'add' ? [...selected, { src, alt }] : selected.map((p, i) => i === pick ? { src, alt } : p) });
    setPick(null);
  }} />;
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Slider instellen</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="gallery-folder">Foto's uit map</Label>
            <Select value={g.folder || 'manual'} onValueChange={value => setG({ ...g, folder: value === 'manual' ? '' : value })}>
              <SelectTrigger id="gallery-folder"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="manual">Losse foto's</SelectItem>{folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name} ({f.count} foto's)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Foto's ({selected.length})</Label>
            <ul className="max-h-64 space-y-2 overflow-y-auto">{selected.map((photo, index) => <li key={index} className="flex items-center gap-2 border-b border-border py-2">
              <Button variant="ghost" className="h-16 w-20 shrink-0 overflow-hidden p-0" aria-label={`Foto ${index + 1} vervangen`} title="Foto vervangen" onClick={() => setPick(index)}><img src={photo.src} alt={photo.alt} className="h-full w-full object-cover" /></Button>
              <Input aria-label={`Omschrijving foto ${index + 1}`} value={photo.alt} onChange={e => setG({ ...g, folder: '', photos: selected.map((p, i) => i === index ? { ...p, alt: e.target.value } : p) })} />
              <div className="flex shrink-0 flex-wrap gap-1">
                <Button variant="ghost" size="icon" aria-label={`Foto ${index + 1} eerder`} title="Eerder" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Foto ${index + 1} later`} title="Later" disabled={index === selected.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Foto ${index + 1} verwijderen`} title="Verwijderen uit slider" onClick={() => setG(removeGalleryPhoto(g, selected, index))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>)}</ul>
            <Button variant="outline" onClick={() => setPick('add')}><Plus className="mr-2 h-4 w-4" />Foto toevoegen</Button>
          </div>
          <div className="space-y-2">
            <Label>Wisselen elke {g.speed} seconden</Label>
            <Slider aria-label="Wisseltijd in seconden" min={GALLERY_MIN_SPEED} max={GALLERY_MAX_SPEED} step={1} value={[g.speed]} onValueChange={([v]) => setG({ ...g, speed: v ?? g.speed })} />
          </div>
          <div className="space-y-2">
            <Label>Overgang</Label>
            <div className="flex flex-wrap gap-2">
              {GALLERY_EFFECTS.map(([k, l]) => <Button key={k} type="button" size="sm" variant={g.effect === k ? 'brand' : 'outline'} onClick={() => setG({ ...g, effect: k })}>{l}</Button>)}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button onClick={() => onSave(g)}>Opslaan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
