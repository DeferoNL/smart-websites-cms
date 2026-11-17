import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Session } from '@supabase/supabase-js';
import { UserRound, DatabaseBackup, LogOut, ShieldCheck, BarChart3, Globe, RefreshCw, Sun, Moon } from 'lucide-react';
import { useCmsTheme } from './ThemeProvider.tsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu.tsx';
import { PASSWORD_RULES, isStrongPassword } from './password-policy.ts';

export function firstName(session: Session) {
  const n = (session.user.user_metadata?.['first_name'] as string | undefined)?.trim();
  if (n) return n;
  const local = (session.user.email ?? '').split('@')[0]?.split(/[._-]/)[0] ?? '';
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Account';
}

export function UserMenu({ session, role, profileName, can = () => role === 'admin', t, onAccount, onBackup, onStats, onDns, onUpdates }: {
  session: Session; role: string | null; profileName?: string; can?: (perm: string) => boolean; t: (nl: string, en: string) => string; onAccount: () => void; onBackup: () => void; onStats?: () => void; onDns?: () => void; onUpdates?: () => void;
}) {
  const name = firstName(session);
  const { theme, toggleTheme } = useCmsTheme();
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'editor' ? profileName ?? '' : '';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto flex items-center gap-3 rounded-xl bg-card px-3 py-1.5 text-left text-foreground hover:bg-accent" aria-label="Accountmenu">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold">{name.charAt(0)}</span>
          <span className="leading-tight"><span className="block text-sm font-semibold">{name}</span>{roleLabel && <span className="block text-xs text-muted-foreground">{roleLabel}</span>}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dark sw-admin w-64 rounded-xl p-2 text-foreground">
        <DropdownMenuLabel className="px-3 py-2"><span className="block text-base font-semibold">{name}</span><span className="block truncate text-sm font-normal text-muted-foreground">{session.user.email}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-3 px-3 py-2 text-base" onSelect={onAccount}><UserRound className="h-5 w-5" />{t('Account', 'Account')}</DropdownMenuItem>
        {can('stats') && onStats && <DropdownMenuItem className="gap-3 px-3 py-2 text-base" onSelect={onStats}><BarChart3 className="h-5 w-5" />{t('Statistieken', 'Statistics')}</DropdownMenuItem>}
        {can('dns') && onDns && <DropdownMenuItem className="gap-3 px-3 py-2 text-base" onSelect={onDns}><Globe className="h-5 w-5" />{t('DNS & systeem', 'DNS & system')}</DropdownMenuItem>}
        {role === 'admin' && onUpdates && <DropdownMenuItem className="gap-3 px-3 py-2 text-base" onSelect={onUpdates}><RefreshCw className="h-5 w-5" />{t('Updates', 'Updates')}</DropdownMenuItem>}
        {can('backups') && <DropdownMenuItem className="gap-3 px-3 py-2 text-base" onSelect={onBackup}><DatabaseBackup className="h-5 w-5" />{t('Back-up', 'Backup')}</DropdownMenuItem>}
        <DropdownMenuItem className="gap-3 px-3 py-2 text-base" onSelect={() => void supabase.auth.signOut()}><LogOut className="h-5 w-5" />{t('Uitloggen', 'Sign out')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-3 px-3 py-2 text-base" onSelect={event => { event.preventDefault(); toggleTheme(); }}>
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === 'dark' ? t('Daylight mode', 'Daylight mode') : t('Nightmode', 'Nightmode')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const green = 'bg-success text-success-foreground hover:bg-success/90';

export function AccountDialog({ session, onClose, onMfa }: { session: Session; onClose: () => void; onMfa: () => void }) {
  const [name, setName] = useState((session.user.user_metadata?.['first_name'] as string) ?? '');
  const [email, setEmail] = useState(session.user.email ?? '');
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasMfa, setHasMfa] = useState<boolean | null>(null);
  if (hasMfa === null) void supabase.auth.mfa.listFactors().then(({ data }) => setHasMfa(Boolean(data?.totp.some(f => f.status === 'verified'))));

  const saveName = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { first_name: name.trim().slice(0, 60) } });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success('Naam opgeslagen.');
  };
  const saveEmail = async (e: FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast.error('Ongeldig e-mailadres.'); return; }
    if (v === session.user.email) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: v }, { emailRedirectTo: `${window.location.origin}/smart-websites` });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    void supabase.rpc('log_audit', { _action: 'E-mailadres wijziging aangevraagd', _target: v });
    toast.success('Bevestig de wijziging via de link in je mailbox.');
  };
  const savePw = async (e: FormEvent) => {
    e.preventDefault();
    if (!isStrongPassword(pw)) { toast.error('Het nieuwe wachtwoord voldoet niet aan alle eisen.'); return; }
    if (pw !== pw2) { toast.error('De wachtwoorden komen niet overeen.'); return; }
    setBusy(true);
    try {
      const { error: e1 } = await supabase.auth.signInWithPassword({ email: session.user.email ?? '', password: cur });
      if (e1) { toast.error('Huidig wachtwoord klopt niet.'); return; }
      if (hasMfa) {
        const { data } = await supabase.auth.mfa.listFactors();
        const f = data?.totp.find(x => x.status === 'verified');
        if (f) {
          const { error: e2 } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code });
          if (e2) { toast.error('Onjuiste 2FA-code.'); return; }
        }
      }
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) { toast.error(/pwned|leak|breach|weak/i.test(error.message) ? 'Dit wachtwoord komt voor in bekende datalekken. Kies een ander wachtwoord.' : error.message); return; }
      void supabase.rpc('log_audit', { _action: 'Wachtwoord gewijzigd', _target: '' });
      toast.success('Wachtwoord gewijzigd.'); setCur(''); setPw(''); setPw2(''); setCode('');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin max-h-[90vh] overflow-y-auto text-foreground">
        <DialogHeader><DialogTitle>Account</DialogTitle></DialogHeader>
        <form onSubmit={saveName} className="space-y-2 rounded-lg border border-border p-4">
          <Label htmlFor="acc-name">Voornaam</Label>
          <div className="flex gap-2"><Input id="acc-name" value={name} maxLength={60} onChange={e => setName(e.target.value)} /><Button type="submit" disabled={busy} className={green}>Opslaan</Button></div>
        </form>
        <form onSubmit={saveEmail} className="space-y-2 rounded-lg border border-border p-4">
          <Label htmlFor="acc-email">E-mailadres</Label>
          <div className="flex gap-2"><Input id="acc-email" type="email" value={email} onChange={e => setEmail(e.target.value)} /><Button type="submit" disabled={busy} className={green}>Wijzigen</Button></div>
          <p className="text-xs text-muted-foreground">Je ontvangt een bevestigingslink. Pas na bevestigen wordt het nieuwe adres actief.</p>
        </form>
        <form onSubmit={savePw} className="space-y-3 rounded-lg border border-border p-4">
          <p className="font-semibold">Wachtwoord wijzigen</p>
          <div className="space-y-1"><Label htmlFor="acc-cur">Huidig wachtwoord</Label><Input id="acc-cur" type="password" autoComplete="current-password" required value={cur} onChange={e => setCur(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="acc-pw">Nieuw wachtwoord</Label><Input id="acc-pw" type="password" autoComplete="new-password" required value={pw} onChange={e => setPw(e.target.value)} />
            <ul className="mt-1 space-y-0.5 text-xs">{PASSWORD_RULES.map(r => <li key={r.label} className={r.test(pw) ? 'text-success' : 'text-muted-foreground'}>{r.test(pw) ? '✓' : '•'} {r.label}</li>)}</ul>
          </div>
          <div className="space-y-1"><Label htmlFor="acc-pw2">Herhaal nieuw wachtwoord</Label><Input id="acc-pw2" type="password" autoComplete="new-password" required value={pw2} onChange={e => setPw2(e.target.value)} /></div>
          {hasMfa && <div className="space-y-1"><Label htmlFor="acc-code">2FA-code</Label><Input id="acc-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="tracking-[0.4em]" /></div>}
          <Button type="submit" disabled={busy || (hasMfa === true && code.length !== 6)} className={green}>Wachtwoord opslaan</Button>
        </form>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
          <div><p className="font-semibold">Beveiliging (2FA)</p><p className="text-sm text-muted-foreground">{hasMfa ? 'Staat aan' : 'Staat uit'}</p></div>
          <Button variant="outline" onClick={onMfa}><ShieldCheck className="mr-1 h-4 w-4" />Beheren</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
