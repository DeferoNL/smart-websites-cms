/** Development shortcuts must never appear on published websites. */
export function showPreviewAccess(development: boolean, hostname: string, pathname: string, cmsMode: string | null): boolean {
  const preview = development || /^id-preview--[a-z0-9-]+\.lovable\.app$/.test(hostname);
  return preview && !pathname.startsWith('/smart-websites') && !cmsMode;
}