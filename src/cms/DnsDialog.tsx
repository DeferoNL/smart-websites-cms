import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Copy, Info, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { Button } from '../components/ui/button.tsx';
import { useSiteDomain } from './site-domain.ts';
import { supabase } from '@/integrations/supabase/client';
import { expectedWebsiteRecords, fqdn, recordStatus } from './dns-check.ts';

type Row = { type: string; name: string; value: string; live: string[]; status: 'ok' | 'missing' | 'conflict' };
async function lookup(name: string, type: string) {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  const j = await r.json() as { Answer?: { type: number; data: string }[] };
  const code = type === 'A' ? 1 : type === 'TXT' ? 16 : 5;
  return (j.Answer ?? []).filter(a => a.type === code).map(a => a.data);
}
function Cp({ v }: { v: string }) {
  return <button type="button" aria-label="Kopiëren" className="ml-2 inline-flex align-middle text-muted-foreground hover:text-foreground" onClick={() => { void navigator.clipboard.writeText(v); toast.success('Gekopieerd'); }}><Copy className="h-4 w-4" /></button>;
}

type Sys = { admins: number; bucket: boolean; tables_without_rls: string[]; site_domain: string };
function SystemCheck() {
  const [s, setS] = useState<Sys | null>(null);
  const [signup, setSignup] = useState<boolean | null>(null);
  useEffect(() => {
    void supabase.rpc('system_check').then(({ data }) => setS(data as unknown as Sys));
    // Public signup must be off: GoTrue settings report disable_signup.
    void fetch(`${import.meta.env['VITE_SUPABASE_URL']}/auth/v1/settings`, { headers: { apikey: import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] } })
      .then(r => r.json()).then((j: { disable_signup?: boolean }) => setSignup(!!j.disable_signup)).catch(() => setSignup(null));
  }, []);
  if (!s) return <Loader2 className="h-5 w-5 animate-spin" />;
  const items: [string, boolean, string][] = [
    ['Websitedomein ingevuld', !!s.site_domain, 'Vul het domein in onder Instellingen.'],
    ['Beheerder aanwezig', s.admins > 0, 'Nodig een beheerder uit.'],
    ['Opslag voor bestanden (privé)', s.bucket, 'De opslagmap voor bestanden ontbreekt of is openbaar.'],
    ['Zelf registreren uitgeschakeld', signup === true, 'Zet registratie uit in de inloginstellingen.'],
    ['Beveiligingsregels op alle tabellen', s.tables_without_rls.length === 0, `Zonder regels: ${s.tables_without_rls.join(', ')}`],
  ];
  return <div className="divide-y divide-border">{items.map(([label, ok, fix]) =>
    <div key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span>{label}{!ok && <span className="block text-xs text-destructive">{fix}</span>}</span>
      <span className={`cms-status ${ok ? 'cms-status-ok' : 'cms-status-attention'}`}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{ok ? 'Geverifieerd' : 'Aandacht vereist'}</span></div>)}</div>;
}

export function DnsDialog({ onClose }: { onClose: () => void }) {
  const domain = useSiteDomain();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');
  const run = () => {
    setRows(null); setErr('');
    Promise.all(expectedWebsiteRecords().map(async r => { const live = await lookup(fqdn(domain, r.name), r.type); return { ...r, live, status: recordStatus(r.value, live) }; }))
      .then(setRows).catch(() => setErr('DNS kon niet worden opgevraagd. Probeer het opnieuw.'));
  };
  useEffect(() => { if (domain) run(); }, [domain]); // eslint-disable-line react-hooks/exhaustive-deps
  const allOk = rows?.every(r => r.status === 'ok');
  const action = (r: Row) => r.status === 'ok' ? 'Geen' : r.status === 'missing' ? (r.live.length ? 'Wijzigen' : 'Toevoegen') : `Verwijder ${r.live.filter(v => v !== r.value).join(', ')}`;
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin max-h-[92vh] max-w-4xl overflow-y-auto text-foreground">
        <DialogHeader><DialogTitle className="text-2xl font-semibold">Domein & beveiliging</DialogTitle></DialogHeader>
        <div className="flex gap-3 border-l-2 border-cms-brand pl-4 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0" />
          <p>Stel de onderstaande DNS-instellingen in bij je domeinnaamregistrar. Sommige registrars gebruiken een lege naam of de domeinnaam in plaats van @. Verwijder oude A-records voor dezelfde naam.</p></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-all font-semibold">{domain}</h3><Button type="button" variant="outline" size="sm" onClick={run}>Opnieuw controleren</Button></div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {!rows && !err && <Loader2 className="h-5 w-5 animate-spin" />}
        {rows && <>
          <div className={`cms-status w-fit ${allOk ? 'cms-status-ok' : 'cms-status-attention'}`}>
            {allOk ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {allOk ? 'Domein geverifieerd' : 'Domein: aandacht vereist'}</div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3">Type</th><th className="p-3">Naam</th><th className="p-3">Waarde</th><th className="p-3">Nu</th><th className="p-3">Actie</th><th className="p-3">Status</th></tr></thead>
            <tbody>{rows.map(r => <tr key={r.name} className="border-b border-border">
              <td className="p-3">{r.type}</td><td className="p-3">{r.name}<Cp v={r.name} /></td><td className="p-3">{r.value}<Cp v={r.value} /></td>
              <td className="p-3 text-muted-foreground">{r.live.join(', ') || '—'}</td><td className="p-3">{action(r)}</td>
              <td className="p-3"><span className={`cms-status ${r.status === 'ok' ? 'cms-status-ok' : 'cms-status-attention'}`}>{r.status === 'ok' ? 'Geverifieerd' : 'Aanpassen'}</span></td></tr>)}</tbody></table></div>
        </>}
        <h3 className="pt-4 font-semibold">Systeem</h3>
        <SystemCheck />
      </DialogContent>
    </Dialog>
  );
}
