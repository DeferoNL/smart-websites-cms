// Photo slider settings shared by the website and the editor. Browser- and server-safe.
export const GALLERY_EFFECTS = [['slide', 'Schuiven'], ['fade', 'Vervagen'], ['zoom', 'Inzoomen']] as const;
export type GalleryEffect = (typeof GALLERY_EFFECTS)[number][0];
export type GalleryPhoto = { src: string; alt: string };
export type GallerySettings = { folder: string; speed: number; effect: GalleryEffect; photos?: GalleryPhoto[] };

export const GALLERY_MIN_SPEED = 2;
export const GALLERY_MAX_SPEED = 15;
export const GALLERY_DEFAULT: GallerySettings = { folder: '', speed: 5, effect: 'slide' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Removing a folder photo freezes this slider's selection, never deletes the media file. */
export function removeGalleryPhoto(settings: GallerySettings, visible: GalleryPhoto[], index: number): GallerySettings {
  if (index < 0 || index >= visible.length) return settings;
  return { ...settings, folder: '', photos: visible.filter((_, i) => i !== index) };
}

/** Validates stored or markup-provided slider settings; invalid values fall back to defaults. */
export function safeGallery(v: Partial<Record<keyof GallerySettings, unknown>> | undefined): GallerySettings {
  const speed = Number(v?.speed);
  const effect = GALLERY_EFFECTS.find(([k]) => k === v?.effect)?.[0] ?? GALLERY_DEFAULT.effect;
  return {
    folder: typeof v?.folder === 'string' && UUID.test(v.folder) ? v.folder : '',
    speed: Number.isFinite(speed) ? Math.min(GALLERY_MAX_SPEED, Math.max(GALLERY_MIN_SPEED, Math.round(speed))) : GALLERY_DEFAULT.speed,
    effect,
    ...(Array.isArray(v?.photos) ? { photos: v.photos.filter((p): p is GalleryPhoto => !!p && typeof p.src === 'string' && /^(https?:\/\/|\/(?!\/))/.test(p.src) && typeof p.alt === 'string').map(p => ({ src: p.src, alt: p.alt })) } : {}),
  };
}
