import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import UserNav from '../components/UserNav';
import { useSettingsData } from '../hooks/use-settings-data';
import { useToast } from '../hooks/use-toast';
import { stripeService } from '../services/stripe.service';
import { User, CreditCard, ArrowLeft, Send, ExternalLink, Compass } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { telegramBotUrl } from '../config/environment';
import AnalyticsNav from '@/components/AnalyticsNav';
import { resetOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { HUB_TOUR_ID } from '../components/onboarding/tours';

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
    return isValid(date) ? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';
  } catch {
    return '—';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const date = parseISO(iso);
    return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '—';
  } catch {
    return '—';
  }
}

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, subscription, isLoading, isSaving, error, updateProfile } = useSettingsData();

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
      setSuccessMessage('Alterações salvas com sucesso.');
      toast({ title: 'Sucesso', description: 'Perfil atualizado.' });
    } else {
      toast({ title: 'Erro', description: 'Falha ao salvar alterações.', variant: 'destructive' });
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const url = await stripeService.createCustomerPortalSession();
      window.location.href = url;
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao abrir portal.',
        variant: 'destructive',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink flex flex-col">
      <AnalyticsNav variant="rebrand" showBack title="Configurações" />

      <div className="container mx-auto px-4 py-8 max-w-2xl flex-1">
        <h1 className="text-2xl font-bold text-ink mb-6">Configurações do Perfil</h1>

        {/* Perfil */}
        <Card className="mb-8 bg-white border border-line text-ink">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-forest" />
              <CardTitle>Perfil</CardTitle>
            </div>
            <CardDescription>Suas informações pessoais</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="bg-white border-line"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="bg-white border-line"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone / Telegram ID</Label>
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
                  Se mudou seu número no Telegram, toque para ressincronizar.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(`${telegramBotUrl}?start=force_contact`, '_blank')
                  }
                  className="bg-white border-line text-ink hover:bg-canvas-2"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Ressincronizar Telegram
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Conta criada em</Label>
                <Input
                  value={isLoading ? 'Carregando...' : (profile ? formatCreatedAt(profile.created_at) : '—')}
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
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Assinatura */}
        <Card className="bg-white border border-line text-ink">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-ink-2" />
              <CardTitle>Assinatura</CardTitle>
            </div>
            <CardDescription>Gerencie seu plano e pagamentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-ink-2">Carregando...</p>
            ) : (
              <>
                {/* Betinho */}
                <div className="space-y-2 rounded-lg border border-line p-4">
                  <h4 className="font-medium text-sm">Betinho</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-ink-2">Plano</span>
                    <span className="font-medium">
                      {subscription?.betinho.status === 'premium' ? 'Premium' : 'Free'}
                    </span>
                  </div>
                  {subscription?.betinho.periodEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-2">Próxima cobrança</span>
                      <span className="text-sm">{formatDate(subscription.betinho.periodEnd)}</span>
                    </div>
                  )}
                  {subscription?.betinho.cancelAtPeriodEnd && subscription?.betinho.cancelAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-2">Cancela em</span>
                      <span className="text-sm text-amber-2">{formatDate(subscription.betinho.cancelAt)}</span>
                    </div>
                  )}
                </div>
                {/* Plataforma */}
                <div className="space-y-2 rounded-lg border border-line p-4">
                  <h4 className="font-medium text-sm">Plataforma de Análise NBA</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-ink-2">Plano</span>
                    <span className="font-medium">
                      {subscription?.analytics.status === 'premium' ? 'Premium' : 'Free'}
                    </span>
                  </div>
                  {subscription?.analytics.periodEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-2">Próxima cobrança</span>
                      <span className="text-sm">{formatDate(subscription.analytics.periodEnd)}</span>
                    </div>
                  )}
                  {subscription?.analytics.cancelAtPeriodEnd && subscription?.analytics.cancelAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-ink-2">Cancela em</span>
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
                      {portalLoading ? 'Abrindo...' : 'Gerenciar assinatura'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-ink-2">
                    Assine um plano para gerenciar sua assinatura.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Ajuda / Tour guiado */}
        <Card className="mt-8 bg-white border border-line text-ink">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-forest" />
              <CardTitle>Tour guiado</CardTitle>
            </div>
            <CardDescription>Rever a apresentação das áreas da plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetOnboardingTour(HUB_TOUR_ID);
                navigate('/inicio');
              }}
              className="bg-white border-line text-ink hover:bg-canvas-2"
            >
              <Compass className="w-4 h-4 mr-2" />
              Rever tour guiado
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
