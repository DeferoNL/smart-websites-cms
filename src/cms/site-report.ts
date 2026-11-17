import { z } from 'zod';
import { compareVersions } from './version.ts';

// Shared contract for client-site reports to the master (numbers only, never personal data).
export const statsSchema = z.object({
  users: z.number().int().min(0).max(100000),
  admins: z.number().int().min(0).max(100000),
  no_2fa: z.number().int().min(0).max(100000),
  drafts: z.number().int().min(0).max(1000000),
  last_publish: z.string().max(40).nullable(),
  unread_forms: z.number().int().min(0).max(10000000),
  installed: z.boolean(),
});
export type SiteStats = z.infer<typeof statsSchema>;

export const reportSchema = z.object({
  host: z.string().trim().toLowerCase().min(3).max(253).regex(/^[a-z0-9.-]+(:\d{1,5})?$/),
  version: z.string().trim().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/),
  name: z.string().trim().max(120).optional(),
  token: z.string().min(32).max(128),
  stats: statsSchema,
});

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

/** First report stores the hash; later reports must match it. */
export function tokenAccepted(stored: string | null | undefined, incoming: string): boolean {
  return !stored || stored === incoming;
}

export type SiteStatus = 'ok' | 'update' | 'security' | 'silent';
export const SILENT_DAYS = 7;

export function siteStatus(version: string, lastSeen: string, latest: string, security: string | null, now = Date.now()): SiteStatus {
  if (now - new Date(lastSeen).getTime() > SILENT_DAYS * 86400000) return 'silent';
  if (security && compareVersions(version, security) < 0) return 'security';
  if (compareVersions(version, latest) < 0) return 'update';
  return 'ok';
}
