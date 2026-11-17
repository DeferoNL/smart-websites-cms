import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LinkDialog } from './LinkDialog.tsx';
import { Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Type, CaseSensitive, Paintbrush, PaintBucket, Eraser, Link2, Unlink, AlignLeft, AlignCenter, AlignRight, WandSparkles, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import { assistText, type TextAction } from '../lib/text-ai.functions.ts';

const AI_ACTIONS: [TextAction, string][] = [['improve', 'Verbeteren'], ['rewrite', 'Herschrijven'], ['shorten', 'Inkorten'], ['spelling', 'Spelling en grammatica controleren']];
const AI_SANITIZE = { ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'span'], ALLOWED_ATTR: ['href', 'target', 'rel', 'style'] };

const SIZES = [['Klein', '2'], ['Normaal', '3'], ['Groot', '5'], ['Extra groot', '6']] as const;
const COLORS = ['#ffffff', '#000000', '#e30613', '#ff7c00', '#f5c400', '#2e9e44', '#1a73e8', '#6b7280'];

/** Floating formatting toolbar shown above selected text inside editable CMS blocks. */
export function FormatBar({ onChange, ai = false }: { onChange: (el: HTMLElement) => void; ai?: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<'size' | 'color' | 'bg' | 'ai' | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const saved = useRef<{ range: Range; el: HTMLElement; anchor: HTMLAnchorElement | null } | null>(null);

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { if (!saved.current) { setPos(null); setMenu(null); } return; }
      const node = sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode?.parentElement;
      if (!node?.closest('[data-cms-kind="text"]')) { setPos(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setPos({ x: Math.max(8, r.left + r.width / 2), y: Math.max(8, r.top - 52) });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    return () => { document.removeEventListener('selectionchange', update); window.removeEventListener('scroll', update, true); };
  }, []);

  const openLink = () => {
    const sel = window.getSelection(); if (!sel?.rangeCount) return;
    const node = sel.anchorNode; const base = node instanceof HTMLElement ? node : node?.parentElement;
    const el = base?.closest<HTMLElement>('[data-cms-kind="text"]'); if (!el) return;
    saved.current = { range: sel.getRangeAt(0).cloneRange(), el, anchor: base?.closest('a') ?? null };
    setLinkOpen(true);
  };
  const finishLink = (apply?: { href: string; newWindow: boolean } | 'remove') => {
    const s = saved.current; setLinkOpen(false); saved.current = null;
    if (!s || !apply) return;
    s.el.focus();
    const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(s.range);
    if (apply === 'remove') { if (s.anchor) { sel.selectAllChildren(s.anchor); } document.execCommand('unlink'); onChange(s.el); setPos(null); return; }
    let a = s.anchor;
    if (a) a.setAttribute('href', apply.href);
    else {
      const marker = `cms-link-${Date.now()}`;
      document.execCommand('createLink', false, marker);
      a = s.el.querySelector<HTMLAnchorElement>(`a[href="${marker}"]`);
      a?.setAttribute('href', apply.href);
    }
    if (a) { if (apply.newWindow) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else { a.removeAttribute('target'); a.removeAttribute('rel'); } }
    onChange(s.el); setPos(null);
  };
  const dialog = <LinkDialog open={linkOpen} title="Link instellen" initial={{ href: saved.current?.anchor?.getAttribute('href') ?? '', newWindow: saved.current?.anchor?.target === '_blank' }}
    onClose={() => finishLink()} onSave={v => finishLink(v)} onRemove={saved.current?.anchor ? () => finishLink('remove') : undefined} />;
  if (!pos) return dialog;
  const run = (cmd: string, value?: string) => {
    const node = window.getSelection()?.anchorNode;
    const el = (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>('[data-cms-kind="text"]');
    document.execCommand('styleWithCSS', false, cmd === 'fontSize' ? 'false' : 'true');
    document.execCommand(cmd, false, value);
    setMenu(null);
    if (el) onChange(el);
  };
  const runAi = async (action: TextAction) => {
    const node = window.getSelection()?.anchorNode;
    const el = (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>('[data-cms-kind="text"]');
    setMenu(null);
    if (!el) return;
    setAiBusy(true);
    try {
      const r = await assistText({ data: { action, html: el.innerHTML } });
      el.innerHTML = DOMPurify.sanitize(r.html, AI_SANITIZE);
      onChange(el);
      toast.success(`Tekst aangepast. Nog ${r.remaining} keer vandaag.`);
    } catch (e) { toast.error((e as Error).message); } finally { setAiBusy(false); }
  };
  const B = ({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) => (
    <button type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded hover:bg-accent">{children}</button>
  );
  const sep = <span className="mx-1 h-6 w-px bg-border" />;
  return (
    <div data-cms-toolbar className="dark fixed z-[2147483001] flex -translate-x-1/2 items-center rounded-lg border border-border bg-background p-1 text-foreground shadow-xl" style={{ left: pos.x, top: pos.y }}>
      <B title="Vet" onClick={() => run('bold')}><Bold className="h-4 w-4" /></B>
      <B title="Schuin" onClick={() => run('italic')}><Italic className="h-4 w-4" /></B>
      <B title="Onderstrepen" onClick={() => run('underline')}><Underline className="h-4 w-4" /></B>
      <B title="Doorhalen" onClick={() => run('strikeThrough')}><Strikethrough className="h-4 w-4" /></B>
      {sep}
      <B title="Subscript" onClick={() => run('subscript')}><Subscript className="h-4 w-4" /></B>
      <B title="Superscript" onClick={() => run('superscript')}><Superscript className="h-4 w-4" /></B>
      {sep}
      <B title="Normale tekst" onClick={() => run('removeFormat')}><Type className="h-4 w-4" /></B>
      <B title="Tekstgrootte" onClick={() => setMenu(menu === 'size' ? null : 'size')}><CaseSensitive className="h-4 w-4" /></B>
      <B title="Tekstkleur" onClick={() => setMenu(menu === 'color' ? null : 'color')}><Paintbrush className="h-4 w-4" /></B>
      <B title="Achtergrondkleur" onClick={() => setMenu(menu === 'bg' ? null : 'bg')}><PaintBucket className="h-4 w-4" /></B>
      {sep}
      <B title="Opmaak wissen" onClick={() => run('removeFormat')}><Eraser className="h-4 w-4" /></B>
      {sep}
      <B title="Links uitlijnen" onClick={() => run('justifyLeft')}><AlignLeft className="h-4 w-4" /></B>
      <B title="Centreren" onClick={() => run('justifyCenter')}><AlignCenter className="h-4 w-4" /></B>
      <B title="Rechts uitlijnen" onClick={() => run('justifyRight')}><AlignRight className="h-4 w-4" /></B>
      {sep}
      <B title="Link toevoegen" onClick={openLink}><Link2 className="h-4 w-4" /></B>
      <B title="Link verwijderen" onClick={() => run('unlink')}><Unlink className="h-4 w-4" /></B>
      {ai && <>{sep}<B title="AI-hulp: verbeteren, herschrijven, inkorten of spelling" onClick={() => !aiBusy && setMenu(menu === 'ai' ? null : 'ai')}>{aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}</B></>}
      {menu === 'ai' ? (
        <div className="absolute right-0 top-full mt-1 flex flex-col rounded-lg border border-border bg-background p-1 shadow-xl">
          {AI_ACTIONS.map(([a, l]) => <button key={a} type="button" onMouseDown={e => e.preventDefault()} onClick={() => void runAi(a)} className="rounded px-3 py-1.5 text-left text-sm hover:bg-accent">{l}</button>)}
        </div>
      ) : menu && (
        <div className="absolute left-0 top-full mt-1 flex gap-1 rounded-lg border border-border bg-background p-2 shadow-xl">
          {menu === 'size' ? SIZES.map(([l, v]) => (
            <button key={v} type="button" onMouseDown={e => e.preventDefault()} onClick={() => run('fontSize', v)} className="rounded px-2 py-1 text-sm hover:bg-accent">{l}</button>
          )) : COLORS.map(c => (
            <button key={c} type="button" aria-label={c} onMouseDown={e => e.preventDefault()} onClick={() => run(menu === 'color' ? 'foreColor' : 'hiliteColor', c)} className="h-6 w-6 rounded border border-border" style={{ backgroundColor: c }} />
          ))}
        </div>
      )}
      {dialog}
    </div>
  );
}
