import { useEffect, useState } from 'react';
import { Copy, RefreshCw, LayoutGrid } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { updatePrompt } from './update-prompt.ts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { Button } from '../components/ui/button.tsx';
import { CMS_VERSION, CHANGELOG, compareVersions, latestSecurityVersion, type ChangelogEntry } from './version.ts';
import { getMasterVersion } from '../lib/version.functions.ts';

type State = { loading: true } | { loading: false; ok: true; version: string; changelog: ChangelogEntry[] } | { loading: false; ok: false; error: string };

export function UpdatesDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<State>({ loading: true });
  const load = () => { setS({ loading: true }); void getMasterVersion().then(r => setS({ loading: false, ...r } as State)); };
  useEffect(load, []);
  // Master only: client sites that reported their version (admin-readable; empty on client sites).
  const [sites, setSites] = useState<{ host: string; site_name: string | null; version: string; last_seen: string }[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { void supabase.from('cms_client_sites').select('host, site_name, version, last_seen').order('host').then(({ data }) => setSites(data ?? [])); }, []);
  const secVersion = latestSecurityVersion(CHANGELOG);
  const copyPrompt = () => { void navigator.clipboard.writeText(updatePrompt()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const upToDate = !s.loading && s.ok && compareVersions(CMS_VERSION, s.version) >= 0;
  const log = !s.loading && s.ok ? s.changelog : CHANGELOG;
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin max-h-[90vh] overflow-y-auto text-foreground">
        <DialogHeader><DialogTitle>Updates</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 text-sm">
          <div><p className="text-muted-foreground">Geïnstalleerde versie</p><p className="text-lg font-semibold">{CMS_VERSION}</p></div>
          <div><p className="text-muted-foreground">Nieuwste versie</p><p className="text-lg font-semibold">{s.loading ? '…' : s.ok ? s.version : '–'}</p></div>
          <div className="col-span-2 flex items-center justify-between gap-2">
            {s.loading ? <span className="text-muted-foreground">Controleren…</span>
              : !s.ok ? <span className="text-destructive">{s.error}</span>
              : upToDate ? <span className="font-semibold text-success">Up-to-date</span>
              : <span className="font-semibold text-unpublished">Update beschikbaar — vraag in dit project: “werk het CMS bij vanuit de master”.</span>}
            <Button variant="outline" size="sm" onClick={load} disabled={s.loading}><RefreshCw className="mr-1 h-4 w-4" />Opnieuw</Button>
          </div>
        </div>
        {sites.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Klantwebsites</p>
              <div className="flex gap-2"><Button variant="outline" size="sm" asChild><Link to="/smart-websites/sites"><LayoutGrid className="mr-1 h-4 w-4" />Volledig overzicht</Link></Button>
              <Button variant="outline" size="sm" onClick={copyPrompt}><Copy className="mr-1 h-4 w-4" />{copied ? 'Gekopieerd' : 'Kopieer update-opdracht'}</Button></div>
            </div>
            {sites.map(x => {
              const security = secVersion && compareVersions(x.version, secVersion) < 0;
              const behind = compareVersions(x.version, CMS_VERSION) < 0;
              return (
                <div key={x.host} className="flex items-center justify-between gap-2 border-t border-border pt-2">
                  <div><p className="font-medium">{x.site_name || x.host}</p><p className="text-muted-foreground">{x.host} · laatst gezien {new Date(x.last_seen).toLocaleDateString('nl-NL')}</p></div>
                  <span className={security ? 'font-semibold text-destructive' : behind ? 'font-semibold text-unpublished' : 'font-semibold text-success'}>
                    {x.version} · {security ? 'Beveiligingsupdate nodig' : behind ? 'Update beschikbaar' : 'Up-to-date'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-3">
          <p className="font-semibold">Laatste aanpassingen</p>
          {log.map(e => (
            <div key={e.version} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold">Versie {e.version}{e.security && <span className="ml-2 text-destructive">Beveiliging</span>} <span className="font-normal text-muted-foreground">· {e.date}</span></p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{e.changes.map(c => <li key={c}>{c}</li>)}</ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
