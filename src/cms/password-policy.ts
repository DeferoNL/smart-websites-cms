export const PASSWORD_RULES = [
  { label: 'Minimaal 12 tekens', test: (p: string) => p.length >= 12 },
  { label: 'Een hoofdletter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Een kleine letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Een cijfer', test: (p: string) => /\d/.test(p) },
  { label: 'Een leesteken of symbool', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const isStrongPassword = (p: string) => PASSWORD_RULES.every(r => r.test(p));
