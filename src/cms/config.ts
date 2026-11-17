// Project-specific CMS settings. Copy src/cms/ to another project and change only this file;
// the project name itself is edited in the dashboard (Instellingen) and stored in site_settings.
export const CMS_CONFIG = {
  brand: 'SMART-WEBSITES',
  fallbackProjectName: 'Website',
  // Website identity comes from site_settings; verified email transport is managed per project.
  mediaBucket: 'cms-media',
  revisionsKept: 20,
  // Master CMS that publishes the latest version + changelog for the Updates screen.
  masterUrl: 'https://pagecraft-foundry.lovable.app',
} as const;
