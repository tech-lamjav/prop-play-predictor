import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ReferralModal } from './ReferralModal';
import { useAuth } from '../hooks/use-auth';
import { createClient } from '../integrations/supabase/client';

/**
 * Torna o "Indique um amigo" global: renderiza o ReferralModal uma vez e expõe
 * openReferral() via contexto, pra qualquer tela (ex.: o menu da conta no
 * UserNav) abrir o convite — sem cada página ter seu próprio estado/modal.
 */
interface ReferralContextValue {
  openReferral: () => void;
}

const ReferralContext = createContext<ReferralContextValue>({ openReferral: () => {} });

export const useReferral = () => useContext(ReferralContext);

export function ReferralProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const openReferral = useCallback(() => setOpen(true), []);

  // Busca o código só quando abre pela 1ª vez (evita query em toda navegação).
  useEffect(() => {
    if (!open || !user?.id || referralCode) return;
    supabase
      .from('users')
      .select('referral_code')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setReferralCode(data?.referral_code ?? null));
  }, [open, user?.id, referralCode, supabase]);

  return (
    <ReferralContext.Provider value={{ openReferral }}>
      {children}
      {user?.id && (
        <ReferralModal open={open} onOpenChange={setOpen} userId={user.id} referralCode={referralCode} />
      )}
    </ReferralContext.Provider>
  );
}
