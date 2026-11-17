import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const getPublicGalleryPhotos = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ folder: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { publishedFolderPhotos } = await import('./published-media.server.ts');
    return publishedFolderPhotos(data.folder);
  });

/** Short-lived HttpOnly credential for image requests; revalidated on every private read. */
export const enableCmsMediaPreview = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed } = await context.supabase.rpc('can_edit', { _user_id: context.userId });
    if (!allowed) throw new Error('Geen toegang');
    const { getRequestHeader, setCookie } = await import('@tanstack/react-start/server');
    const bearer = getRequestHeader('authorization')?.replace(/^Bearer\s+/i, '');
    if (!bearer) throw new Error('Geen toegang');
    setCookie('cms-media-preview', bearer, { httpOnly: true, secure: process.env['NODE_ENV'] === 'production', sameSite: 'strict', path: '/cms-media', maxAge: 300 });
    return true;
  });