// Pure helpers for the admin DNS checker (expected records vs. live DNS-over-HTTPS answers).
export type DnsRecord = { type: 'A' | 'TXT' | 'CNAME'; name: string; value: string };
export const LOVABLE_IP = '185.158.133.1';
export function expectedWebsiteRecords(): DnsRecord[] {
  return [{ type: 'A', name: '@', value: LOVABLE_IP }, { type: 'A', name: 'www', value: LOVABLE_IP }];
}
export function fqdn(domain: string, name: string) { return name === '@' ? domain : `${name}.${domain}`; }
const norm = (v: string) => v.replace(/^"|"$/g, '').replace(/\.$/, '').toLowerCase();
// ok = expected value present and no other values of that type (stale A records break SSL).
export function recordStatus(expected: string, live: string[]): 'ok' | 'missing' | 'conflict' {
  const l = live.map(norm);
  if (!l.includes(norm(expected))) return 'missing';
  return l.length > 1 ? 'conflict' : 'ok';
}
