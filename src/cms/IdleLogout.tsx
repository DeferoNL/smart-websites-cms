import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const IDLE_MS = 60 * 60 * 1000; // sign editors out after 60 minutes without activity

export function IdleLogout() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void supabase.auth.getSession().then(({ data }) => {
          if (data.session) void supabase.auth.signOut().then(() => { window.location.href = '/smart-websites'; });
        });
      }, IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { if (timer) clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)); };
  }, []);
  return null;
}
