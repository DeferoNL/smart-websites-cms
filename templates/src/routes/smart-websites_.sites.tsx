import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, RefreshCw, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@defero/smart-websites-cms/src/components/ui/button.tsx';
import { Input } from '@defero/smart-websites-cms/src/components/ui/input.tsx';
import { CMS_VERSION, CHANGELOG, latestSecurityVersion } from '@defero/smart-websites-cms/src/cms/version.ts';
import { siteStatus, statsSchema, type SiteStatus, type SiteStats } from '@defero/smart-websites-cms/src/cms/site-report.ts';
import { updatePrompt } from '@defero/smart-websites-cms/src/cms/update-prompt.ts';
import { needsMfa } from '@defero/smart-websites-cms/src/cms/TwoFactor.tsx';

export const Route = createFileRoute('/smart-websites_/sites')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Smart Websites | Overzicht klantwebsites' },
      { name: 'description', content: 'Centraal overzicht van versies, updates en gebruikers van alle klantwebsites.' },
      { property: 'og:title', content: 'Smart Websites | Overzicht klantwebsites' },
      { property: 'og:description', content: 'Status van alle klantwebsites in één overzicht.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: SitesOverview,
});

type Row = { host: string; site_name: string | null; version: string; last_seen: string; stats: SiteStats | null; status: SiteStatus };
const LABEL: Record<SiteStatus, string> = { ok: 'Actueel', update: 'Update beschikbaar', security: 'Beveiligingsupdate nodig', silent: 'Geeft niets meer door' };
const TONE: Record<SiteStatus, string> = { ok: 'text-success', update: 'text-unpublished', security: 'text-destructive', silent: 'text-muted-foreground' };

function SitesOverview() {
  const [state, setState] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<SiteStatus | 'all'>('all');
  const [copied, setCopied] = useState(false);
  const sec = latestSecurityVersion(CHANGELOG);

  const load = async () => {
    setState('loading');
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || (await needsMfa())) { setState('denied'); return; }
    const { data: admin } = await supabase.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
    if (!admin) { setState('denied'); return; }
    const { data } = await supabase.from('cms_client_sites').select('host, site_name, version, last_seen, stats').order('host');
    setRows((data ?? []).map(r => {
      const p = statsSchema.safeParse(r.stats);
      return { ...r, stats: p.success ? p.data : null, status: siteStatus(r.version, r.last_seen, CMS_VERSION, sec) };
    }));
    setState('ready');
  };
  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    const c = { all: rows.length, ok: 0, update: 0, security: 0, silent: 0 };
    rows.forEach(r => { c[r.status]++; });
    return c;
  }, [rows]);
  const shown = rows.filter(r => (filter === 'all' || r.status === filter) && `${r.site_name ?? ''} ${r.host}`.toLowerCase().includes(q.toLowerCase()));
  const copy = () => void navigator.clipboard.writeText(updatePrompt()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('nl-NL') : '–');

  return (
    <div className="dark sw-admin min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/smart-websites" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Terug naar beheer</Link>
            <h1 className="mt-2 text-2xl font-semibold">Klantwebsites</h1>
            <p className="text-sm text-muted-foreground">Nieuwste versie {CMS_VERSION}{sec ? ` · minimaal veilige versie ${sec}` : ''}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 h-4 w-4" />Vernieuwen</Button>
            <Button variant="outline" size="sm" onClick={copy}><Copy className="mr-1 h-4 w-4" />{copied ? 'Gekopieerd' : 'Kopieer update-opdracht'}</Button>
          </div>
        </header>

        {state === 'loading' && <p className="text-muted-foreground">Laden…</p>}
        {state === 'denied' && <p>Alleen een beheerder van de Master kan dit overzicht bekijken. <Link to="/smart-websites" className="underline">Inloggen</Link></p>}
        {state === 'ready' && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(['all', 'ok', 'update', 'security', 'silent'] as const).map(k => (
                <button key={k} type="button" onClick={() => setFilter(k)}
                  className={`rounded-lg border p-4 text-left transition-colors ${filter === k ? 'border-cms-brand bg-cms-brand/10' : 'border-border hover:bg-muted/40'}`}>
                  <p className="text-xs text-muted-foreground">{k === 'all' ? 'Totaal' : LABEL[k]}</p>
                  <p className={`text-2xl font-semibold ${k === 'all' ? '' : TONE[k]}`}>{counts[k]}</p>
                </button>
              ))}
            </div>
            <Input placeholder="Zoek op naam of adres" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>{['Website', 'Versie', 'Status', 'Laatst gezien', 'Gebruikers', 'Beheerders', 'Zonder 2FA', 'Concepten', 'Laatst gepubliceerd', 'Ongelezen formulieren', 'Installatie'].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">Geen websites gevonden.</td></tr>}
                  {shown.map(r => {
                    const s = r.stats;
                    return (
                      <tr key={r.host} className="border-t border-border">
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.site_name || r.host}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <a href={`https://${r.host}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">{r.host}<ExternalLink className="h-3 w-3" /></a>
                            <Button variant="outline" size="sm" asChild>
                              <a href={`https://${r.host}/smart-websites`} target="_blank" rel="noopener noreferrer" aria-label={`CMS van ${r.site_name || r.host}`}><Settings className="h-3 w-3" />CMS</a>
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium">{r.version}</td>
                        <td className={`px-3 py-2 font-semibold ${TONE[r.status]}`}>{LABEL[r.status]}</td>
                        <td className="px-3 py-2">{date(r.last_seen)}</td>
                        {s ? (
                          <>
                            <td className="px-3 py-2">{s.users}</td>
                            <td className="px-3 py-2">{s.admins}</td>
                            <td className={`px-3 py-2 ${s.no_2fa > 0 ? 'font-semibold text-unpublished' : ''}`}>{s.no_2fa}</td>
                            <td className="px-3 py-2">{s.drafts}</td>
                            <td className="px-3 py-2">{date(s.last_publish)}</td>
                            <td className={`px-3 py-2 ${s.unread_forms > 0 ? 'font-semibold' : ''}`}>{s.unread_forms}</td>
                            <td className="px-3 py-2">{s.installed ? 'Afgerond' : <span className="text-unpublished">Open</span>}</td>
                          </>
                        ) : <td colSpan={7} className="px-3 py-2 text-muted-foreground">Meer gegevens na update naar 3.0.0</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
