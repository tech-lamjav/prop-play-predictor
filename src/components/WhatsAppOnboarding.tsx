import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, Smartphone, AlertCircle, Send } from 'lucide-react';
import { createClient } from '../integrations/supabase/client';

interface WhatsAppOnboardingProps {
  userId: string;
  onComplete: () => void;
}

export default function WhatsAppOnboarding({ userId, onComplete }: WhatsAppOnboardingProps) {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1); // 1: Input number, 2: Sync instructions, 3: Complete

  const supabase = createClient();

  const handleWhatsAppNumberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate phone number format (campo mantido no backend)
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      if (cleanNumber.length < 10) {
        throw new Error('Número inválido');
      }

      // Update user with WhatsApp number
      const { error: updateError } = await supabase
        .from('users')
        .update({ whatsapp_number: cleanNumber })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar número');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTelegramOpen = () => {
    const telegramUrl = 'https://t.me/betinho_assistente_bot';
    window.open(telegramUrl, '_blank');
    setSuccess(true);
    setStep(3);
  };

  const handleComplete = () => {
    onComplete();
  };

  if (step === 1) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Send className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>Número para o Betinho</CardTitle>
          <CardDescription>
            Este número será usado para conectar ao bot no Telegram e enviar apostas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleWhatsAppNumberSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Número para o Betinho</Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="(11) 99999-9999"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                required
              />
              <p className="text-sm text-gray-500">
                Inclua o código do país (ex: +55 para Brasil). Você pode colar o número.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Continuar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === 2) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle>Conecte com o bot</CardTitle>
          <CardDescription>
            Abra o bot no Telegram e compartilhe seu número
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Instruções:</strong>
            </p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Clique no botão abaixo</li>
              <li>No Telegram, toque em <em>Start</em> (/start)</li>
              <li>Toque em “Enviar meu número”</li>
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

          <Button 
            onClick={handleComplete} 
            variant="outline" 
            className="w-full"
          >
            Concluir Sincronização
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 3) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>Betinho configurado!</CardTitle>
          <CardDescription>
            Sua conta foi sincronizada com o bot no Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ Agora você pode enviar apostas via Telegram
              </p>
              <p className="text-sm text-green-800">
                ✅ Receberá notificações sobre suas apostas
              </p>
              <p className="text-sm text-green-800">
                ✅ Pode usar texto, áudio ou imagem
              </p>
            </div>

            <Button onClick={handleComplete} className="w-full">
              Ir para o Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
