import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import UserNav from '../components/UserNav';
import AnalyticsNav from '../components/AnalyticsNav';
import {
  User,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Shield,
  BarChart3,
  Zap,
  Target,
  TrendingUp,
  Send,
  Gamepad2
} from 'lucide-react';
import { createClient } from '../integrations/supabase/client';

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const supabase = createClient();
  const isBetinhoOnly = searchParams.get('product') === 'betinho' || (location.state as { onboardingProduct?: string })?.onboardingProduct === 'betinho';

  const [currentStep, setCurrentStep] = useState(isBetinhoOnly ? 1 : 0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsappNumber: '',
    countryCode: '+55' // Default to Brazil
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [whatsappSynced, setWhatsappSynced] = useState(false);

  const steps = [
    {
      id: 1,
      title: 'Informações Pessoais',
      description: 'Vamos começar com seus dados básicos',
      icon: User
    },
    {
      id: 2,
      title: 'Configuração Telegram',
      description: 'Conecte seu número ao bot do Telegram',
      icon: Send
    },
    {
      id: 3,
      title: 'Finalização',
      description: 'Conecte com o bot no Telegram',
      icon: CheckCircle
    }
  ];

  const progress = currentStep === 0 ? 0 : (currentStep / steps.length) * 100;
  const showChoiceStep = currentStep === 0;

  useEffect(() => {
    // Check if user is already authenticated
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Check if user already completed onboarding
        const { data: userData } = await supabase
          .from('users')
          .select('name, email, whatsapp_synced')
          .eq('id', user.id)
          .single();
        
        if (userData?.name && userData?.email) {
          setFormData({
            name: userData.name,
            email: userData.email,
            whatsappNumber: ''
          });
          setWhatsappSynced(!!userData.whatsapp_synced);
        }
      } else {
        navigate('/auth');
      }
    };

    checkUser();
  }, [navigate, supabase.auth]);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Update user information
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          email: formData.email
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar informações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Validate phone number (mantém o mesmo campo do backend)
      const cleanNumber = formData.whatsappNumber.replace(/\D/g, '');
      if (cleanNumber.length < 8) {
        throw new Error('Número de telefone inválido');
      }

      // Combine country code + number
      const fullNumber = formData.countryCode.replace(/\D/g, '') + cleanNumber;

      // Update user with phone number (campo existente)
      const { error } = await supabase
        .from('users')
        .update({ whatsapp_number: fullNumber })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar número do Telegram');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTelegramOpen = () => {
    const telegramUrl = 'https://t.me/betinho_assistente_bot';
    window.open(telegramUrl, '_blank');
  };

  const handleComplete = () => {
    navigate('/bets');
  };

  const renderStep0 = () => (
    <div className="max-w-md mx-auto">
      <div className="terminal-container p-6 rounded-lg">
        <h2 className="section-title text-base md:text-lg text-center mb-2 text-terminal-green">
          O que você quer fazer primeiro?
        </h2>
        <p className="text-center text-sm text-terminal-text opacity-70 mb-6">
          Escolha como começar no Smartbetting
        </p>
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigate('/home-games')}
            className="terminal-button w-full h-auto py-6 flex flex-col items-center gap-2 rounded border-2 border-terminal-green/40 hover:border-terminal-green hover:bg-terminal-dark-gray/80 transition-all text-terminal-text"
          >
            <Gamepad2 className="w-8 h-8 text-terminal-green" />
            <span className="font-semibold text-terminal-green">Conhecer análises</span>
            <span className="text-sm text-terminal-text opacity-80 font-normal">
              Ver jogos, props e dashboards da NBA
            </span>
          </button>
          <button
            type="button"
            onClick={() => whatsappSynced ? navigate('/bets') : setCurrentStep(1)}
            className="terminal-button w-full h-auto py-6 flex flex-col items-center gap-2 rounded border-2 border-terminal-green/40 hover:border-terminal-green hover:bg-terminal-dark-gray/80 transition-all text-terminal-text"
          >
            <Send className="w-8 h-8 text-terminal-green" />
            <span className="font-semibold text-terminal-green">
              {whatsappSynced ? 'Acessar Betinho' : 'Configurar Betinho (Telegram)'}
            </span>
            <span className="text-sm text-terminal-text opacity-80 font-normal">
              {whatsappSynced ? 'Ir para suas apostas' : 'Registrar apostas via bot no Telegram'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <CardTitle>Informações Pessoais</CardTitle>
        <CardDescription>
          Vamos começar com seus dados básicos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStep1Submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome completo"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Continuar'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <Send className="w-6 h-6 text-blue-600" />
        </div>
        <CardTitle>Configure seu Telegram</CardTitle>
        <CardDescription>
          Conecte seu número ao bot do Telegram
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStep2Submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Número do Telegram</Label>
            <div className="flex gap-2">
              <Select
                value={formData.countryCode}
                onValueChange={(value) => setFormData(prev => ({ ...prev, countryCode: value }))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
                id="whatsapp"
                type="tel"
                placeholder="(11) 99999-9999"
                value={formData.whatsappNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setFormData(prev => ({ ...prev, whatsappNumber: value }));
                }}
                className="flex-1"
                required
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Código do país selecionado: {formData.countryCode}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setCurrentStep(1)}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Continuar'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-green-600" />
        </div>
        <CardTitle>Conecte com o bot</CardTitle>
        <CardDescription>
          Abra o bot no Telegram e compartilhe seu número
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-foreground mb-2">
            <strong>Instruções:</strong>
          </p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Clique no botão abaixo</li>
            <li>No Telegram, toque em <em>Start</em> (/start)</li>
            <li>Toque em “Enviar meu número” para sincronizar</li>
            <li>Depois, finalize aqui</li>
          </ol>
        </div>

        <Button 
          onClick={handleTelegramOpen}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <Send className="w-4 h-4 mr-2" />
          Abrir bot no Telegram
        </Button>

        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(2)}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button 
            onClick={handleComplete} 
            className="flex-1"
          >
            Finalizar
            <CheckCircle className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-terminal-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terminal-green"></div>
      </div>
    );
  }

  // Step 0: choice screen — same design system as analytics platform (terminal theme)
  if (showChoiceStep) {
    return (
      <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
        <AnalyticsNav />
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-wider text-terminal-green mb-2">
              BEM-VINDO AO SMARTBETTING
            </h1>
            <p className="text-sm text-terminal-text opacity-70">
              Escolha como começar
            </p>
          </div>
          {renderStep0()}
        </div>
      </div>
    );
  }

  // Betinho onboarding steps (1–3): original Smartbetting layout
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground">Smartbetting</span>
          </div>
          <UserNav />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao Smartbetting
          </h1>
          <p className="text-muted-foreground">
            Vamos configurar sua conta em poucos passos
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">
              Passo {currentStep} de {steps.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}% concluído
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps Navigation */}
        <div className="flex justify-center mb-8">
          <div className="flex space-x-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary border border-primary/20' 
                      : isCompleted 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex justify-center">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Features Preview */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Telegram Integration</h3>
              <p className="text-sm text-muted-foreground">
                Envie apostas via texto, áudio ou imagem
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Segurança</h3>
              <p className="text-sm text-muted-foreground">
                Seus dados protegidos com criptografia
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Acompanhe sua performance em tempo real
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
