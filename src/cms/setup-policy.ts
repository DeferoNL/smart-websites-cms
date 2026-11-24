export const INITIAL_ADMIN_EMAIL = 'office@defero.nl';
/** Defero accounts that stay Administrator on every website and may use central sign-in. */
export const DEFERO_SUPERADMINS = ['office@defero.nl', 'kars@defero.nl'] as const;
export const SETUP_RETRY_MS = 10 * 60 * 1000;

export function reservedAdminEmail(email: string) {
  return email.trim().toLowerCase() === INITIAL_ADMIN_EMAIL;
}

export function setupAvailable({ completed, invitedUserId, hasAdmin }: { completed: boolean; invitedUserId: string | null; hasAdmin: boolean }) {
  return !completed && !invitedUserId && !hasAdmin;
}

export function setupRetryAllowed(requestedAt: number | null, now: number) {
  return requestedAt === null || (Number.isFinite(requestedAt) && now - requestedAt >= SETUP_RETRY_MS);
}

export function deferoSuperadmin(email: string | null | undefined) {
  return (DEFERO_SUPERADMINS as readonly string[]).includes(String(email ?? '').trim().toLowerCase());
}

export function assertReservedAdminUnchanged(email: string) {
  if (deferoSuperadmin(email)) throw new Error('De vaste beheerder kan niet worden verwijderd of van rol veranderen.');
}