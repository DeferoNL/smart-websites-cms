import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/button.tsx';
import type { GalleryPhoto, GallerySettings } from './gallery.ts';
import './slider.css';
import { getPublicGalleryPhotos } from '../lib/media.functions.ts';

/** Both imported header slides and simple galleries use this shared playback owner. */
export function GallerySlider({ settings, fallback, props, renderSlide }: { settings: GallerySettings; fallback: GalleryPhoto[]; props: Record<string, unknown>; renderSlide?: ((photo: GalleryPhoto, index: number) => ReactNode) | undefined }) {
  const base = settings.photos ?? fallback;
  const [folderPhotos, setFolderPhotos] = useState<GalleryPhoto[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [editing, setEditing] = useState(false);
  const slides = settings.folder ? folderPhotos ?? base : base;
  useEffect(() => {
    const update = () => setEditing(document.documentElement.hasAttribute('data-cms-editing'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-cms-editing'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!settings.folder) return;
    let cancelled = false;
    const load = async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: auth } = await supabase.auth.getUser();
      const { data: allowed } = auth.user ? await supabase.rpc('can_edit', { _user_id: auth.user.id }) : { data: false };
      const { data, error } = allowed
        ? await supabase.from('media').select('url, alt').eq('folder_id', settings.folder).eq('kind', 'image').order('created_at', { ascending: true }).order('id')
        : { data: await getPublicGalleryPhotos({ data: { folder: settings.folder } }), error: null };
      if (!cancelled && !error) setFolderPhotos((data ?? []).map(m => ({ src: m.url, alt: m.alt || '' })));
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [settings.folder]);
  useEffect(() => { setIdx(i => i < slides.length ? i : 0); }, [slides.length]);
  useEffect(() => {
    if (editing || paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIdx(i => (i + 1) % slides.length), settings.speed * 1000);
    return () => window.clearInterval(timer);
  }, [editing, paused, slides.length, settings.speed]);
  const { className, style, ...rest } = props as Record<string, unknown> & { className?: string; style?: Record<string, unknown> };
  delete rest['data-carousel_autoplay'];
  return <div {...rest} data-cms-managed-slider="" data-gallery={JSON.stringify(settings)} data-gallery-photos={JSON.stringify(slides)} className={`${className ?? ''} cms-slider ${renderSlide ? 'cms-slider-legacy' : ''} effect-${settings.effect}`} style={{ ...style, ['--gallery-speed' as string]: `${Math.min(1.2, settings.speed / 4)}s` }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
    <div className="cms-slider-track" style={settings.effect === 'slide' ? { transform: `translateX(-${idx * 100}%)` } : undefined}>
      {slides.map((photo, i) => <div key={photo.src + i} className={`cms-slider-frame ${i === idx ? 'active' : ''}`} aria-hidden={i !== idx} inert={i !== idx}>{renderSlide ? renderSlide(photo, i) : <img src={photo.src} alt={photo.alt} loading={i === 0 ? 'eager' : 'lazy'} />}</div>)}
    </div>
    {!slides.length && <div className="cms-slider-empty" role="status">Geen foto's</div>}
    {slides.length > 1 && <>
      <Button variant="original" type="button" className="cms-slider-nav prev" aria-label="Vorige foto" data-slider-control onClick={() => setIdx(i => (i - 1 + slides.length) % slides.length)}>‹</Button>
      <Button variant="original" type="button" className="cms-slider-nav next" aria-label="Volgende foto" data-slider-control onClick={() => setIdx(i => (i + 1) % slides.length)}>›</Button>
      <div className="cms-slider-dots">{slides.map((_, i) => <Button variant="original" type="button" key={i} aria-label={`Foto ${i + 1}`} aria-current={i === idx} data-slider-control onClick={() => setIdx(i)} />)}</div>
    </>}
  </div>;
}