import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import UserNav from '../components/UserNav';
import { 
  User, 
  MessageCircle, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Smartphone,
  Shield,
  BarChart3,
  Zap,
  Target,
  TrendingUp
} from 'lucide-react';
import { createClient } from '../integrations/supabase/client';

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsappNumber: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const supabase = createClient();

  const steps = [
    {
      id: 1,
      title: 'Informações Pessoais',
      description: 'Vamos começar com seus dados básicos',
      icon: User
    },
    {
      id: 2,
      title: 'Configuração WhatsApp',
      description: 'Sincronize sua conta para receber notificações',
      icon: MessageCircle
    },
    {
      id: 3,
      title: 'Finalização',
      description: 'Tudo pronto! Bem-vindo ao Smart In Bet',
      icon: CheckCircle
    }
  ];

  const progress = (currentStep / steps.length) * 100;

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
          
          if (userData.whatsapp_synced) {
            navigate('/bets');
          }
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

      // Validate WhatsApp number
      const cleanNumber = formData.whatsappNumber.replace(/\D/g, '');
      if (cleanNumber.length < 10) {
        throw new Error('Número de WhatsApp inválido');
      }

      // Update user with WhatsApp number
      const { error } = await supabase
        .from('users')
        .update({ whatsapp_number: cleanNumber })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar número do WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsAppSync = () => {
    const message = "Oi, gostaria de sincronizar minha conta Smart In Bet";
    const whatsappUrl = `https://wa.me/5511952132563?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp with pre-filled message
    window.open(whatsappUrl, '_blank');
    
    // Show success and move to next step
    setTimeout(() => {
      setCurrentStep(3);
    }, 2000);
  };

  const handleComplete = () => {
    navigate('/bets');
  };

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
        <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-green-600" />
        </div>
        <CardTitle>Configure seu WhatsApp</CardTitle>
        <CardDescription>
          Para receber notificações e enviar apostas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStep2Submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Número do WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              placeholder="(11) 99999-9999"
              value={formData.whatsappNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
              required
            />
            <p className="text-sm text-muted-foreground">
              Inclua o código do país (ex: +55 para Brasil)
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
        <CardTitle>Sincronize sua conta</CardTitle>
        <CardDescription>
          Envie uma mensagem para ativar o WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-foreground mb-2">
            <strong>Instruções:</strong>
          </p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Clique no botão abaixo</li>
            <li>Será aberto o WhatsApp com uma mensagem pré-definida</li>
            <li>Envie a mensagem para nosso bot</li>
            <li>Volte aqui e clique em "Finalizar"</li>
          </ol>
        </div>

        <Button 
          onClick={handleWhatsAppSync} 
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Abrir WhatsApp
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground">Smart In Bet</span>
          </div>
          <UserNav />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem-vindo ao Smart In Bet
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
              <h3 className="font-semibold text-foreground mb-2">WhatsApp Integration</h3>
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
