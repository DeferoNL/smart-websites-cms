export const ADMIN_ROLE = 'admin';
export const PERMISSION_LABELS = [
  ['text', 'Teksten, links en knoppen wijzigen'], ['images', "Foto's wijzigen en uploaden"],
  ['forms', 'Formulierinzendingen beheren'], ['stats', 'Statistieken bekijken'],
  ['blocks', 'Blokken verschuiven, dupliceren en invoegen'], ['translate', 'Vertalingen bewerken'],
  ['activity', 'Activiteit bekijken'], ['pages', "Pagina's en structuur beheren"],
  ['settings', 'Site-instellingen wijzigen'], ['backups', 'Back-ups maken'],
] as const;
export const BUILDER_PERMISSION_LABELS = [['buttonColors', 'Knopkleuren aanpassen'], ['restore', 'Back-ups terugzetten']] as const;
export const ADMIN_ONLY_PERMISSIONS = ['users', 'dns', 'updates'] as const;
export function defaultRolePermissions(key: string): Record<string, boolean> {
  const advanced = key === 'webbuilder' || key === 'advanced';
  return { text: true, images: true, forms: true, stats: true, blocks: advanced, translate: advanced,
    activity: advanced, pages: key === 'webbuilder', settings: key === 'webbuilder', backups: key === 'webbuilder',
    users: false, dns: false, updates: false, restore: key === 'webbuilder', buttonColors: key === 'webbuilder' };
}
export function rolePermissionAllowed(admin: boolean, perms: Record<string, boolean>, key: string) {
  return admin || (!ADMIN_ONLY_PERMISSIONS.some(p => p === key) && Boolean(perms[key]));
}
export type CmsRoleProfile = { id: string; name: string; perms: Record<string, boolean>; system_key: string | null };
export function roleAssignment(value: string) {
  if (!value) throw new Error('Kies een rol.');
  return value === ADMIN_ROLE ? { role: 'admin' as const, cmsRoleId: null } : { role: 'editor' as const, cmsRoleId: value };
}