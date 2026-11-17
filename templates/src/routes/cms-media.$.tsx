import { createFileRoute } from '@tanstack/react-router';
import { publicClient } from '@defero/smart-websites-cms/src/lib/cms.functions.ts';

// Authorize every download before importing the privileged storage client.
export const Route = createFileRoute('/cms-media/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? '';
        if (!/^[\w./-]+$/.test(path) || path.includes('..')) return new Response('Not found', { status: 404 });
        const sb = publicClient();
        const { getCookie } = await import('@tanstack/react-start/server');
        const token = getCookie('cms-media-preview');
        let staff = false;
        if (token) {
          const { data: auth } = await sb.auth.getUser(token);
          if (auth.user) {
            const { data: allowed } = await publicClient(token).rpc('can_edit', { _user_id: auth.user.id });
            staff = allowed === true;
          }
        }
        if (!staff) {
          const { publishedMediaAccess, publishedFolderPhotos } = await import('@defero/smart-websites-cms/src/lib/published-media.server.ts');
          const refs = await publishedMediaAccess();
          const url = '/cms-media/' + path;
          let published = refs.urls.has(url);
          for (const folder of refs.folders) {
            if (published) break;
            const photos = await publishedFolderPhotos(folder);
            if (photos.some(p => p.url === url)) published = true;
          }
          if (!published) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { data, error } = await supabaseAdmin.storage.from('cms-media').download(path);
        if (error || !data) return new Response('Not found', { status: 404 });
        return new Response(data, {
          headers: { 'content-type': data.type || 'application/octet-stream', 'cache-control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
        });
      },
    },
  },
});
