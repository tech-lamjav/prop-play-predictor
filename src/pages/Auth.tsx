import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePostHog } from "@posthog/react";
import { createClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Sparkles, Check, BarChart3, Send, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { LanguageToggle } from "@/components/LanguageToggle";

/**
 * Determina pra onde redirecionar o user após login/signup bem-sucedido.
 *
 * 1. Se houver `location.state.from` (ProtectedRoute setou — ex: link de
 *    convite, deep link), respeita. Mantém compatibilidade com fluxos que
 *    dependem disso (BolaoLP `/bolao/comecar` passa `state.from`).
 * 2. Default = `/bolao`. Antes era `/onboarding`; mudado pra bolão por
 *    decisão do produto (Diody): bolão vira a porta de entrada padrão
 *    pós-cadastro, todos caem na home do bolão.
 *
 * Bug histórico que esta função corrige: `handleSignUp` ignorava
 * `state.from` (hard-coded `/onboarding`), então quem vinha da LP do bolão
 * via signup caía no onboarding em vez do bolão.
 */
function getRedirectTarget(
  state: unknown,
  fallback: string = "/bolao"
): string {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from;
  if (
    from?.pathname &&
    from.pathname.startsWith("/") &&
    !from.pathname.startsWith("//") // proteção contra open redirect
  ) {
    return from.pathname + (from.search || "");
  }
  return fallback;
}

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const posthog = usePostHog();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+55");
  const [phoneNumber, setPhoneNumber] = useState("");

  const supabase = createClient();

  // Detecta se o usuario chegou aqui por um link de convite de bolao
  // (ProtectedRoute redireciona /bolao/entrar/:code -> /auth com state.from
  // setado). Quando vier dali, mostramos copy contextualizada e defaultamos
  // pra aba "Cadastrar" (cara provavelmente eh novo).
  const fromBolaoInvite = (
    location.state as { from?: { pathname?: string } } | null
  )?.from?.pathname?.startsWith('/bolao/entrar/') ?? false;

  // Branding do Auth: default = nível empresa (Smart Betting cobre análise + gestão + comunidade).
  // Quem chega por convite de bolão (fromBolaoInvite) mantém a copy contextual do Bolão.
  const heroFeatures = fromBolaoInvite
    ? [
        { icon: Users, title: 'Convite com 1 clique', desc: 'Link direto pro WhatsApp, sem código pra digitar.' },
        { icon: Sparkles, title: 'Quick Pick em 1 toque', desc: 'Não quer palpitar 104 jogos? Preenche tudo automático e edita depois.' },
        { icon: Trophy, title: 'Ranking ao vivo', desc: 'Compartilha imagem do ranking nos Stories e zoeia os amigos.' },
      ]
    : [
        { icon: BarChart3, title: 'Análises com edge', desc: 'Props e oportunidades do dia com Score próprio.' },
        { icon: Send, title: 'Betinho no Telegram', desc: 'Registra por print ou texto e acompanha seu ROI real.' },
        { icon: ShieldCheck, title: 'Sem tipster, sem achismo', desc: 'Decisão com números, não com palpite.' },
      ];

  // Detect referral code from URL parameter
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCode(refParam.toUpperCase());
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (user && posthog) {
        posthog.identify(user.id, {
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0],
        });
        posthog.capture('signed_in', { email: user.email, method: 'email' });
      }

      toast({ title: "Bem-vindo de volta!" });
      // Login recorrente cai no hub /inicio (dispatcher pós-login). state.from
      // explícito continua vencendo (ex: barrado numa rota protegida → volta pra ela).
      navigate(getRedirectTarget(location.state, '/inicio'));
    } catch (error) {
      toast({ title: "Erro", description: "Ocorreu um erro inesperado", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não conferem", variant: "destructive" });
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      toast({ title: "Erro", description: "Informe um telefone válido", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const normalizedReferralCode = referralCode.trim() ? referralCode.toUpperCase().trim() : null;
        const whatsappNumber = phoneCountryCode.replace(/\D/g, '') + cleanPhone;
        const userData: any = {
          id: user.id,
          email: user.email!,
          name,
          referred_by: normalizedReferralCode,
          whatsapp_number: whatsappNumber,
        };

        const { error: userError } = await supabase.from('users').insert(userData);

        if (userError) {
          console.error('Error creating user record:', userError);
          toast({ title: "Erro", description: "Falha ao criar registro de usuário", variant: "destructive" });
        } else if (normalizedReferralCode) {
          try {
            const { data: referrerData, error: referrerError } = await supabase
              .from('users')
              .select('id')
              .eq('referral_code', normalizedReferralCode)
              .single();

            if (!referrerError && referrerData && referrerData.id !== user.id) {
              await supabase.from('referrals').insert({
                referrer_id: referrerData.id,
                referred_id: user.id,
                referral_code: normalizedReferralCode,
              });
            }
          } catch (err) {
            console.error('Error creating referral record:', err);
          }
        }

        if (posthog) {
          const referralProperties = normalizedReferralCode
            ? { referred_by_code: normalizedReferralCode }
            : {};
          posthog.identify(user.id, {
            email: user.email,
            name: name || user.email?.split('@')[0],
            ...referralProperties,
          });
          posthog.capture('signed_up', {
            email: user.email,
            name,
            method: 'email',
            ...referralProperties,
          });
        }

        if (typeof window !== 'undefined' && (window as any).fbq) {
          (window as any).fbq('track', 'CompleteRegistration');
        }
      }

      toast({ title: "Conta criada!", description: "Você já pode começar a usar a plataforma." });
      // state.from explícito continua vencendo (ex: vindo da LP do bolão), mas o
      // fallback do CADASTRO é o onboarding do Betinho (decisão D1, 2026-07-08 —
      // docs/onboarding-betinho-redesign.md): o antigo /bolao expira com a Copa.
      navigate(getRedirectTarget(location.state, '/onboarding?src=signup'));
    } catch (error) {
      toast({ title: "Erro", description: "Ocorreu um erro inesperado", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    // theme-bolao no root pra ativar CSS vars (--canvas, --forest, --ink, etc.)
    // mesmo fora do BolaoLayout (Auth tem rota /auth, não /bolao/*).
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      {/* Topbar minimalista — logo igual ao header do bolão (AnalyticsNav rebrand).
          A logo.png é branca/clara; aplicamos `invert hue-rotate-180` pra ficar
          legível em fundo branco. Mesmo tratamento usado na nav do /bolao. */}
      <header className="border-b border-line bg-white">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" aria-label="Smartbetting — home" className="flex items-center hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Smartbetting" className="h-8 w-auto invert hue-rotate-180" />
          </a>
          <LanguageToggle />
        </div>
      </header>

      {/* Conteúdo principal: split em md+ (hero left + form right), single column mobile */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] max-w-screen-xl mx-auto w-full">
        {/* ─── Hero (esquerda no desktop, esconde no mobile pra economizar scroll) ─── */}
        <aside className="hidden lg:flex bg-forest text-white p-12 xl:p-16 flex-col justify-between relative overflow-hidden">
          {/* decorações atmosféricas */}
          <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-amber/10 pointer-events-none" aria-hidden />
          <div className="absolute -left-20 bottom-20 w-72 h-72 rounded-full bg-amber/5 pointer-events-none" aria-hidden />

          <div className="relative z-10">
            <div className="text-[12px] uppercase tracking-[0.18em] font-semibold opacity-70 mb-3">
              {fromBolaoInvite ? 'Bolão · Copa do Mundo 2026' : 'Smart Betting'}
            </div>
            {fromBolaoInvite ? (
              <h1 className="font-display text-[42px] xl:text-[52px] leading-[1.05] font-extrabold mb-5 tracking-tight">
                Reúne a galera.<br />
                Palpita os 104 jogos.<br />
                <span className="text-amber">Vê quem manja mais.</span>
              </h1>
            ) : (
              <h1 className="font-display text-[42px] xl:text-[52px] leading-[1.05] font-extrabold mb-5 tracking-tight">
                Pare de apostar<br />
                <span className="text-amber">no escuro.</span>
              </h1>
            )}
            <p className="text-[15px] opacity-80 leading-relaxed max-w-[420px]">
              {fromBolaoInvite
                ? 'Cria seu bolão em 30 segundos, compartilha no zap, e leva a galera junto. Grátis pra até 20 amigos.'
                : 'Análises que apontam o valor, o Betinho pra gerir suas apostas e o seu ROI real na palma da mão — tudo com dado, sem achismo.'}
            </p>
          </div>

          <div className="relative z-10 space-y-3 max-w-[420px]">
            {heroFeatures.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-rebrand-sm bg-amber/15 grid place-items-center text-amber shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-display text-[15px] font-bold">{title}</p>
                  <p className="text-[13px] opacity-70">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative z-10 text-[11px] opacity-50 mt-8">
            ✓ Grátis pra começar · ✓ Sem cartão · ✓ Sem instalar nada
          </div>
        </aside>

        {/* ─── Form (direita no desktop, ocupa toda largura no mobile) ─── */}
        <main className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
          <div className="w-full max-w-md">
            {/* Brand mobile-only (no desktop o hero à esquerda já tem isso) */}
            <div className="lg:hidden mb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-rebrand-md bg-forest/10 text-forest mb-3">
                <Trophy className="w-6 h-6" />
              </div>
              <h2 className="font-display text-[24px] font-extrabold text-ink leading-tight">
                {fromBolaoInvite ? 'Bolão Copa 2026' : 'Smart Betting'}
              </h2>
              <p className="text-[13px] text-ink-2 mt-1">
                {fromBolaoInvite ? 'Cria seu bolão em 30 segundos.' : 'Análise, gestão e ROI real — decida com dados.'}
              </p>
            </div>

            {/* Banner quando o usuario veio de um invite de bolao */}
            {fromBolaoInvite && (
              <div className="rounded-rebrand-md border border-amber/40 bg-amber/10 p-4 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-rebrand-sm bg-amber/20 grid place-items-center text-amber-2 shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-ink leading-tight">
                      Você foi convidado pro Bolão Copa 2026
                    </p>
                    <p className="text-[12px] text-ink-2 mt-1 leading-snug">
                      Crie sua conta (grátis) ou entre — depois você cai direto no bolão pra palpitar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Tabs defaultValue={fromBolaoInvite ? "signup" : "signin"} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-canvas-2 p-1 rounded-rebrand-md mb-5">
                <TabsTrigger
                  value="signin"
                  className="rounded-rebrand-sm data-[state=active]:bg-white data-[state=active]:text-forest data-[state=active]:shadow-sm font-semibold text-ink-2 text-[13px]"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-rebrand-sm data-[state=active]:bg-white data-[state=active]:text-forest data-[state=active]:shadow-sm font-semibold text-ink-2 text-[13px]"
                >
                  Criar conta
                </TabsTrigger>
              </TabsList>

              {/* ─── SignIn ─── */}
              <TabsContent value="signin" className="mt-0">
                <div className="bg-white border border-line rounded-rebrand-xl p-6 sm:p-7 shadow-sm">
                  <h3 className="font-display text-[20px] font-extrabold text-ink mb-1">
                    Entrar
                  </h3>
                  <p className="text-[13px] text-ink-2 mb-5">
                    Bom te ver de volta. Coloca os dados aí.
                  </p>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                        E-mail
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-canvas border-line text-ink h-11 rounded-rebrand-md focus-visible:border-forest focus-visible:ring-forest/20"
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                        Senha
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </div>
              </TabsContent>

              {/* ─── SignUp ─── */}
              <TabsContent value="signup" className="mt-0">
                <div className="bg-white border border-line rounded-rebrand-xl p-6 sm:p-7 shadow-sm">
                  <h3 className="font-display text-[20px] font-extrabold text-ink mb-1">
                    Criar conta
                  </h3>
                  <p className="text-[13px] text-ink-2 mb-5">
                    {fromBolaoInvite ? 'Grátis. Sem cartão. Você cria o bolão logo em seguida.' : 'Grátis. Sem cartão. Comece agora.'}
                  </p>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                        Nome completo
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="bg-canvas border-line text-ink h-11 rounded-rebrand-md focus-visible:border-forest focus-visible:ring-forest/20"
                        placeholder="Como te chamam"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                        E-mail
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-canvas border-line text-ink h-11 rounded-rebrand-md focus-visible:border-forest focus-visible:ring-forest/20"
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-password" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                          Senha
                        </Label>
                        <Input
                          id="signup-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="bg-canvas border-line text-ink h-11 rounded-rebrand-md focus-visible:border-forest focus-visible:ring-forest/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="confirm-password" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                          Confirmar
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
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-phone" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                        Telefone
                      </Label>
                      <div className="flex gap-2">
                        <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode}>
                          <SelectTrigger className="w-[110px] bg-canvas border-line text-ink h-11 rounded-rebrand-md">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="theme-bolao bg-white border-line text-ink">
                            <SelectItem value="+55">🇧🇷 +55</SelectItem>
                            <SelectItem value="+1">🇺🇸 +1</SelectItem>
                            <SelectItem value="+54">🇦🇷 +54</SelectItem>
                            <SelectItem value="+56">🇨🇱 +56</SelectItem>
                            <SelectItem value="+57">🇨🇴 +57</SelectItem>
                            <SelectItem value="+351">🇵🇹 +351</SelectItem>
                            <SelectItem value="+34">🇪🇸 +34</SelectItem>
                            <SelectItem value="+39">🇮🇹 +39</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="(11) 99999-9999"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 bg-canvas border-line text-ink h-11 rounded-rebrand-md focus-visible:border-forest focus-visible:ring-forest/20"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        Pra conectar com o bot do Telegram (opcional).
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="referral-code" className="text-[12px] font-semibold text-ink-2 uppercase tracking-wide">
                        Código do amigo <span className="text-ink-3 normal-case font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="referral-code"
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        placeholder="ABC123"
                        maxLength={6}
                        className="font-mono text-center text-[15px] tracking-wider bg-canvas border-line text-ink h-11 rounded-rebrand-md focus-visible:border-forest focus-visible:ring-forest/20"
                      />
                      {referralCode && (
                        <p className="text-[11px] text-forest font-medium mt-0.5 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Indicação registrada
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      variant="forest"
                      size="lg"
                      disabled={loading}
                      className="w-full rounded-rebrand-md h-11"
                    >
                      {loading ? "Criando..." : "Criar conta"}
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>

            <p className="text-[11px] text-ink-3 text-center mt-5">
              Ao continuar você concorda com os termos de uso.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Auth;
