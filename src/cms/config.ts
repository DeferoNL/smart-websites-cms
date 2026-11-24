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
  // Hosts of the master CMS (published + preview); only there Google sign-in and ticket issuing are offered.
  masterHosts: ['pagecraft-foundry.lovable.app', 'id-preview--163c7967-d238-4f84-b24c-278935268606.lovable.app'],
  // Public key of the master; client sites verify central sign-in tickets with it (private key stays on the master).
  ssoPublicKey: { kty: 'EC', crv: 'P-256', x: '65lRUJ2sHm8uJRSyevPqc4KwoyppPmpIvXNDQZvjRdM', y: 'cXGNWCpO4YK2MwurtM0ziltH9vQ_qCN8pKnfdlbzaMI' },
} as const;
