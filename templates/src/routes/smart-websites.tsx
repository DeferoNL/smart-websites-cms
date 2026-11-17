import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Session } from '@supabase/supabase-js';
import { Eye, Pencil, Settings, Search, LogOut, Check, GripVertical, DatabaseBackup, Upload, Info, Copy, FolderOpen, MoreVertical, Trash2, AlertTriangle, Plus, ShieldCheck, ExternalLink, LifeBuoy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { pageList, menuName, isOriginalPage } from '@/site/website';
import { redirectMap } from '@defero/smart-websites-cms/src/lib/seo.functions.ts';
import { counterpart } from '@defero/smart-websites-cms/src/cms/translate-map.ts';
import { ADMIN_ROLE, PERMISSION_LABELS, BUILDER_PERMISSION_LABELS, defaultRolePermissions, roleAssignment, rolePermissionAllowed, type CmsRoleProfile } from '@defero/smart-websites-cms/src/cms/roles.ts';
import { translatePublished } from '@defero/smart-websites-cms/src/lib/translate.functions.ts';
import { SEO_AI_DAILY_LIMIT, TEXT_AI_DAILY_LIMIT } from '@defero/smart-websites-cms/src/cms/seo-ai.ts';
import { generateSeo } from '@defero/smart-websites-cms/src/lib/seo-ai.functions.ts';
import { WandSparkles, Loader2 } from 'lucide-react';
import { listUsers, inviteUser, setUserRole, removeUser } from '@defero/smart-websites-cms/src/lib/users.functions.ts';
import { getCmsSetup, requestCmsSetup } from '@defero/smart-websites-cms/src/lib/setup.functions.ts';
import { checkMfaReminder } from '@defero/smart-websites-cms/src/lib/mfa-reminder.functions.ts';
import { Button } from '@defero/smart-websites-cms/src/components/ui/button.tsx';
import { Input } from '@defero/smart-websites-cms/src/components/ui/input.tsx';
import { Label } from '@defero/smart-websites-cms/src/components/ui/label.tsx';
import { Textarea } from '@defero/smart-websites-cms/src/components/ui/textarea.tsx';
import { Checkbox } from '@defero/smart-websites-cms/src/components/ui/checkbox.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@defero/smart-websites-cms/src/components/ui/tabs.tsx';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@defero/smart-websites-cms/src/components/ui/dialog.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@defero/smart-websites-cms/src/components/ui/select.tsx';
import { MediaManager } from '@defero/smart-websites-cms/src/cms/MediaManager.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@defero/smart-websites-cms/src/components/ui/dropdown-menu.tsx';
import logo from '@/assets/smart-websites-logo.svg.asset.json';
import { MfaChallenge, MfaSettings, needsMfa } from '@defero/smart-websites-cms/src/cms/TwoFactor.tsx';
import { UserMenu, AccountDialog } from '@defero/smart-websites-cms/src/cms/AccountMenu.tsx';
import { StatsDialog } from '@defero/smart-websites-cms/src/cms/StatsDialog.tsx';
import { DnsDialog } from '@defero/smart-websites-cms/src/cms/DnsDialog.tsx';
import { BlockLibraryAdmin } from '@defero/smart-websites-cms/src/cms/BlockLibraryAdmin.tsx';
import { UpdatesDialog } from '@defero/smart-websites-cms/src/cms/UpdatesDialog.tsx';
import { useSiteDomain, siteUrlOf, normDomain } from '@defero/smart-websites-cms/src/cms/site-domain.ts';
import { activeLanguages, availableLanguages, publicPath, DEFAULT_SITE_LANGUAGES, shouldCreatePair, type SiteLanguages } from '@defero/smart-websites-cms/src/cms/languages.ts';

export const Route = createFileRoute('/smart-websites')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Smart Websites | Beheer' },
      { name: 'description', content: 'Beheeromgeving van Smart Websites voor pagina’s, teksten, foto’s en SEO.' },
      { property: 'og:title', content: 'Smart Websites | Beheer' },
      { property: 'og:description', content: 'Beheeromgeving voor pagina’s en SEO.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
    links: [{ rel: 'icon', type: 'image/png', href: '/smart-websites-favicon.png' }],
  }),
  component: Dashboard,
});

function Logo({ className = '' }: { className?: string }) {
  return <img src={logo.url} alt="Smart Websites" className={`sw-logo brightness-0 invert ${className}`} />;
}

function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [dnsOpen, setDnsOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mfaPending, setMfaPending] = useState<boolean | null>(null);
  useEffect(() => { if (!session) { setMfaPending(null); return; } void needsMfa().then(setMfaPending); }, [session]);
  const [tab, setTab] = useState('pages');
  const [publishing, setPublishing] = useState(false);
  const siteDomain = useSiteDomain();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<'admin' | 'editor' | 'none' | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  useEffect(() => { if (!role || role === 'none') { setPerms({}); return; } void supabase.rpc('my_perms').then(({ data }) => setPerms((data ?? {}) as Record<string, boolean>)); }, [role]);
  const can = (k: string) => rolePermissionAllowed(role === 'admin', perms, k);
  const [profileName, setProfileName] = useState('');
  useEffect(() => {
    setProfileName('');
    if (!session || role !== 'editor') return;
    void supabase.from('user_roles').select('cms_role_id').eq('user_id', session.user.id).maybeSingle().then(async ({ data }) => {
      if (!data?.cms_role_id) { setProfileName('Basic'); return; }
      const { data: profile } = await supabase.from('cms_roles').select('name').eq('id', data.cms_role_id).maybeSingle();
      setProfileName(profile?.name ?? 'Basic');
    });
  }, [session, role]);
  const [mfaMissing, setMfaMissing] = useState(false);
  const mfaCheck = useServerFn(checkMfaReminder);
  useEffect(() => {
    if (!role || role === 'none') { setMfaMissing(false); return; }
    void mfaCheck({ data: { origin: window.location.origin } }).then(r => setMfaMissing(r.missing)).catch(() => {});
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dashLang, setDashLang] = useState<'nl' | 'en'>('nl');
  const t = (nl: string, en: string) => (dashLang === 'en' ? en : nl);
  useEffect(() => {
    if (!role || role === 'none') return;
    void supabase.from('site_settings').select('dashboard_lang').eq('id', 1).maybeSingle().then(({ data }) => { if (data?.dashboard_lang === 'en') setDashLang('en'); });
  }, [role]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data: d }) => { setSession(d.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || mfaPending !== false) { setRole(null); return; }
    void (async () => {
      const { data: a } = await supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' });
      if (a) { setRole('admin'); return; }
      const { data: e } = await supabase.rpc('can_edit', { _user_id: session.user.id });
      setRole(e ? 'editor' : 'none');
    })();
  }, [session, mfaPending]);

  const publishAll = async () => {
    setPublishing(true);
    const { error } = await supabase.rpc('publish_all_drafts');
    setPublishing(false);
    if (error) toast.error('Publiceren mislukt: ' + error.message); else { toast.success('Alle concepten zijn gepubliceerd.'); window.dispatchEvent(new Event('sw-published')); }
  };

  return (
    <div className="dark sw-admin min-h-screen bg-background text-foreground">
      {!ready ? <p className="p-10">Laden…</p> : !session ? <Login /> : mfaPending !== false ? (mfaPending === null ? <p className="p-10">Laden…</p> : <MfaChallenge logo={<Logo className="mx-auto h-12" />} onDone={() => setMfaPending(false)} />) : (
        <div className="mx-auto max-w-6xl px-6 py-8">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Logo className="h-10" />
              {siteDomain && (
                <a href={siteUrlOf(siteDomain)} target="_blank" rel="noopener" title={t('Live website bekijken', 'View live website')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cms-brand/40 bg-cms-brand/10 px-3 py-1.5 text-sm font-medium text-cms-brand transition-colors hover:bg-cms-brand/20">
                  {siteDomain}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {role && role !== 'none' && <>
                <Button size="sm" variant="brand" disabled={publishing} onClick={() => void publishAll()}><Upload className="mr-1 h-4 w-4" />{t('Publiceren', 'Publish')}</Button>
                <Button size="icon" variant="outline" asChild title="Helpdesk"><a href="https://helpdesk.smart-websites.nl" target="_blank" rel="noopener noreferrer" aria-label="Helpdesk"><LifeBuoy className="h-4 w-4" /></a></Button>
                <Button size="icon" variant="outline" asChild title="Voorbeeld bekijken"><a href="/?cms=preview" target="_blank" rel="noopener" aria-label="Voorbeeld bekijken"><Eye className="h-4 w-4" /></a></Button>
              </>}
              <UserMenu session={session} role={role} profileName={profileName} can={can} t={t} onAccount={() => setAccountOpen(true)} onBackup={() => setBackupOpen(true)} onStats={() => setStatsOpen(true)} onDns={() => setDnsOpen(true)} onUpdates={() => setUpdatesOpen(true)} />
            </div>
          </header>
          {mfaMissing && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-cms-brand/40 bg-cms-brand/10 px-4 py-3 text-sm">
              <ShieldCheck className="h-5 w-5 shrink-0 text-cms-brand" />
              <p className="flex-1">{t('Je account is nog niet optimaal beveiligd. Stel tweestapsverificatie (2FA) in; dit is noodzakelijk voor een goede beveiliging.', 'Your account is not fully secured yet. Set up two-factor authentication (2FA); it is required for proper security.')}</p>
              <Button size="sm" variant="brand" onClick={() => setMfaOpen(true)}>{t('2FA nu instellen', 'Set up 2FA now')}</Button>
            </div>
          )}
          {role === null ? <p>Laden…</p> : role === 'none' ? (
            <p className="text-muted-foreground">Dit account heeft (nog) geen rechten. Vraag de beheerder om een uitnodiging.</p>
          ) : (
            <Tabs value={tab} onValueChange={value => { if (value === 'sites') { void router.navigate({ to: '/smart-websites/sites' }); } else { setTab(value); } }}>
              <TabsList className="h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="pages">{t("Pagina's", 'Pages')}</TabsTrigger>
                <TabsTrigger value="media" onClick={() => setMediaOpen(true)}>{t('Bestandsbeheer', 'File manager')}</TabsTrigger>
                {role === 'admin' && <TabsTrigger value="users">{t('Gebruikers & rollen', 'Users & roles')}</TabsTrigger>}
                {role === 'admin' && <TabsTrigger value="sites">{t('Klantwebsites', 'Client websites')}</TabsTrigger>}
                {can('settings') && <TabsTrigger value="settings">{t('Instellingen', 'Settings')}</TabsTrigger>}
                {can('activity') && <TabsTrigger value="activity">{t('Activiteit', 'Activity')}</TabsTrigger>}
                {can('forms') && <TabsTrigger value="forms">{t('Formulieren', 'Forms')}</TabsTrigger>}
              </TabsList>
              <TabsContent value="pages" className="mt-6"><Pages /></TabsContent>
              <TabsContent value="media" className="mt-6"><Button onClick={() => setMediaOpen(true)}>Bestandsbeheer openen</Button><MediaManager open={mediaOpen} onClose={() => { setMediaOpen(false); setTab('pages'); }} /></TabsContent>
              {role === 'admin' && <TabsContent value="users" className="mt-6"><Users /></TabsContent>}
              {can('settings') && <TabsContent value="settings" className="mt-6 space-y-6"><SiteSettings isAdmin onDashLang={setDashLang} onSaved={() => setTab('pages')} />{can('blocks') && <BlockLibraryAdmin />}</TabsContent>}
              {can('activity') && <TabsContent value="activity" className="mt-6"><ActivityLog /></TabsContent>}
              {can('forms') && <TabsContent value="forms" className="mt-6"><FormInbox /></TabsContent>}
            </Tabs>
          )}
          {mfaOpen && <MfaSettings onClose={() => { setMfaOpen(false); void supabase.auth.mfa.listFactors().then(({ data }) => setMfaMissing(!data?.totp.some(f => f.status === 'verified'))); }} />}
          {accountOpen && <AccountDialog session={session} onClose={() => setAccountOpen(false)} onMfa={() => { setAccountOpen(false); setMfaOpen(true); }} />}
          {backupOpen && can('backups') && <BackupDialog canRestore={can('restore')} onClose={() => setBackupOpen(false)} />}
          {dnsOpen && can('dns') && <DnsDialog onClose={() => setDnsOpen(false)} />}
          {updatesOpen && role === 'admin' && <UpdatesDialog onClose={() => setUpdatesOpen(false)} />}
          {statsOpen && can('stats') && <StatsDialog onClose={() => setStatsOpen(false)} />}
        </div>
      )}
    </div>
  );
}

type Backup = { id: string; created_at: string; created_by_email: string | null };

function BackupDialog({ canRestore, onClose }: { canRestore: boolean; onClose: () => void }) {
  const [list, setList] = useState<Backup[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from('site_backups').select('id, created_at, created_by_email').order('created_at', { ascending: false });
    setList(data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const make = async () => {
    if (list && list.length >= 3 && !window.confirm('Er zijn al 3 back-ups. De oudste wordt overschreven. Doorgaan?')) return;
    setBusy(true);
    const { error } = await supabase.rpc('create_site_backup');
    setBusy(false);
    if (error) toast.error('Back-up mislukt: ' + error.message); else { toast.success('Back-up gemaakt.'); void load(); }
  };
  const restore = async (b: Backup) => {
    if (!window.confirm(`De website terugzetten naar de back-up van ${new Date(b.created_at).toLocaleString('nl-NL')}? Alle huidige wijzigingen worden vervangen.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('restore_site_backup', { _id: b.id });
    setBusy(false);
    if (error) toast.error('Terugplaatsen mislukt: ' + error.message); else { void supabase.rpc('log_audit', { _action: 'Back-up teruggezet', _target: new Date(b.created_at).toLocaleString('nl-NL') }); toast.success('Back-up teruggeplaatst.'); setTimeout(() => window.location.reload(), 800); }
  };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin max-w-lg bg-background text-foreground">
        <DialogHeader><DialogTitle>Back-ups</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Een back-up bewaart alle teksten, foto's en pagina-instellingen. Er worden maximaal 3 back-ups bewaard; een nieuwe overschrijft de oudste.{!canRestore && ' Alleen Administrator en Webbouwer kunnen een back-up terugplaatsen.'}</p>
        <div className="divide-y divide-border rounded-lg border border-border">
          {!list ? <p className="p-4 text-sm">Laden…</p> : list.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nog geen back-ups.</p> : list.map(b => (
            <div key={b.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>{new Date(b.created_at).toLocaleString('nl-NL')}<span className="block text-xs text-muted-foreground">{b.created_by_email}</span></span>
              {canRestore && <Button size="sm" variant="outline" disabled={busy} onClick={() => void restore(b)}>Terugplaatsen</Button>}
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Sluiten</Button><Button disabled={busy} onClick={() => void make()}>Nieuwe back-up maken</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Login() {
  const checkSetup = useServerFn(getCmsSetup);
  const requestSetup = useServerFn(requestCmsSetup);
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [setupSent, setSetupSent] = useState(false);
  useEffect(() => { void checkSetup().then(setSetupAvailable).catch(() => setSetupAvailable(false)); }, [checkSetup]);
  const startSetup = async () => {
    setBusy(true);
    try { await requestSetup(); setSetupSent(true); setSetupAvailable(false); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Installatie aanvragen mislukt.'); }
    finally { setBusy(false); }
  };
  const [mode, setMode] = useState<'in' | 'forgot'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error('Inloggen mislukt. Controleer je e-mail en wachtwoord.');
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) toast.error(error.message); else toast.success('Als dit adres bekend is, ontvang je een e-mail met een link.');
    }
    setBusy(false);
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8 shadow-lg">
        <Logo className="mx-auto h-12" />
        {setupAvailable && <div className="space-y-3 border-b border-border pb-5"><h2 className="font-semibold">Eerste beheerder instellen</h2><Button type="button" variant="brand" disabled={busy} onClick={() => void startSetup()} className="w-full">Beveiligde uitnodiging aanvragen</Button></div>}
        {setupSent && <p role="status" className="text-sm text-muted-foreground">De uitnodiging is verstuurd naar het vooraf vastgelegde beheerdersadres. Open de e-mail om je wachtwoord in te stellen.</p>}
        <h1 className="text-center text-lg font-semibold">{mode === 'in' ? 'Inloggen' : 'Wachtwoord vergeten'}</h1>
        <div className="space-y-1"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        {mode === 'in' && <div className="space-y-1"><Label htmlFor="pw">Wachtwoord</Label><Input id="pw" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>}
        <Button type="submit" disabled={busy} className="w-full">{mode === 'in' ? 'Inloggen' : 'Stuur link'}</Button>
        <button type="button" className="block w-full text-center text-sm text-muted-foreground underline" onClick={() => setMode(mode === 'in' ? 'forgot' : 'in')}>
          {mode === 'in' ? 'Wachtwoord vergeten?' : 'Terug naar inloggen'}
        </button>
        <p className="text-center text-xs text-muted-foreground">Toegang alleen op uitnodiging.</p>
      </form>
    </div>
  );
}

type PageRow = {
  path: string; defaultName: string; origTitle: string; origDescription: string;
  name: string; hidden: boolean; disabled: boolean; deleted: boolean; hideInSearch: boolean; encrypted: boolean;
  order: number | null; parent: string | null; urlParent: string | null;
  title: string; description: string; keywords: string; canonical: string; redirects: string;
  ogTitle: string; ogDescription: string; ogImage: string;
  noindex: boolean; nofollow: boolean; updatedAt: string | null; unpublished?: boolean;
};

const urlParentOf = (path: string) => { const s = path.split('/').filter(Boolean); return s.length > 2 ? '/' + s.slice(0, -1).join('/') : null; };

/** Flattens rows into display order: siblings sorted by order (fallback original index), children under parent. */
function flattenPages<T extends { path: string; parent: string | null; order: number | null }>(rows: T[]): (T & { depth: number })[] {
  const idx = new Map(rows.map((r, i) => [r.path, i]));
  const exists = new Set(rows.map(r => r.path));
  const kids = (p: string | null) => rows.filter(r => (r.parent && exists.has(r.parent) ? r.parent : null) === p)
    .sort((a, b) => (a.order ?? 1000 + idx.get(a.path)!) - (b.order ?? 1000 + idx.get(b.path)!));
  const out: (T & { depth: number })[] = [];
  const walk = (p: string | null, d: number) => { for (const r of kids(p)) { if (out.some(o => o.path === r.path)) continue; out.push({ ...r, depth: d }); walk(r.path, d + 1); } };
  walk(null, 0);
  return out;
}

function Pages() {
  const [siteLanguages, setSiteLanguages] = useState<SiteLanguages>(DEFAULT_SITE_LANGUAGES);
  const [lang, setLang] = useState<'nl' | 'en'>('nl');
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState<PageRow[] | null>(null);
  const [open, setOpen] = useState<PageRow | null>(null);
  const [del, setDel] = useState<PageRow | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ path: string; pos: 'before' | 'after' | 'inside' } | null>(null);
  const [mayPages, setMayPages] = useState(false);
  const [create, setCreate] = useState<{ source: PageRow | null } | null>(null);
  useEffect(() => { void supabase.rpc('my_perms').then(({ data }) => setMayPages(Boolean((data as { pages?: boolean } | null)?.pages))); }, []);

  const load = useCallback(async () => {
    const [{ data: seo }, { data: set }, { data: custom }, { data: languageSettings }, { data: contentRows }] = await Promise.all([
      supabase.from('page_seo').select('*'),
      supabase.from('page_settings').select('*'),
      supabase.from('custom_pages').select('path, source_path').order('created_at'),
      supabase.from('site_settings').select('default_lang, languages').eq('id', 1).maybeSingle(),
      supabase.from('page_content').select('path, state, data, layout'),
    ]);
    const languageConfig = languageSettings ?? DEFAULT_SITE_LANGUAGES;
    setSiteLanguages(languageConfig);
    setLang(current => activeLanguages(languageConfig).includes(current) ? current : languageConfig.default_lang === 'en' ? 'en' : 'nl');
    const moved = new Set(Object.keys(redirectMap((seo ?? []).map(r => ({ path: r.path, redirects: r.redirects })))));
    const all = [...pageList.filter(p => !moved.has(p.path)), ...(custom ?? []).map(c => { const src = pageList.find(p => p.path === c.source_path); return { path: c.path, title: src?.title ?? '', description: src?.description ?? '' }; })];
    setRows(all.map(p => {
      const s = seo?.find(r => r.path === p.path); const g = set?.find(r => r.path === p.path);
      const isEn = p.path.startsWith('/en'); const up = urlParentOf(p.path);
      return {
        path: p.path, defaultName: pageList.some(o => o.path === p.path) ? menuName(p.path) : (p.path.split('/').pop() ?? p.path).replace(/-/g, ' '), origTitle: p.title, origDescription: p.description,
        name: (isEn ? g?.name_en : g?.name_nl) ?? '', hidden: g?.hidden_in_menu ?? false,
        disabled: g?.disabled ?? false, deleted: g?.deleted ?? false, hideInSearch: g?.hide_in_search ?? false, encrypted: g?.encrypted_url ?? false,
        order: g?.sort_order ?? null, parent: g ? (g.parent_path === null ? up : g.parent_path || null) : up, urlParent: up,
        title: s?.title ?? '', description: s?.description ?? '', keywords: s?.keywords ?? '', canonical: s?.canonical ?? '', redirects: s?.redirects ?? '',
        ogTitle: s?.og_title ?? '', ogDescription: s?.og_description ?? '', ogImage: s?.og_image ?? '',
        noindex: s?.noindex ?? false, nofollow: s?.nofollow ?? false,
        updatedAt: [s?.updated_at, g?.updated_at].filter(Boolean).sort().pop() ?? null,
        unpublished: (() => {
          const d = contentRows?.find(c => c.path === p.path && c.state === 'draft');
          if (!d) return false;
          const pub = contentRows?.find(c => c.path === p.path && c.state === 'published');
          return !pub || JSON.stringify(d.data) !== JSON.stringify(pub.data) || JSON.stringify(d.layout) !== JSON.stringify(pub.layout);
        })(),
      };
    }));
  }, []);
  useEffect(() => { const f = () => { void load(); }; window.addEventListener('sw-published', f); return () => window.removeEventListener('sw-published', f); }, [load]);
  useEffect(() => { void load(); }, [load]);

  const tree = useMemo(() => flattenPages((rows ?? []).filter(r => r.path.startsWith(`/${lang}`) && !r.deleted)), [rows, lang]);
  const languageChoices = availableLanguages(siteLanguages, (rows ?? []).filter(r => !r.deleted).map(r => r.path));
  useEffect(() => {
    if (languageChoices.length && !languageChoices.includes(lang)) setLang(languageChoices[0] === 'en' ? 'en' : 'nl');
  }, [languageChoices.join(','), lang]);
  const shown = useMemo(() => tree.filter(r => (r.name || r.defaultName).toLowerCase().includes(filter.toLowerCase())), [tree, filter]);

  const isDescendant = (child: string, anc: string): boolean => {
    let p = rows?.find(r => r.path === child)?.parent ?? null; let guard = 0;
    while (p && guard++ < 20) { if (p === anc) return true; p = rows?.find(r => r.path === p)?.parent ?? null; }
    return false;
  };

  const doDrop = async () => {
    if (!rows || !drag || !drop || drag === drop.path || isDescendant(drop.path, drag)) { setDrag(null); setDrop(null); return; }
    const target = rows.find(r => r.path === drop.path)!;
    const newParent = drop.pos === 'inside' ? target.path : target.parent;
    const siblings = tree.filter(r => r.parent === newParent && r.path !== drag).map(r => r.path);
    let at = drop.pos === 'inside' ? siblings.length : siblings.indexOf(target.path) + (drop.pos === 'after' ? 1 : 0);
    if (at < 0) at = siblings.length;
    siblings.splice(at, 0, drag);
    setDrag(null); setDrop(null);
    const next = rows.map(r => r.path === drag ? { ...r, parent: newParent } : r).map(r => { const i = siblings.indexOf(r.path); return i >= 0 ? { ...r, order: i } : r; });
    setRows(next);
    const { data: u } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const { error } = await supabase.from('page_settings').upsert(siblings.map((p, i) => {
      const r = next.find(x => x.path === p)!;
      return { path: p, sort_order: i, parent_path: r.parent === r.urlParent && r.parent === null ? null : (r.parent ?? ''), hidden_in_menu: r.hidden, updated_at: now, updated_by: u.user?.id ?? null };
    }));
    if (error) { toast.error('Volgorde opslaan mislukt: ' + error.message); void load(); } else toast.success('Volgorde opgeslagen.');
  };

  if (!rows) return <p>Laden…</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {languageChoices.length > 1 && <div className="flex gap-1 rounded-md border border-border p-1">
          {(['nl', 'en'] as const).filter(l => languageChoices.includes(l)).map(l => (
            <Button key={l} size="sm" variant={lang === l ? 'default' : 'ghost'} onClick={() => setLang(l)}>{l.toUpperCase()}</Button>
          ))}
        </div>}
        <div className="relative w-64">
          <Input className="rounded-xl pr-9" placeholder="Zoeken" value={filter} onChange={e => setFilter(e.target.value)} />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
      {mayPages && <div className="mb-4"><Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setCreate({ source: null })}><Plus className="mr-1 h-4 w-4" />Nieuwe pagina</Button></div>}
      <p className="mb-3 text-xs text-muted-foreground">Sleep een pagina aan de puntjes om de volgorde te wijzigen. Laat los midden op een andere pagina om er een subpagina van te maken.</p>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[32px_1fr_120px_150px_170px] gap-2 border-b border-border bg-card px-4 py-3 text-sm font-semibold">
          <span /><span>Naam</span><span className="text-center">Uitgeschakeld</span><span className="text-center">Verborgen in menu's</span><span />
        </div>
        {shown.map(r => {
          const d = drop?.path === r.path ? drop.pos : null;
          return (
            <div key={r.path}
              draggable={!filter && mayPages}
              onDragStart={e => { setDrag(r.path); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => { setDrag(null); setDrop(null); }}
              onDragOver={e => { if (!drag) return; e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); const y = (e.clientY - b.top) / b.height; setDrop({ path: r.path, pos: y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside' }); }}
              onDrop={e => { e.preventDefault(); void doDrop(); }}
              className={`grid grid-cols-[32px_1fr_120px_150px_170px] items-center gap-2 border-b border-border px-4 py-3 last:border-0 hover:bg-accent/40 ${drag === r.path ? 'opacity-40' : ''} ${d === 'before' ? 'border-t-2 border-t-primary' : ''} ${d === 'after' ? 'border-b-2 border-b-primary' : ''} ${d === 'inside' ? 'bg-primary/15' : ''}`}>
              <span className="cursor-grab text-muted-foreground" aria-label="Verslepen"><GripVertical className="h-4 w-4" /></span>
              <span className="flex items-center gap-2" style={{ paddingLeft: r.depth * 28 }}>
                <Button asChild variant="link" className="h-auto justify-start whitespace-normal p-0 text-left text-foreground"><a href={`${publicPath(r.path)}?cms=edit`}>{r.name || r.defaultName}</a></Button>
                {r.unpublished && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-unpublished shadow-[0_0_8px_var(--unpublished)]" title="Niet-gepubliceerde wijzigingen" aria-label="Niet-gepubliceerde wijzigingen" />}
                <span className="text-xs text-muted-foreground">{publicPath(r.path)}</span>
              </span>
              <span className="flex justify-center">{r.disabled && <Check className="h-4 w-4 text-primary" aria-label="Uitgeschakeld" />}</span>
              <span className="flex justify-center">{(r.hidden || r.encrypted) && <Check className="h-4 w-4 text-primary" aria-label="Verborgen in menu" />}</span>
              <span className="flex justify-end gap-1">
                <Button size="icon" variant="ghost" asChild title="Bewerken"><a href={`${publicPath(r.path)}?cms=edit`} aria-label={`Bewerk ${publicPath(r.path)}`}><Pencil className="h-4 w-4" /></a></Button>
                <Button size="icon" variant="ghost" title="Pagina-instellingen" aria-label={`Instellingen ${r.path}`} onClick={() => setOpen(r)}><Settings className="h-4 w-4" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" title="Meer opties" aria-label={`Meer opties ${r.path}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="dark sw-admin bg-background text-foreground">
                    <DropdownMenuItem disabled={!mayPages} onSelect={() => setCreate({ source: r })}><Copy className="mr-2 h-4 w-4" />Kopiëren</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" disabled={!mayPages} onSelect={() => setDel(r)}><Trash2 className="mr-2 h-4 w-4" />Verwijderen</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </div>
          );
        })}
      </div>
      {create && <NewPageDialog lang={lang} siteLanguages={siteLanguages} source={create.source} taken={(rows ?? []).map(r => r.path)} onClose={() => setCreate(null)} onDone={() => { setCreate(null); void load(); }} />}
      {del && <DeleteDialog row={del} onClose={() => setDel(null)} onDone={() => { setDel(null); void load(); }} />}
      {open && <SettingsDialog row={open} all={tree} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} />}
    </div>
  );
}

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** New empty page (header/footer only, add blocks yourself) or a copy of an existing page incl. texts, photos and blocks. */
function NewPageDialog({ lang, siteLanguages, source, taken, onClose, onDone }: { lang: 'nl' | 'en'; siteLanguages: SiteLanguages; source: PageRow | null; taken: string[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(source ? `${source.name || source.defaultName} (kopie)` : '');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const l = source ? (source.path.startsWith('/en') ? 'en' : 'nl') : lang;
  const finalSlug = slugify(slug || name);
  const path = `/${l}/${finalSlug}`;
  const clash = taken.includes(path);
  const go = async () => {
    if (!finalSlug || clash) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null; const now = new Date().toISOString();
    const other = l === 'nl' ? 'en' : 'nl';
    const { data: cp } = source ? await supabase.from('custom_pages').select('source_path, pair_path').eq('path', source.path).maybeSingle() : { data: null };
    const origin = source ? (cp?.source_path ?? source.path) : `/${l}`;
    // Only create a counterpart when that language is enabled for this site.
    const pairPath = `/${other}/${finalSlug}`;
    const pairEnabled = shouldCreatePair(other, siteLanguages);
    const makePair = pairEnabled && !taken.includes(pairPath);
    const pairSource = source ? (cp ? (cp.pair_path ?? null) : counterpart(source.path, other)) : `/${other}`;
    const { data: pcp } = pairSource && !isOriginalPage(pairSource) ? await supabase.from('custom_pages').select('source_path').eq('path', pairSource).maybeSingle() : { data: null };
    const pairOrigin = pcp?.source_path ?? (pairSource && isOriginalPage(pairSource) ? pairSource : `/${other}`);
    const { error } = await supabase.from('custom_pages').insert([
      { path, source_path: origin, created_by: uid, pair_path: makePair ? pairPath : null },
      ...(makePair ? [{ path: pairPath, source_path: pairOrigin, created_by: uid, pair_path: path }] : []),
    ]);
    if (error) { setBusy(false); toast.error('Aanmaken mislukt: ' + error.message); return; }
    const contentOf = async (from: string | null) => {
      if (!from) return (['draft', 'published'] as const).map(state => ({ state, data: {} as never, layout: [] as never }));
      const { data } = await supabase.from('page_content').select('state, data, layout').eq('path', from);
      return (data ?? []) as { state: string; data: never; layout: never }[];
    };
    const rows = [
      ...(await contentOf(source?.path ?? null)).map(c => ({ ...c, path })),
      ...(makePair ? (await contentOf(source ? pairSource : null)).map(c => ({ ...c, path: pairPath })) : []),
    ];
    const r1 = rows.length ? await supabase.from('page_content').upsert(rows.map(c => ({ path: c.path, state: c.state, data: c.data, layout: c.layout, updated_at: now, updated_by: uid }))) : { error: null };
    const label = name.trim() || finalSlug;
    const r2 = await supabase.from('page_settings').upsert([
      { path, ...(l === 'en' ? { name_en: label } : { name_nl: label }), hidden_in_menu: false, updated_at: now, updated_by: uid },
      ...(makePair ? [{ path: pairPath, ...(other === 'en' ? { name_en: label } : { name_nl: label }), hidden_in_menu: false, updated_at: now, updated_by: uid }] : []),
    ]);
    if (source && makePair) void translatePublished({ data: { path } }).catch(() => undefined);
    if (pairEnabled && !makePair) toast.message(`De ${other.toUpperCase()}-versie ${pairPath} bestond al en is niet opnieuw aangemaakt.`);
    setBusy(false);
    if (r1.error || r2.error) toast.error('Pagina aangemaakt, maar niet alles is overgenomen: ' + (r1.error ?? r2.error)!.message);
    else toast.success(source ? 'Pagina gekopieerd.' : 'Pagina aangemaakt.');
    onDone();
  };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin max-w-md bg-background text-foreground">
        <DialogHeader><DialogTitle>{source ? `Pagina kopiëren — ${source.name || source.defaultName}` : 'Nieuwe pagina'}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{source ? 'De kopie krijgt alle teksten, foto\'s en blokken van het origineel.' : 'De nieuwe pagina krijgt de kop en voet van de website. Voeg daarna blokken toe via Bewerken.'}</p>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); void go(); }}>
          <div className="space-y-1"><Label htmlFor="np-name">Paginanaam</Label><Input id="np-name" required value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="np-slug">URL</Label><Input id="np-slug" placeholder={slugify(name)} value={slug} onChange={e => setSlug(e.target.value)} />
            <p className={`text-xs ${clash ? 'text-destructive' : 'text-muted-foreground'}`}>{clash ? 'Deze URL bestaat al.' : publicPath(path)}</p></div>
          <DialogFooter className="gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuleren</Button>
            <Button type="submit" className="bg-success text-success-foreground hover:bg-success/90" disabled={busy || !finalSlug || clash}>{source ? 'Kopiëren' : 'Aanmaken'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ row, onClose, onDone }: { row: PageRow; onClose: () => void; onDone: () => void }) {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = word.trim().toLowerCase() === 'verwijderen';
  const go = async () => {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('page_settings').upsert({ path: row.path, deleted: true, hidden_in_menu: true, updated_at: new Date().toISOString(), updated_by: u.user?.id ?? null });
    setBusy(false);
    if (error) { toast.error('Verwijderen mislukt: ' + error.message); return; }
    toast.success('Pagina verwijderd.'); onDone();
  };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin max-w-md bg-background text-foreground">
        <DialogHeader><DialogTitle>Pagina verwijderen — {row.name || row.defaultName}</DialogTitle></DialogHeader>
        <div className="flex gap-3 rounded-xl border border-destructive/60 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div><p className="font-semibold">Let op: dit kun je niet ongedaan maken.</p><p className="mt-1">Heb je een back-up gemaakt? Zonder back-up kun je deze pagina niet meer terugzetten. Bezoekers krijgen op dit adres een "pagina niet gevonden".</p></div>
        </div>
        <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (ok) void go(); }}>
          <Label htmlFor="del-word">Typ <strong>verwijderen</strong> om te bevestigen</Label>
          <Input id="del-word" autoComplete="off" value={word} onChange={e => setWord(e.target.value)} />
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuleren</Button>
            <Button type="submit" variant="destructive" disabled={!ok || busy}>Verwijderen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, help }: { label: string; children: ReactNode; help?: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
      <Label className="pt-2">{label}</Label>
      <div className="space-y-1">{children}{help && <div className="text-xs text-muted-foreground">{help}</div>}</div>
    </div>
  );
}
function Lang({ code, children }: { code: string; children: ReactNode }) {
  return <div className="flex overflow-hidden rounded-md border border-input"><span className="flex items-center border-r border-input bg-muted px-3 text-sm">{code}</span><div className="flex-1 [&_input]:rounded-none [&_input]:border-0 [&_textarea]:rounded-none [&_textarea]:border-0">{children}</div></div>;
}
function AiWand({ show, field, row, onText }: { show: boolean; field: 'title' | 'description' | 'keywords'; row: PageRow; onText: (t: string) => void }) {
  const gen = useServerFn(generateSeo);
  const [busy, setBusy] = useState(false);
  if (!show) return null;
  const run = async () => {
    setBusy(true);
    try {
      const html = await fetch(publicPath(row.path)).then(r => r.text()).catch(() => '');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, header, nav, footer').forEach(e => e.remove());
      const text = (doc.querySelector('main, .page') ?? doc.body)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const r = await gen({ data: { field, path: publicPath(row.path), lang: row.path.startsWith('/en') ? 'en' : 'nl', name: row.name || row.defaultName, text } });
      onText(r.text);
      toast.success(`Suggestie ingevuld. Nog ${r.remaining} vandaag.`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return <button type="button" title="Genereer met AI" aria-label="Genereer met AI" disabled={busy} onClick={() => void run()} className="absolute right-2 top-2 rounded p-1 text-primary hover:bg-accent disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}</button>;
}
function Box({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return <Field label={label} help={help}><Checkbox className="mt-2" checked={checked} onCheckedChange={v => onChange(v === true)} aria-label={label} /></Field>;
}

function SettingsDialog({ row, all, onClose, onSaved }: { row: PageRow; all: (PageRow & { depth: number })[]; onClose: () => void; onSaved: () => void }) {
  const SITE = siteUrlOf(useSiteDomain());
  const [r, setR] = useState(row);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  const [ai, setAi] = useState(false);
  useEffect(() => { void (async () => {
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    const [{ data: adm }, { data: st }] = await Promise.all([supabase.rpc('has_role', { _user_id: u.user.id, _role: 'admin' }), supabase.from('site_settings').select('seo_ai_enabled').eq('id', 1).maybeSingle()]);
    setAi(Boolean(adm || st?.seo_ai_enabled));
  })(); }, []);
  const isEn = r.path.startsWith('/en'); const L = isEn ? 'EN' : 'NL';
  const title = r.title || r.origTitle; const desc = r.description || r.origDescription;
  const up = (p: Partial<PageRow>) => setR({ ...r, ...p });
  const isHome = row.path === '/nl' || row.path === '/en';
  const [slug, setSlug] = useState(row.path.split('/').pop() ?? '');
  const save = async () => {
    setBusy(true);
    const newPath = `/${isEn ? 'en' : 'nl'}/${slugify(slug)}`;
    if (!isHome && slugify(slug) && newPath !== row.path) {
      const { error } = await supabase.rpc('rename_custom_page', { _old: row.path, _new: newPath });
      if (error) { setBusy(false); toast.error('URL wijzigen mislukt: ' + error.message); return; }
      r.redirects = [r.redirects.trim(), row.path].filter(Boolean).join('\n');
      r.path = newPath;
    }
    const { data: u } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const n = (v: string) => v.trim() || null;
    const [a, b] = await Promise.all([
      supabase.from('page_seo').upsert({ path: r.path, title: n(r.title), description: n(r.description), keywords: n(r.keywords), canonical: n(r.canonical), redirects: n(r.redirects), og_title: n(r.ogTitle), og_description: n(r.ogDescription), og_image: n(r.ogImage), noindex: r.noindex, nofollow: r.nofollow, updated_at: now }),
      supabase.from('page_settings').upsert({ path: r.path, ...(isEn ? { name_en: n(r.name) } : { name_nl: n(r.name) }), hidden_in_menu: r.hidden, disabled: r.disabled, hide_in_search: r.hideInSearch, encrypted_url: r.encrypted, parent_path: r.parent === r.urlParent && r.parent === null ? null : (r.parent ?? ''), updated_at: now, updated_by: u.user?.id ?? null }),
    ]);
    setBusy(false);
    const err = a.error ?? b.error;
    if (err) { toast.error('Opslaan mislukt: ' + err.message); return; }
    toast.success('Pagina-instellingen opgeslagen.');
    onSaved();
  };
  const url = `${SITE}${publicPath(r.path)}`;
  const others = all.filter(p => p.path !== r.path);
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin sw-page-settings max-h-[90vh] max-w-3xl overflow-y-auto bg-background text-foreground">
        <DialogHeader><DialogTitle>Pagina-instellingen — {r.name || r.defaultName}</DialogTitle></DialogHeader>
        <Tabs defaultValue="general">
          <TabsList><TabsTrigger value="general">Basis & URL</TabsTrigger><TabsTrigger value="seo">Zoekmachines</TabsTrigger><TabsTrigger value="share">Sociale media</TabsTrigger></TabsList>
          <TabsContent value="general" className="mt-4 space-y-5 rounded-lg border border-border bg-card p-5">
            <Field label="Paginanaam"><Lang code={L}><Input placeholder={r.defaultName} value={r.name} onChange={e => up({ name: e.target.value })} /></Lang></Field>
            <Field label="Bovenliggende pagina">
              <Select value={r.parent ?? '__none'} onValueChange={v => up({ parent: v === '__none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecteer een optie" /></SelectTrigger>
                <SelectContent><SelectItem value="__none">Geen (hoofdniveau)</SelectItem>{others.map(p => <SelectItem key={p.path} value={p.path}>{'— '.repeat(p.depth)}{p.name || p.defaultName}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="URL" help={!isHome ? <>{SITE.replace('https://', '')}{publicPath(`/${isEn ? 'en' : 'nl'}/${slugify(slug) || '…'}`)}<br />Alleen kleine letters, cijfers en streepjes. Het oude adres stuurt bezoekers en Google automatisch door (301) naar het nieuwe adres.</> : <>{SITE.replace('https://', '')}{publicPath(r.path)}<br />De URL van de homepage kan niet worden gewijzigd.</>}><Lang code={L}>{!isHome ? <Input value={slug} onChange={e => setSlug(e.target.value)} aria-label="URL" /> : <Input value={publicPath(r.path)} readOnly />}</Lang></Field>
            <Field label="301 redirect" help="Vul de oude URL in wanneer deze afwijkt van de nieuwe URL. Gebruik een nieuwe regel voor meerdere URL's."><Lang code={L}><Textarea placeholder="/oude-pagina/" value={r.redirects} onChange={e => up({ redirects: e.target.value })} /></Lang></Field>
            <h3 className="border-t border-border pt-5 text-sm font-semibold">Navigatie & zichtbaarheid</h3>
            <Box label="Uitschakelen" checked={r.disabled} onChange={v => up({ disabled: v })} help="Als dit is aangevinkt, verdwijnt de pagina uit het menu en wordt hij niet geïndexeerd door zoekmachines." />
            <Box label="Verbergen in menu's" checked={r.hidden} onChange={v => up({ hidden: v })} />
            <Box label="Verbergen in zoekresultaten" checked={r.hideInSearch} onChange={v => up({ hideInSearch: v })} help="Als dit is aangevinkt, wordt de pagina niet getoond in de resultaten van het zoekformulier." />
            <Box label="Versleutelde URL" checked={r.encrypted} onChange={v => up({ encrypted: v })} help="Als dit is aangevinkt, wordt de pagina niet geïndexeerd, de links op de pagina worden niet gevolgd door zoekmachines en de pagina wordt uitgesloten van het menu en de zoekresultaten." />
            <Field label="Laatst gewijzigd"><p className="pt-2 text-sm">{r.updatedAt ? new Date(r.updatedAt).toLocaleString('nl-NL') : 'Nog niet gewijzigd'}</p></Field>
          </TabsContent>
          <TabsContent value="seo" className="mt-4 space-y-5 rounded-lg border border-border bg-card p-5">
            <Field label="Zoekresultaattitel" help={<>Tekens: {title.length}<br />Vul alleen een meta titel in wanneer deze afwijkt van de paginanaam. Gebruik 41-60 tekens voor een optimale weergave in zoekmachines.</>}><Lang code={L}><div className="relative"><Input className="pr-10" placeholder={r.origTitle} value={r.title} onChange={e => up({ title: e.target.value })} /><AiWand show={ai} field="title" row={r} onText={t => up({ title: t })} /></div></Lang></Field>
            <Field label="Zoekresultaatomschrijving" help={<>Tekens: {desc.length}<br />Gebruik 126-155 tekens voor een optimale weergave in zoekmachines.</>}><Lang code={L}><div className="relative"><Textarea className="pr-10" placeholder={r.origDescription} value={r.description} onChange={e => up({ description: e.target.value })} /><AiWand show={ai} field="description" row={r} onText={t => up({ description: t })} /></div></Lang></Field>
            <Field label="Canonical" help="Vul alleen een canonical in wanneer deze afwijkt van de huidige pagina.">
              <Select value={r.canonical || '__none'} onValueChange={v => up({ canonical: v === '__none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none">Geen</SelectItem>{others.map(p => <SelectItem key={p.path} value={`${SITE}${publicPath(p.path)}`}>{p.name || p.defaultName}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Box label="Noindex" checked={r.noindex} onChange={v => up({ noindex: v })} help="Als dit is aangevinkt, wordt de pagina niet geïndexeerd door zoekmachines." />
            <Box label="Nofollow" checked={r.nofollow} onChange={v => up({ nofollow: v })} help="Als dit is aangevinkt, worden de links op de pagina niet gevolgd door zoekmachines." />
            <div className="border-l-2 border-cms-brand pl-4 py-2">
              <p className="mb-1 text-xs text-muted-foreground">Voorbeeld in Google</p>
              <p className="text-xs text-muted-foreground">{url}</p>
              <p className="break-words text-lg text-cms-brand">{title}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          </TabsContent>
          <TabsContent value="share" className="mt-4 space-y-4">
            <div className="space-y-5">
              <Field label="URL"><p className="flex items-center gap-2 pt-2 text-sm">{L} <a className="underline" href={url} target="_blank" rel="noopener noreferrer">{url}</a><button type="button" aria-label="Kopiëren" onClick={() => { void navigator.clipboard.writeText(url); toast.success('Gekopieerd'); }}><Copy className="h-4 w-4" /></button></p></Field>
              <Field label="Titel" help="Vul alleen een titel in wanneer deze afwijkt van de meta titel."><Lang code={L}><div className="relative"><Input className="pr-10" placeholder={title} value={r.ogTitle} onChange={e => up({ ogTitle: e.target.value })} /><AiWand show={ai} field="title" row={r} onText={t => up({ ogTitle: t })} /></div></Lang></Field>
              <Field label="Omschrijving" help="Vul alleen een omschrijving in wanneer deze afwijkt van de meta omschrijving."><Lang code={L}><div className="relative"><Input className="pr-10" placeholder={desc} value={r.ogDescription} onChange={e => up({ ogDescription: e.target.value })} /><AiWand show={ai} field="description" row={r} onText={t => up({ ogDescription: t })} /></div></Lang></Field>
              <Field label="Afbeelding" help="Aanbevolen is het bestandstype JPG of PNG, een maximale bestandsgrootte van 300 kB en een minimale afmeting van 300×200 pixels.">
                <div className="flex gap-2"><Input value={r.ogImage} onChange={e => up({ ogImage: e.target.value })} /><Button type="button" variant="outline" size="icon" aria-label="Kies afbeelding" onClick={() => setPick(true)}><FolderOpen className="h-4 w-4" /></Button></div>
                {r.ogImage && <img src={r.ogImage} alt="" className="mt-2 h-24 rounded border border-border object-cover" />}
              </Field>
            </div>
          </TabsContent>

        </Tabs>
        <DialogFooter className="gap-3 sm:gap-3">
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button disabled={busy} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => void save()}>Opslaan</Button>
        </DialogFooter>
        <MediaManager open={pick} onClose={() => setPick(false)} onInsert={u => { up({ ogImage: u.startsWith('http') ? u : `${SITE}${u}` }); setPick(false); }} />
      </DialogContent>
    </Dialog>
  );
}

type UserRow = { id: string; email: string; role: 'admin' | 'editor' | null; cmsRoleId: string | null; confirmed: boolean; mfa: boolean; self: boolean };
type CmsRole = CmsRoleProfile;
const DEFAULT_PERMS = defaultRolePermissions('basic');

function RolesManager({ roles, onChange }: { roles: CmsRole[]; onChange: () => void }) {
  const [name, setName] = useState('');
  const add = async () => {
    const cleaned = name.trim();
    if (!cleaned || cleaned.toLowerCase() === 'administrator' || roles.some(r => r.name.toLowerCase() === cleaned.toLowerCase())) { toast.error('Kies een unieke rolnaam.'); return; }
    const { error } = await supabase.from('cms_roles').insert({ name: cleaned, perms: DEFAULT_PERMS });
    if (error) toast.error(error.message); else { setName(''); onChange(); }
  };
  const toggle = async (r: CmsRole, key: string, v: boolean) => {
    if (r.system_key) return;
    const { error } = await supabase.from('cms_roles').update({ perms: { ...DEFAULT_PERMS, ...r.perms, [key]: v } }).eq('id', r.id);
    if (error) toast.error(error.message); else onChange();
  };
  const remove = async (r: CmsRole) => {
    if (r.system_key || !window.confirm(`Rol "${r.name}" verwijderen? Gebruikers met deze rol vallen terug op Basic.`)) return;
    const { error } = await supabase.from('cms_roles').delete().eq('id', r.id);
    if (error) toast.error(error.message); else onChange();
  };
  const profiles: CmsRole[] = [{ id: ADMIN_ROLE, name: 'Administrator', system_key: 'administrator', perms: {} }, ...roles];
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Rollen</h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void add(); }}>
        <div className="min-w-48 flex-1 space-y-1"><Label htmlFor="rn">Extra rol</Label><Input id="rn" required maxLength={80} placeholder="Rolnaam" value={name} onChange={e => setName(e.target.value)} /></div>
        <Button type="submit">Rol aanmaken</Button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {profiles.map(r => {
          const admin = r.id === ADMIN_ROLE;
          const rights = admin ? {} : r.system_key ? defaultRolePermissions(r.system_key) : { ...DEFAULT_PERMS, ...r.perms };
          return <div key={r.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-3"><span className="flex-1 font-medium">{r.name}</span>
              {r.system_key ? <span className="cms-status">Standaardrol</span> : <Button variant="ghost" size="sm" onClick={() => void remove(r)}>Verwijderen</Button>}
            </div>
            <div className="space-y-2">
              {PERMISSION_LABELS.map(([k, label]) => <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox disabled={Boolean(r.system_key)} checked={admin || Boolean(rights[k])} onCheckedChange={v => void toggle(r, k, v === true)} />{label}
              </label>)}
              {BUILDER_PERMISSION_LABELS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><Checkbox disabled checked={admin || Boolean(rights[key])} />{label}</label>)}
              {admin && <p className="border-t border-border pt-2 text-sm text-muted-foreground">Ook uitnodigingen, gebruikers en rollen, DNS en Updates.</p>}
            </div>
          </div>;
        })}
      </div>
    </section>
  );
}

function Users() {
  const list = useServerFn(listUsers); const invite = useServerFn(inviteUser);
  const setRole = useServerFn(setUserRole); const remove = useServerFn(removeUser);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<CmsRole[]>([]);
  const loadRoles = useCallback(() => void supabase.from('cms_roles').select('id, name, perms, system_key').order('created_at').then(({ data }) => setRoles((data ?? []) as CmsRole[])), []);
  useEffect(() => { loadRoles(); }, [loadRoles]);
  const basicId = roles.find(r => r.system_key === 'basic')?.id ?? '';
  const options = [{ id: ADMIN_ROLE, name: 'Administrator' }, ...roles.slice().sort((a, b) => {
    const order = ['webbuilder', 'basic', 'advanced'];
    return (a.system_key ? order.indexOf(a.system_key) : 9) - (b.system_key ? order.indexOf(b.system_key) : 9);
  })];
  const load = useCallback(async () => { try { setUsers(await list()); } catch (e) { toast.error((e as Error).message); } }, [list]);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); return true; } catch (e) { toast.error((e as Error).message); return false; }
    finally { setBusy(false); }
  };
  const roleValue = (u: UserRow) => u.role === 'admin' ? ADMIN_ROLE : u.role === 'editor' ? u.cmsRoleId ?? basicId : '';
  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Gebruikers</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => {
          e.preventDefault();
          void run(() => invite({ data: { email, ...roleAssignment(selectedRole || basicId), origin: window.location.origin } }), `Uitnodiging verstuurd naar ${email}`).then(ok => { if (ok) setEmail(''); });
        }}>
          <div className="min-w-48 flex-1 space-y-1"><Label htmlFor="inv">E-mailadres</Label><Input id="inv" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="w-48 space-y-1"><Label>Rol</Label>
            <Select value={selectedRole || basicId} onValueChange={setSelectedRole}><SelectTrigger aria-label="Rol voor uitnodiging"><SelectValue placeholder="Kies rol" /></SelectTrigger>
              <SelectContent>{options.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy || !(selectedRole || basicId)}>Uitnodigen</Button>
        </form>
        {!users ? <p>Laden…</p> : <div className="overflow-hidden rounded-lg border border-border">
          {users.map(u => <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><span className="break-all">{u.email}</span> {!u.confirmed && <span className="text-xs text-muted-foreground">(uitgenodigd)</span>}
              <span className={`cms-status ${u.mfa ? 'cms-status-ok' : 'cms-status-attention'}`}>{u.mfa ? '2FA actief' : '2FA ontbreekt'}</span>
            </span>
            {u.self ? <span className="text-sm text-muted-foreground">{options.find(r => r.id === roleValue(u))?.name ?? 'Geen rol'} (jij)</span> : <>
              <Select disabled={busy} value={roleValue(u)} onValueChange={v => void run(() => setRole({ data: { userId: u.id, ...roleAssignment(v) } }), 'Rol aangepast')}>
                <SelectTrigger className="w-48" aria-label={`Rol voor ${u.email}`}><SelectValue placeholder="Geen rol" /></SelectTrigger>
                <SelectContent>{options.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => { if (window.confirm(`${u.email} verwijderen?`)) void run(() => remove({ data: { userId: u.id } }), 'Gebruiker verwijderd'); }}>Verwijderen</Button>
            </>}
          </div>)}
        </div>}
      </section>
      <RolesManager roles={roles} onChange={loadRoles} />
    </div>
  );
}

const SITE_LANGS: { code: string; label: string }[] = [
  { code: 'nl', label: 'Nederlands' }, { code: 'en', label: 'English' }, { code: 'de', label: 'Deutsch' }, { code: 'fr', label: 'Français' },
];
const BUILT_LANGS = new Set(['nl', 'en']);

const SOCIALS: [string, string, string][] = [
  ['instagram', 'Instagram', 'https://www.instagram.com/…'], ['facebook', 'Facebook', 'https://www.facebook.com/…'],
  ['pinterest', 'Pinterest', 'https://www.pinterest.com/…'], ['youtube', 'YouTube', 'https://www.youtube.com/@…'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/…'], ['tiktok', 'TikTok', 'https://www.tiktok.com/@…'], ['x', 'X (Twitter)', 'https://x.com/…'],
];

type FormRow = { id: string; created_at: string; page: string; form_name: string; data: Record<string, string>; is_read: boolean };
function FormInbox() {
  const [rows, setRows] = useState<FormRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => void supabase.from('form_submissions').select('id, created_at, page, form_name, data, is_read').order('created_at', { ascending: false }).limit(500)
    .then(({ data, error }) => { if (error) toast.error('Formulieren laden mislukt: ' + error.message); setRows((data ?? []) as FormRow[]); }), []);
  useEffect(() => { load(); }, [load]);
  const mark = async (r: FormRow, is_read: boolean) => {
    setRows(rs => rs?.map(x => x.id === r.id ? { ...x, is_read } : x) ?? null);
    const { error } = await supabase.from('form_submissions').update({ is_read }).eq('id', r.id);
    if (error) { toast.error('Opslaan mislukt: ' + error.message); load(); }
  };
  if (!rows) return <p>Laden…</p>;
  if (!rows.length) return <p className="text-muted-foreground">Nog geen ingevulde formulieren.</p>;
  const unread = rows.filter(r => !r.is_read).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{rows.length} formulier(en), waarvan {unread} ongelezen.</p>
      <ul className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.map(r => {
          const entries = Object.entries(r.data ?? {});
          const isOpen = open === r.id;
          return (
            <li key={r.id} className="border-t border-border first:border-t-0">
              <button type="button" className="flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-muted" aria-expanded={isOpen}
                onClick={() => { setOpen(isOpen ? null : r.id); if (!r.is_read) void mark(r, true); }}>
                <span aria-label={r.is_read ? 'Gelezen' : 'Ongelezen'} className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.is_read ? 'bg-transparent' : 'bg-[var(--cms-blue)]'}`} />
                <span className={`min-w-0 flex-1 truncate ${r.is_read ? '' : 'font-semibold'}`}>{entries.slice(0, 2).map(([, v]) => v).join(' · ') || 'Formulier'}</span>
                <span className="hidden shrink-0 text-muted-foreground sm:inline">{publicPath(r.page) || '/'}</span>
                <span className="shrink-0 text-muted-foreground">{new Date(r.created_at).toLocaleString('nl-NL')}</span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-border bg-muted/40 p-4 text-sm">
                  <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[180px_1fr]">
                    {entries.map(([k, v]) => <Fragment key={k}><dt className="font-medium">{k}</dt><dd className="whitespace-pre-wrap break-words">{v}</dd></Fragment>)}
                  </dl>
                  <Button size="sm" variant="outline" onClick={() => void mark(r, !r.is_read)}>{r.is_read ? 'Markeren als ongelezen' : 'Markeren als gelezen'}</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SiteSettings({ isAdmin, onDashLang, onSaved }: { isAdmin: boolean; onDashLang: (l: 'nl' | 'en') => void; onSaved: () => void }) {
  const router = useRouter();
  const [s, setS] = useState<{ project_name: string; site_domain: string; dashboard_lang: string; default_lang: string; languages: string[]; auto_translate: boolean; seo_ai_enabled: boolean; social: Record<string, string>; menu_icon_color: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase.from('site_settings').select('project_name, site_domain, dashboard_lang, default_lang, languages, auto_translate, seo_ai_enabled, social, menu_icon_color').eq('id', 1).maybeSingle()
      .then(({ data, error }) => { if (error) { toast.error('Instellingen laden mislukt: ' + error.message); return; } setS(data ? { ...data, social: (data.social ?? {}) as Record<string, string> } : { project_name: '', site_domain: '', dashboard_lang: 'nl', ...DEFAULT_SITE_LANGUAGES, auto_translate: false, seo_ai_enabled: false, social: {}, menu_icon_color: '#1f2937' }); });
  }, []);
  if (!s) return <p>Laden…</p>;
  const save = async () => {
    setBusy(true);
    const languages = activeLanguages(s);
    const auto_translate = languages.length > 1 && s.auto_translate;
    const { error } = await supabase.from('site_settings').upsert({ id: 1, ...s, project_name: s.project_name.trim() || 'Website', site_domain: normDomain(s.site_domain), languages, auto_translate, social: Object.fromEntries(Object.entries(s.social).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)), updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error('Opslaan mislukt: ' + error.message); return; }
    onDashLang(s.dashboard_lang === 'en' ? 'en' : 'nl');
    setS({ ...s, languages, auto_translate });
    await router.invalidate();
    toast.success('Instellingen opgeslagen.');
    onSaved();
  };
  const sel = 'h-10 w-full max-w-xs rounded-lg border border-border bg-muted text-sm text-foreground';
  return (
    <div className="max-w-2xl space-y-6 rounded-lg border border-border bg-card p-6">
      {!isAdmin && <p className="text-sm text-muted-foreground">Alleen een beheerder kan deze instellingen wijzigen.</p>}
      <fieldset disabled={!isAdmin} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="sw-project-name">Projectnaam</Label>
          <Input id="sw-project-name" className="max-w-xs" maxLength={80} value={s.project_name} onChange={e => setS({ ...s, project_name: e.target.value })} />
          <p className="text-xs text-muted-foreground">Wordt gebruikt in uitnodigings- en accountmails en in het dashboard.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sw-site-domain">Websitedomein</Label>
          <Input id="sw-site-domain" className="max-w-xs" maxLength={253} placeholder="voorbeeld.nl" value={s.site_domain} onChange={e => setS({ ...s, site_domain: e.target.value })} />
          <p className="text-xs text-muted-foreground">Zonder https:// en www. Wordt gebruikt voor de URL-voorbeelden, het delen en de DNS-controle.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sw-dash-lang">Taal van het dashboard</Label>
          <select id="sw-dash-lang" className={sel} value={s.dashboard_lang} onChange={e => setS({ ...s, dashboard_lang: e.target.value })}>
            <option value="nl">Nederlands</option><option value="en">English</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sw-default-lang">Standaardtaal van de website</Label>
          <select id="sw-default-lang" className={sel} value={s.default_lang} onChange={e => setS({ ...s, default_lang: e.target.value })}>
            {SITE_LANGS.filter(l => BUILT_LANGS.has(l.code)).map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="space-y-3">
          <Label>Talen van de website</Label>
          {SITE_LANGS.map(l => (
            <label key={l.code} className="flex items-center gap-2 text-sm">
              <Checkbox checked={s.languages.includes(l.code) || l.code === s.default_lang} disabled={l.code === s.default_lang}
                onCheckedChange={v => setS({ ...s, languages: v === true ? [...s.languages, l.code] : s.languages.filter(x => x !== l.code) })} />
              {l.label}{!BUILT_LANGS.has(l.code) && <span className="text-muted-foreground"> — pagina's in deze taal moeten nog worden aangemaakt</span>}
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={activeLanguages(s).length > 1 && s.auto_translate} disabled={activeLanguages(s).length < 2} onCheckedChange={v => setS({ ...s, auto_translate: v === true })} />
          <span>Wijzigingen in de standaardtaal bij publiceren automatisch vertalen en doorvoeren in de andere talen (teksten, knoppen, links en foto's).</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={s.seo_ai_enabled} onCheckedChange={v => setS({ ...s, seo_ai_enabled: v === true })} />
          <span>AI-assistent inschakelen voor alle redacteuren (toverstafje bij SEO-velden en bij geselecteerde tekst in de editor: verbeteren, herschrijven, inkorten en spelling). Beheerders kunnen hem altijd gebruiken. Maximaal {SEO_AI_DAILY_LIMIT} SEO-suggesties en {TEXT_AI_DAILY_LIMIT} tekstbewerkingen per gebruiker per 24 uur.</span>
        </label>
        <div className="space-y-3">
          <Label>Social media</Label>
          {SOCIALS.map(([k, l, ph]) => (
            <div key={k} className="grid items-center gap-2 sm:grid-cols-[110px_1fr]">
              <Label htmlFor={`sw-social-${k}`} className="font-normal">{l}</Label>
              <Input id={`sw-social-${k}`} type="url" maxLength={300} placeholder={ph} value={s.social[k] ?? ''} onChange={e => setS({ ...s, social: { ...s.social, [k]: e.target.value } })} />
            </div>
          ))}
        </div>
        <div className="grid items-center gap-2 sm:grid-cols-[110px_1fr]">
          <Label htmlFor="sw-burger-color" className="font-normal">Kleur menu-icoon</Label>
          <div className="flex items-center gap-2"><input id="sw-burger-color" type="color" className="h-9 w-12 cursor-pointer rounded border border-border bg-background" value={/^#[0-9a-f]{6}$/i.test(s.menu_icon_color) ? s.menu_icon_color : '#1f2937'} onChange={e => setS({ ...s, menu_icon_color: e.target.value })} /><span className="text-sm text-muted-foreground">Het hamburger-icoon dat verschijnt als het menu niet op één regel past.</span></div>
        </div>
        <Button disabled={busy} className="bg-success text-success-foreground hover:bg-success/90" onClick={() => void save()}>Opslaan</Button>
      </fieldset>
    </div>
  );
}

type AuditRow = { id: string; created_at: string; actor_email: string | null; action: string; target: string | null };
function ActivityLog() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => {
    void supabase.from('audit_log').select('id, created_at, actor_email, action, target').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as AuditRow[]));
  }, []);
  if (!rows) return <p>Laden…</p>;
  if (!rows.length) return <p className="text-muted-foreground">Nog geen activiteit vastgelegd.</p>;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr><th className="p-3">Wanneer</th><th className="p-3">Wie</th><th className="p-3">Actie</th><th className="p-3">Wat</th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id} className="border-t border-border">
            <td className="whitespace-nowrap p-3 text-muted-foreground">{new Date(r.created_at).toLocaleString('nl-NL')}</td>
            <td className="p-3">{r.actor_email ?? 'Systeem'}</td><td className="p-3">{r.action}</td><td className="p-3 text-muted-foreground">{r.target ?? ''}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
