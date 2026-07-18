import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePostHog } from "@posthog/react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { OAUTH_REDIRECT_KEY, OAUTH_REFERRAL_KEY } from "@/lib/oauth-state";

/**
 * Destino pós-OAuth. Prioridade:
 * 1. Destino guardado em sessionStorage antes do redirect (state.from do
 *    ProtectedRoute — ex: link de convite de bolão). Mesma validação de
 *    open redirect do getRedirectTarget em Auth.tsx.
 * 2. Usuário novo → onboarding (mesmo fallback do signup por email).
 * 3. Usuário existente → /bolao (mesmo fallback do login por email).
 */
function resolveTarget(stored: string | null, isNewUser: boolean): string {
  if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
    return stored;
  }
  return isNewUser ? "/onboarding?src=signup" : "/bolao";
}

/** Espera o supabase-js processar os tokens do hash da URL e emitir sessão. */
function waitForUser(
  supabase: ReturnType<typeof createClient>,
  timeoutMs = 8000
): Promise<User | null> {
  return new Promise((resolve) => {
    let subscription: { unsubscribe: () => void } | null = null;
    const timeout = setTimeout(() => {
      subscription?.unsubscribe();
      resolve(null);
    }, timeoutMs);

    ({ data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        clearTimeout(timeout);
        subscription?.unsubscribe();
        resolve(session.user);
      }
    }));

    // Sessão pode já estar pronta antes do listener montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        clearTimeout(timeout);
        subscription?.unsubscribe();
        resolve(session.user);
      }
    });
  });
}

const AuthCallback = () => {
  const navigate = useNavigate();
  const posthog = usePostHog();
  // StrictMode monta o componente 2x em dev; sem o guard o fluxo roda em
  // dobro (insert duplicado na users, capture duplicado no PostHog).
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const supabase = createClient();

    const run = async () => {
      // Provider pode voltar com erro no hash/query (usuário cancelou, etc.)
      const params = new URLSearchParams(
        window.location.hash.replace(/^#/, "") || window.location.search
      );
      const providerError = params.get("error_description") || params.get("error");
      if (providerError) {
        toast({ title: "Erro no login", description: providerError, variant: "destructive" });
        navigate("/auth", { replace: true });
        return;
      }

      const user = await waitForUser(supabase);
      if (!user) {
        toast({
          title: "Erro no login",
          description: "Não foi possível completar o login com o Google. Tenta de novo.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
        return;
      }

      const storedTarget = sessionStorage.getItem(OAUTH_REDIRECT_KEY);
      const referralCode = sessionStorage.getItem(OAUTH_REFERRAL_KEY);
      sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
      sessionStorage.removeItem(OAUTH_REFERRAL_KEY);

      // Signup por email cria a linha na `users` manualmente (Auth.tsx);
      // no OAuth fazemos o equivalente aqui na primeira entrada.
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      const isNewUser = !existing;
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        null;

      if (isNewUser) {
        const { error: userError } = await supabase.from("users").insert({
          id: user.id,
          email: user.email!,
          name: displayName,
          referred_by: referralCode,
        });

        if (userError) {
          console.error("Error creating user record:", userError);
        } else if (referralCode) {
          try {
            const { data: referrerData, error: referrerError } = await supabase
              .from("users")
              .select("id")
              .eq("referral_code", referralCode)
              .single();

            if (!referrerError && referrerData && referrerData.id !== user.id) {
              await supabase.from("referrals").insert({
                referrer_id: referrerData.id,
                referred_id: user.id,
                referral_code: referralCode,
              });
            }
          } catch (err) {
            console.error("Error creating referral record:", err);
          }
        }

        if (typeof window !== "undefined" && (window as any).fbq) {
          (window as any).fbq("track", "CompleteRegistration");
        }
      }

      if (posthog) {
        posthog.identify(user.id, {
          email: user.email,
          name: displayName,
          ...(isNewUser && referralCode ? { referred_by_code: referralCode } : {}),
        });
        posthog.capture(isNewUser ? "signed_up" : "signed_in", {
          email: user.email,
          method: "google",
          ...(isNewUser && referralCode ? { referred_by_code: referralCode } : {}),
        });
      }

      toast({ title: isNewUser ? "Conta criada!" : "Bem-vindo de volta!" });
      navigate(resolveTarget(storedTarget, isNewUser), { replace: true });
    };

    run();
  }, [navigate, posthog]);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-forest" />
      <p className="text-[14px] text-ink-2">Entrando com o Google...</p>
    </div>
  );
};

export default AuthCallback;
