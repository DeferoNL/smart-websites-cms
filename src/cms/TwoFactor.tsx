import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';

/** True when the account has 2FA but this session has not passed the code check yet. */
export async function needsMfa(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

const cleanCode = (v: string) => v.replace(/\D/g, '').slice(0, 6);

export function MfaChallenge({ onDone, logo }: { onDone: () => void; logo: React.ReactNode }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { data: f } = await supabase.auth.mfa.listFactors();
    const factor = f?.totp.find(x => x.status === 'verified');
    if (!factor) { setBusy(false); onDone(); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) { toast.error('Onjuiste code. Probeer het opnieuw.'); setCode(''); return; }
    onDone();
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8 shadow-lg">
        {logo}
        <h1 className="text-center text-lg font-semibold">Tweestapsverificatie</h1>
        <p className="text-center text-sm text-muted-foreground">Vul de 6-cijferige code uit je authenticator-app in.</p>
        <div className="space-y-1"><Label htmlFor="mfa">Code</Label>
          <Input id="mfa" inputMode="numeric" autoComplete="one-time-code" autoFocus required pattern="\d{6}" value={code} onChange={e => setCode(cleanCode(e.target.value))} className="text-center text-lg tracking-[0.4em]" />
        </div>
        <Button type="submit" disabled={busy || code.length !== 6} className="w-full">Bevestigen</Button>
        <button type="button" className="block w-full text-center text-sm text-muted-foreground underline" onClick={() => void supabase.auth.signOut()}>Annuleren en uitloggen</button>
      </form>
    </div>
  );
}

/** True when the account has a verified authenticator. */
export async function hasMfa(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors();
  return Boolean(data?.totp.some(x => x.status === 'verified'));
}

/** Mandatory 2FA screen for non-admin users: setup is required before access. */
export function MfaRequired({ onDone }: { onDone: () => void }) {
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-lg font-semibold">Beveiliging vereist</h1>
      <p className="mt-2 text-sm text-muted-foreground">Stel eerst tweestapsverificatie in om verder te gaan.</p>
      <MfaSettings required onClose={onDone} />
      <button type="button" className="mt-6 text-sm text-muted-foreground underline" onClick={() => void supabase.auth.signOut()}>Uitloggen</button>
    </div>
  );
}

export function MfaSettings({ onClose, required = false }: { onClose: () => void; required?: boolean }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const v = data?.totp.find(x => x.status === 'verified');
    setEnabled(Boolean(v)); setFactorId(v?.id ?? null);
  };
  useEffect(() => { void load(); }, []);

  const start = async () => {
    setBusy(true);
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${Date.now()}` });
    setBusy(false);
    if (error || !data) { toast.error('Instellen mislukt: ' + (error?.message ?? '')); return; }
    setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret);
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault(); if (!factorId) return; setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) { toast.error('Onjuiste code. Probeer het opnieuw.'); setCode(''); return; }
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.totp ?? []) if (f.id !== factorId && f.status === 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    void supabase.rpc('log_audit', { _action: '2FA ingeschakeld', _target: '' });
    toast.success('Tweestapsverificatie staat aan.'); setQr(null); setCode(''); if (required) { onClose(); return; } void load();
  };
  const disable = async () => {
    if (!factorId || !confirm('Weet je zeker dat je tweestapsverificatie wilt uitzetten?')) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) { toast.error('Uitzetten mislukt: ' + error.message); return; }
    void supabase.rpc('log_audit', { _action: '2FA uitgeschakeld', _target: '' });
    toast.success('Tweestapsverificatie staat uit.'); void load();
  };

  return (
    <Dialog open onOpenChange={o => { if (!o && !required) onClose(); }}>
      <DialogContent className="dark sw-admin text-foreground">
        <DialogHeader><DialogTitle>Tweestapsverificatie (2FA)</DialogTitle></DialogHeader>
        {enabled === null ? <p>Laden…</p> : qr ? (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-muted-foreground">Scan deze QR-code met een authenticator-app (bijv. Google Authenticator, Microsoft Authenticator of 1Password) en vul de code in.</p>
            <div className="mx-auto w-48 rounded-lg bg-card-foreground p-2"><img src={qr} alt="QR-code voor 2FA" className="w-full" /></div>
            <p className="break-all text-center text-xs text-muted-foreground">Of voer handmatig in: <code>{secret}</code></p>
            <div className="space-y-1"><Label htmlFor="mfa-new">Code</Label>
              <Input id="mfa-new" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={e => setCode(cleanCode(e.target.value))} className="text-center tracking-[0.4em]" />
            </div>
            <DialogFooter className="gap-2">{!required && <Button type="button" variant="outline" onClick={onClose}>Annuleren</Button>}<Button type="submit" disabled={busy || code.length !== 6} className="bg-success text-success-foreground hover:bg-success/90">Activeren</Button></DialogFooter>
          </form>
        ) : enabled ? (
          <div className="space-y-4">
            <p className="text-sm"><span className="font-semibold text-success">Aan.</span> Bij elke login vragen we een code uit je authenticator-app.</p>
            <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>Sluiten</Button>{!required && <Button variant="outline" disabled={busy} onClick={() => void start()}>Opnieuw instellen</Button>}{!required && <Button variant="destructive" disabled={busy} onClick={() => void disable()}>Uitzetten</Button>}</DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{required ? 'Tweestapsverificatie is verplicht voor dit account. ' : ''}Beveilig je account extra: na je wachtwoord vul je een code in uit een app op je telefoon. Zo kan niemand inloggen met alleen je wachtwoord.</p>
            <DialogFooter className="gap-2">{!required && <Button variant="outline" onClick={onClose}>Sluiten</Button>}<Button disabled={busy} onClick={() => void start()} className="bg-success text-success-foreground hover:bg-success/90">Instellen</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
