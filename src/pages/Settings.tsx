import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import UserNav from '../components/UserNav';
import { useSettingsData } from '../hooks/use-settings-data';
import { useFutebolPublicationAlerts } from '../hooks/use-futebol-publication-alerts';
import { onboardingHref, ONBOARDING_SRC_ALERTAS_FUTEBOL } from '../utils/onboarding-return';
import { useToast } from '../hooks/use-toast';
import { stripeService } from '../services/stripe.service';
import { User, CreditCard, ArrowLeft, Send, ExternalLink, Compass, Bell } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { telegramBotUrl } from '../config/environment';
import AnalyticsNav from '@/components/AnalyticsNav';
import { resetAllOnboarding } from '../components/onboarding/useOnboardingTour';
import { SECOES, secaoAtiva, type SecaoId } from '../utils/settings-secoes';
import { localeDoDateFns } from '@/utils/locale-do-date-fns';

/**
 * O ícone de cada seção. Mora aqui, e não no catálogo: ícone é JSX, e o catálogo
 * precisa ser dado puro para o teste dele não ter que renderizar nada.
 */
const ICONE_DA_SECAO: Record<SecaoId, typeof User> = {
  perfil: User,
  alertas: Bell,
  assinatura: CreditCard,
  tour: Compass,
};

const COUNTRY_CODES = [
  { value: '+55', label: '🇧🇷 +55' },
  { value: '+1', label: '🇺🇸 +1' },
  { value: '+54', label: '🇦🇷 +54' },
  { value: '+56', label: '🇨🇱 +56' },
  { value: '+57', label: '🇨🇴 +57' },
  { value: '+351', label: '🇵🇹 +351' },
  { value: '+34', label: '🇪🇸 +34' },
  { value: '+39', label: '🇮🇹 +39' },
];

function parseStoredPhone(stored: string | null): { countryCode: string; number: string } {
  if (!stored) return { countryCode: '+55', number: '' };
  const digits = stored.replace(/\D/g, '');
  const codes = ['55', '1', '54', '56', '57', '351', '34', '39'];
  for (const c of codes) {
    if (digits.startsWith(c)) {
      return { countryCode: `+${c}`, number: digits.slice(c.length) };
    }
  }
  return { countryCode: '+55', number: digits };
}

function formatCreatedAt(iso: string): string {
  if (!iso) return '—';
  try {
    const date = parseISO(iso);
    return isValid(date) ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: localeDoDateFns() }) : '—';
  } catch {
    return '—';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const date = parseISO(iso);
    return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: localeDoDateFns() }) : '—';
  } catch {
    return '—';
  }
}

export default function Settings() {
  const { t } = useTranslation('conta');
  const navigate = useNavigate();

  // A seção aberta vive na URL, e não em estado local.
  //
  // Assim ela sobrevive ao recarregar e vira link: "vá em Configurações, aba
  // Alertas" passa a ser um endereço que se manda, em vez de uma instrução que
  // se digita. É o mesmo caminho que a tela do jogo já usa para o mercado aberto.
  //
  // `replace` de propósito: trocar de seção não é navegar, e empilhar as quatro
  // no histórico faria o botão Voltar percorrer abas em vez de sair da tela.
  const [searchParams, setSearchParams] = useSearchParams();
  const secao = secaoAtiva(searchParams.get('secao'));
  const abrirSecao = (id: SecaoId) => {
    const proximo = new URLSearchParams(searchParams);
    proximo.set('secao', id);
    setSearchParams(proximo, { replace: true });
  };
  const { toast } = useToast();
  const { profile, subscription, isLoading, isSaving, error, updateProfile } = useSettingsData();
  const { data: publicationAlerts, isLoading: isLoadingPublicationAlerts, isSaving: isSavingPublicationAlerts, setEnabled } = useFutebolPublicationAlerts();

  const [portalLoading, setPortalLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    countryCode: '+55',
    phoneNumber: '',
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      const { countryCode, number } = parseStoredPhone(profile.whatsapp_number);
      setFormData({
        name: profile.name ?? '',
        email: profile.email ?? '',
        countryCode,
        phoneNumber: number,
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    const fullPhone =
      formData.phoneNumber.trim().length > 0
        ? formData.countryCode.replace(/\D/g, '') + formData.phoneNumber.replace(/\D/g, '')
        : null;

    const ok = await updateProfile({
      name: formData.name.trim() || null,
      email: formData.email.trim(),
      whatsapp_number: fullPhone,
    });

    if (ok) {
      setSuccessMessage(t('configuracoes.perfil.sucesso'));
      toast({
        title: t('configuracoes.perfil.toastSucesso'),
        description: t('configuracoes.perfil.toastSucessoTexto'),
      });
    } else {
      toast({
        title: t('configuracoes.erro'),
        description: t('configuracoes.perfil.toastErroTexto'),
        variant: 'destructive',
      });
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const url = await stripeService.createCustomerPortalSession();
      window.location.href = url;
    } catch (err) {
      toast({
        title: t('configuracoes.erro'),
        description: err instanceof Error ? err.message : t('configuracoes.assinatura.toastErroTexto'),
        variant: 'destructive',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handlePublicationAlerts = async () => {
    if (!publicationAlerts) return;
    try {
      const enabled = !publicationAlerts.enabled;
      await setEnabled(enabled);
      toast({
        title: enabled
          ? t('configuracoes.alertas.toastRetomados')
          : t('configuracoes.alertas.toastPausados'),
        description: enabled
          ? t('configuracoes.alertas.toastRetomadosTexto')
          : t('configuracoes.alertas.toastPausadosTexto'),
      });
    } catch (err) {
      toast({
        title: t('configuracoes.alertas.toastErro'),
        description: err instanceof Error ? err.message : t('configuracoes.alertas.toastErroTexto'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink flex flex-col">
      <AnalyticsNav variant="rebrand" showBack title={t('configuracoes.titulo')} />

      <div className="container mx-auto px-4 py-8 max-w-5xl flex-1">
        {/* "do Perfil" saiu do título: perfil virou UMA das quatro seções, e o
            título não pode nomear só ela. */}
        <h1 className="text-2xl font-bold text-ink mb-6">{t('configuracoes.titulo')}</h1>

        <div className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-8 items-start">
          {/* No COMPUTADOR a navegação é uma coluna ao lado, com o resumo de cada
              seção embaixo do nome. É o resumo que responde "onde eu mexo no
              Telegram?" sem obrigar a abrir as quatro.

              No CELULAR vira uma fileira que rola, como as outras fileiras desta
              casa, e o resumo sai: em 360px ele empurraria a quarta seção para
              fora da vista antes de a pessoa saber que ela existe.

              min-w-0 junto do overflow-x-auto, e o par é obrigatório: item de
              flex nasce com min-width auto, que o proíbe de encolher abaixo do
              próprio conteúdo, e no CSS o min-width ganha do max-width. Sem ele a
              fileira passa da margem da página em vez de rolar dentro dela. */}
          <nav className="flex md:flex-col gap-1.5 min-w-0 overflow-x-auto no-scrollbar md:overflow-visible">
            {SECOES.map((sec) => {
              const Icone = ICONE_DA_SECAO[sec.id];
              const ativa = sec.id === secao;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => abrirSecao(sec.id)}
                  aria-current={ativa ? 'page' : undefined}
                  /* Fundo em TODAS, e não só na aberta.

                     Sem fundo, as três fechadas viravam texto solto no bege da
                     página: nada dizia que dá para clicar nelas, e a aberta
                     parecia a única coisa ali. Agora toda seção é um cartão.

                     O par de cores sai do guia visual, e não de invenção:
                     secundário é branco com borda, primário é forest com texto
                     branco. É o mesmo contraste dos botões da casa, então a
                     seção aberta lê como escolha feita, e não como destaque. */
                  className={`shrink-0 md:shrink text-left rounded-rebrand-md border px-3 py-2.5 cursor-pointer transition flex items-center gap-2.5 ${
                    ativa
                      ? 'bg-forest border-forest shadow-sm'
                      : 'bg-white border-line hover:bg-canvas-2'
                  }`}
                >
                  <Icone className={`h-4 w-4 shrink-0 ${ativa ? 'text-white' : 'text-ink-2'}`} />
                  <span className="min-w-0">
                    <span className={`block text-[13.5px] whitespace-nowrap ${ativa ? 'font-semibold text-white' : 'font-medium text-ink'}`}>
                      {t(sec.rotulo)}
                    </span>
                    <span className={`hidden md:block text-[11px] truncate ${ativa ? 'text-white/65' : 'text-ink-3'}`}>{t(sec.resumo)}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">

        {secao === 'perfil' && (
        <Card className="bg-white border border-line text-ink">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-forest" />
              <CardTitle>{t('configuracoes.perfil.titulo')}</CardTitle>
            </div>
            <CardDescription>{t('configuracoes.perfil.descricao')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('configuracoes.perfil.nome')}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t('configuracoes.perfil.nomeExemplo')}
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="bg-white border-line"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('configuracoes.perfil.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('configuracoes.perfil.emailExemplo')}
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="bg-white border-line"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('configuracoes.perfil.telefone')}</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.countryCode}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, countryCode: v }))}
                  >
                    <SelectTrigger className="w-[120px] bg-white border-line text-ink">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="theme-bolao bg-white border-line text-ink">
                      {COUNTRY_CODES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phoneNumber: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    className="flex-1 bg-white border-line"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-ink-2">
                  {t('configuracoes.perfil.ressincronizarAviso')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(`${telegramBotUrl}?start=force_contact`, '_blank')
                  }
                  className="bg-white border-line text-ink hover:bg-canvas-2 hover:text-ink"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {t('configuracoes.perfil.ressincronizar')}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>{t('configuracoes.perfil.contaCriadaEm')}</Label>
                <Input
                  value={isLoading ? t('configuracoes.carregando') : (profile ? formatCreatedAt(profile.created_at) : '—')}
                  readOnly
                  disabled
                  className="bg-canvas-2 border-line text-ink-2"
                />
              </div>

              {(error || successMessage) && (
                <Alert variant={error ? 'destructive' : 'default'}>
                  <AlertDescription>{error ?? successMessage}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={isSaving} className="bg-forest hover:bg-forest-soft text-white">
                {isSaving ? t('configuracoes.salvando') : t('configuracoes.perfil.salvar')}
              </Button>
            </form>
          </CardContent>
        </Card>

        )}

        {/* Alertas de oportunidades */}

        {secao === 'alertas' && (
        <Card className="bg-white border border-line text-ink">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-forest" />
              <CardTitle>{t('configuracoes.alertas.titulo')}</CardTitle>
            </div>
            <CardDescription>{t('configuracoes.alertas.descricao')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingPublicationAlerts || !publicationAlerts ? (
              <p className="text-sm text-ink-2">{t('configuracoes.carregando')}</p>
            ) : !publicationAlerts.accessActive ? (
              // Acesso inativo vem antes do vínculo: nada é entregue nesse
              // estado, então chamar para conectar prometeria algo que o
              // backend não cumpre.
              <>
                <p className="text-sm text-ink-2">
                  {t('configuracoes.alertas.semAcesso', {
                    estado: publicationAlerts.enabled
                      ? t('configuracoes.alertas.estadoAtivada')
                      : t('configuracoes.alertas.estadoPausada'),
                  })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePublicationAlerts}
                  disabled={isSavingPublicationAlerts}
                  className="bg-white border-line text-ink hover:bg-canvas-2 hover:text-ink"
                >
                  {publicationAlerts.enabled
                    ? t('configuracoes.alertas.pausarParaDepois')
                    : t('configuracoes.alertas.retomarParaDepois')}
                </Button>
              </>
            ) : !publicationAlerts.telegramLinked ? (
              <>
                <p className="text-sm text-ink-2">
                  {t('configuracoes.alertas.convite')}
                </p>
                {/* Vai para o onboarding já existente, e não direto ao bot: é lá
                    que a conexão é explicada e confirmada. */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(onboardingHref(ONBOARDING_SRC_ALERTAS_FUTEBOL, '/settings'))}
                  className="bg-white border-line text-ink hover:bg-canvas-2 hover:text-ink"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {t('configuracoes.alertas.conectar')}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${publicationAlerts.enabled ? 'bg-forest/10 text-forest' : 'bg-canvas-2 text-ink-2'}`}>
                    {publicationAlerts.enabled
                      ? t('configuracoes.alertas.ativos')
                      : t('configuracoes.alertas.pausados')}
                  </span>
                  <p className="text-sm text-ink-2">
                    {publicationAlerts.enabled
                      ? t('configuracoes.alertas.ativosTexto')
                      : t('configuracoes.alertas.pausadosTexto')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={publicationAlerts.enabled ? 'outline' : 'default'}
                  onClick={handlePublicationAlerts}
                  disabled={isSavingPublicationAlerts}
                  className={publicationAlerts.enabled ? 'bg-white border-line text-ink hover:bg-canvas-2 hover:text-ink' : 'bg-forest hover:bg-forest-soft text-white'}
                >
                  {isSavingPublicationAlerts
                    ? t('configuracoes.salvando')
                    : publicationAlerts.enabled
                      ? t('configuracoes.alertas.pausar')
                      : t('configuracoes.alertas.retomar')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        )}

        {/* Assinatura */}

        {secao === 'assinatura' && (
        <Card className="bg-white border border-line text-ink">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-ink-2" />
              <CardTitle>{t('configuracoes.assinatura.titulo')}</CardTitle>
            </div>
            <CardDescription>{t('configuracoes.assinatura.descricao')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-ink-2">{t('configuracoes.carregando')}</p>
            ) : (
              <>
                {/* Betinho */}
                <div className="space-y-2 rounded-lg border border-line p-4">
                  {/* "Betinho" é nome próprio e não passa pelo catálogo. */}
                  <h4 className="font-medium text-sm">Betinho</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-ink-2">{t('configuracoes.assinatura.plano')}</span>
                    <span className="font-medium">
                      {subscription?.betinho.status === 'premium' ? 'Premium' : 'Free'}
                    </span>
                  </div>
                  {subscription?.betinho.periodEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-2">{t('configuracoes.assinatura.proximaCobranca')}</span>
                      <span className="text-sm">{formatDate(subscription.betinho.periodEnd)}</span>
                    </div>
                  )}
                  {subscription?.betinho.cancelAtPeriodEnd && subscription?.betinho.cancelAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-2">{t('configuracoes.assinatura.cancelaEm')}</span>
                      <span className="text-sm text-amber-2">{formatDate(subscription.betinho.cancelAt)}</span>
                    </div>
                  )}
                </div>
                {/* Plataforma */}
                <div className="space-y-2 rounded-lg border border-line p-4">
                  <h4 className="font-medium text-sm">{t('configuracoes.assinatura.plataformaNba')}</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-ink-2">{t('configuracoes.assinatura.plano')}</span>
                    <span className="font-medium">
                      {subscription?.analytics.status === 'premium' ? 'Premium' : 'Free'}
                    </span>
                  </div>
                  {subscription?.analytics.periodEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-2">{t('configuracoes.assinatura.proximaCobranca')}</span>
                      <span className="text-sm">{formatDate(subscription.analytics.periodEnd)}</span>
                    </div>
                  )}
                  {subscription?.analytics.cancelAtPeriodEnd && subscription?.analytics.cancelAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-2">{t('configuracoes.assinatura.cancelaEm')}</span>
                      <span className="text-sm text-amber-2">{formatDate(subscription.analytics.cancelAt)}</span>
                    </div>
                  )}
                </div>
                {(subscription?.hasStripeCustomer || subscription?.betinho.status === 'premium' || subscription?.analytics.status === 'premium') ? (
                  <div className="pt-2">
                    <Button
                      variant="default"
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                      className="bg-forest hover:bg-forest-soft text-white"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {portalLoading
                        ? t('configuracoes.assinatura.abrindo')
                        : t('configuracoes.assinatura.gerenciar')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-ink-2">
                    {t('configuracoes.assinatura.semPlano')}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        )}

        {secao === 'tour' && (
        <Card className="bg-white border border-line text-ink">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-forest" />
              <CardTitle>{t('configuracoes.tour.titulo')}</CardTitle>
            </div>
            <CardDescription>{t('configuracoes.tour.descricao')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-2 mb-3">
              {t('configuracoes.tour.texto')}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetAllOnboarding();
                navigate('/inicio');
              }}
              className="bg-white border-line text-ink hover:bg-canvas-2 hover:text-ink"
            >
              <Compass className="w-4 h-4 mr-2" />
              {t('configuracoes.tour.botao')}
            </Button>
          </CardContent>
        </Card>
        )}
          </div>
        </div>
      </div>

    </div>
  );
}
