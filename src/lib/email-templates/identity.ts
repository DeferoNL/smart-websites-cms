export const EMAIL_SENDER_NAME = 'SMART Websites'

/** The sender is the platform; the project reference belongs to the website. */
export function emailProjectName(settings: { project_name?: string | null; site_domain?: string | null } | null): string {
  return settings?.project_name?.trim() || settings?.site_domain?.trim() || 'je website'
}