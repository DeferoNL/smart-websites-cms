import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@defero/smart-websites-cms/src/components/ui/button.tsx';
import { Input } from '@defero/smart-websites-cms/src/components/ui/input.tsx';
import { Label } from '@defero/smart-websites-cms/src/components/ui/label.tsx';
import logo from '@/assets/smart-websites-logo.svg.asset.json';
import { PASSWORD_RULES, isStrongPassword } from '@defero/smart-websites-cms/src/cms/password-policy.ts';
import { initializePasswordSession, INVALID_PASSWORD_LINK } from '@defero/smart-websites-cms/src/cms/password-session.ts';

export const Route = createFileRoute('/reset-password')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'Wachtwoord instellen | Smart Websites' },
      { name: 'description', content: 'Stel een nieuw wachtwoord in voor je Smart Websites-account.' },
      { property: 'og:title', content: 'Wachtwoord instellen | Smart Websites' },
      { property: 'og:description', content: 'Stel een nieuw wachtwoord in.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
    links: [{ rel: 'icon', type: 'image/png', href: '/smart-websites-favicon.png' }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sessionState, setSessionState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await initializePasswordSession(supabase.auth, window.location.href, () => window.location.href);
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        if (!active) return;
        setFactorId(data?.totp.find(x => x.status === 'verified')?.id ?? null);
        // Callback secrets must not remain in history or be reused on refresh.
        window.history.replaceState(window.history.state, '', window.location.pathname);
        setSessionState('ready');
      } catch {
        if (active) setSessionState('invalid');
      }
    })();
    return () => { active = false; };
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sessionState !== 'ready' || busy) return;
    if (!isStrongPassword(pw)) { toast.error('Het wachtwoord voldoet niet aan alle eisen.'); return; }
    if (pw !== pw2) { toast.error('De wachtwoorden komen niet overeen.'); return; }
    if (factorId && !/^\d{6}$/.test(code)) { toast.error('Vul de 6-cijferige 2FA-code in.'); return; }
    setBusy(true);
    try {
    const { data: userData, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !userData.user) { setSessionState('invalid'); return; }
    if (factorId) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== 'aal2') {
        const { error: e2 } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
        if (e2) { setBusy(false); toast.error('Onjuiste 2FA-code.'); return; }
      }
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      if (/session.*missing|session.*expired|jwt.*expired/i.test(error.message)) { setSessionState('invalid'); return; }
      const msg = /pwned|leak|breach|weak/i.test(error.message)
        ? 'Dit wachtwoord komt voor in bekende datalekken. Kies een ander wachtwoord.'
        : /reauthentication|current password/i.test(error.message)
        ? 'Open een nieuwe uitnodigings- of herstellink uit je e-mail om je wachtwoord in te stellen.'
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success('Wachtwoord opgeslagen.');
    void navigate({ to: '/smart-websites', replace: true });
    } catch {
      toast.error('Opslaan is niet gelukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="dark sw-admin flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8">
        <img src={logo.url} alt="Smart Websites" className="mx-auto h-10 brightness-0 invert" />
        {sessionState === 'loading' ? <p role="status" className="text-center text-sm text-muted-foreground">Je link wordt gecontroleerd…</p> : sessionState === 'invalid' ? <>
          <h1 className="text-center text-lg font-semibold">Link niet geldig</h1>
          <p role="alert" className="text-sm text-muted-foreground">{INVALID_PASSWORD_LINK}</p>
          <Button type="button" className="w-full" onClick={() => void navigate({ to: '/smart-websites', replace: true })}>Naar het inlogscherm</Button>
        </> : <>
        <h1 className="text-center text-lg font-semibold">Kies je wachtwoord</h1>
        <div className="space-y-1"><Label htmlFor="pw">Nieuw wachtwoord</Label><Input id="pw" type="password" autoComplete="new-password" required minLength={12} value={pw} onChange={e => setPw(e.target.value)} />
          <ul className="mt-2 space-y-0.5 text-xs">
            {PASSWORD_RULES.map(r => <li key={r.label} className={r.test(pw) ? 'text-success' : 'text-muted-foreground'}>{r.test(pw) ? '✓' : '•'} {r.label}</li>)}
          </ul>
        </div>
        <div className="space-y-1"><Label htmlFor="pw2">Herhaal wachtwoord</Label><Input id="pw2" type="password" autoComplete="new-password" required minLength={12} value={pw2} onChange={e => setPw2(e.target.value)} aria-invalid={pw2.length > 0 && pw !== pw2} />{pw2.length > 0 && pw !== pw2 && <p className="text-sm text-destructive">De wachtwoorden komen niet overeen.</p>}</div>
        {factorId && <div className="space-y-1"><Label htmlFor="code">2FA-code</Label><Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /><p className="text-xs text-muted-foreground">Code uit je authenticator-app.</p></div>}
        <Button type="submit" disabled={busy} className="w-full">Opslaan</Button>
        </>}
      </form>
    </div>
  );
}
