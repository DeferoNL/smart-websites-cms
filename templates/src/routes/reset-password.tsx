import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@defero/smart-websites-cms/src/components/ui/button.tsx';
import { Input } from '@defero/smart-websites-cms/src/components/ui/input.tsx';
import { Label } from '@defero/smart-websites-cms/src/components/ui/label.tsx';
import logo from '@/assets/smart-websites-logo.svg.asset.json';
import { PASSWORD_RULES, isStrongPassword } from '@defero/smart-websites-cms/src/cms/password-policy.ts';

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
  useEffect(() => {
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      const f = data?.totp.find(x => x.status === 'verified');
      if (f) setFactorId(f.id);
    });
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isStrongPassword(pw)) { toast.error('Het wachtwoord voldoet niet aan alle eisen.'); return; }
    if (pw !== pw2) { toast.error('De wachtwoorden komen niet overeen.'); return; }
    if (factorId && !/^\d{6}$/.test(code)) { toast.error('Vul de 6-cijferige 2FA-code in.'); return; }
    setBusy(true);
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
      const msg = /pwned|leak|breach|weak/i.test(error.message)
        ? 'Dit wachtwoord komt voor in bekende datalekken. Kies een ander wachtwoord.'
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success('Wachtwoord opgeslagen.');
    void navigate({ to: '/smart-websites' });
  };
  return (
    <div className="dark sw-admin flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8">
        <img src={logo.url} alt="Smart Websites" className="mx-auto h-10 brightness-0 invert" />
        <h1 className="text-center text-lg font-semibold">Kies je wachtwoord</h1>
        <div className="space-y-1"><Label htmlFor="pw">Nieuw wachtwoord</Label><Input id="pw" type="password" autoComplete="new-password" required minLength={12} value={pw} onChange={e => setPw(e.target.value)} />
          <ul className="mt-2 space-y-0.5 text-xs">
            {PASSWORD_RULES.map(r => <li key={r.label} className={r.test(pw) ? 'text-success' : 'text-muted-foreground'}>{r.test(pw) ? '✓' : '•'} {r.label}</li>)}
          </ul>
        </div>
        <div className="space-y-1"><Label htmlFor="pw2">Herhaal wachtwoord</Label><Input id="pw2" type="password" autoComplete="new-password" required minLength={12} value={pw2} onChange={e => setPw2(e.target.value)} aria-invalid={pw2.length > 0 && pw !== pw2} />{pw2.length > 0 && pw !== pw2 && <p className="text-sm text-destructive">De wachtwoorden komen niet overeen.</p>}</div>
        {factorId && <div className="space-y-1"><Label htmlFor="code">2FA-code</Label><Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /><p className="text-xs text-muted-foreground">Code uit je authenticator-app.</p></div>}
        <Button type="submit" disabled={busy} className="w-full">Opslaan</Button>
      </form>
    </div>
  );
}
