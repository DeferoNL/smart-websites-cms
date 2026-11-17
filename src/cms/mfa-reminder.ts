/** Interval between 2FA reminder emails: every two weeks. */
export const MFA_REMINDER_DAYS = 14;

/** True when no reminder was sent yet, or the last one is at least 14 days old. */
export function mfaReminderDue(lastSentIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastSentIso) return true;
  const last = Date.parse(lastSentIso);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= MFA_REMINDER_DAYS * 86_400_000;
}
