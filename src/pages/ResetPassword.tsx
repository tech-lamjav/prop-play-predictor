import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

/**
 * Página de redefinição de senha (fluxo de recovery do Supabase).
 *
 * Quando o usuário clica no link do e-mail, cai aqui com o token de recovery na
 * URL. O supabase-js (com `detectSessionInUrl`, default) processa o token e
 * dispara `onAuthStateChange('PASSWORD_RECOVERY', session)`, criando uma sessão
 * temporária. Com essa sessão, `updateUser({ password })` troca a senha.
 *
 * IMPORTANTE: esta rota NÃO usa ProtectedRoute. A sessão de recovery conta como
 * "logado", e o ProtectedRoute(requireAuth=false) expulsaria o usuário pra
 * /onboarding antes dele trocar a senha.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        resolved = true;
        setReady(true);
        setChecking(false);
      }
    });

    // Caso o token já tenha sido processado antes do listener registrar.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolved = true;
        setReady(true);
        setChecking(false);
      }
    });

    // Sem sessão em alguns segundos → link inválido ou expirado.
    const timeout = setTimeout(() => {
      if (!resolved) setChecking(false);
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [supabase.auth]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Erro", description: "A senha precisa ter ao menos 6 caracteres", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não conferem", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Senha redefinida", description: "Tudo certo, você já está logado." });
      navigate("/bolao", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-line rounded-rebrand-xl p-6 sm:p-7 shadow-sm">
          {checking ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest" />
              <p className="text-[13px] text-ink-2">Validando o link…</p>
            </div>
          ) : ready ? (
            <>
              <h3 className="font-display text-[20px] font-extrabold text-ink mb-1">
                Criar nova senha
              </h3>
              <p className="text-[13px] text-ink-2 mb-5">
                Escolha uma senha nova pra sua conta.
              </p>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                    Nova senha
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-canvas border-line text-ink h-11 rounded-rebrand-md focus-visible:border-forest focus-visible:ring-forest/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                    Confirmar senha
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-canvas border-line text-ink h-11 rounded-rebrand-md focus-visible:border-forest focus-visible:ring-forest/20"
                  />
                </div>
                <Button
                  type="submit"
                  variant="forest"
                  size="lg"
                  disabled={loading}
                  className="w-full rounded-rebrand-md h-11"
                >
                  {loading ? "Salvando…" : "Salvar nova senha"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h3 className="font-display text-[20px] font-extrabold text-ink mb-1">
                Link inválido ou expirado
              </h3>
              <p className="text-[13px] text-ink-2 mb-5">
                Esse link de redefinição não vale mais. Peça um novo na tela de login.
              </p>
              <Button
                type="button"
                variant="forest"
                size="lg"
                onClick={() => navigate("/auth", { replace: true })}
                className="w-full rounded-rebrand-md h-11"
              >
                Voltar pro login
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
