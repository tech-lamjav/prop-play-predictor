import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, MessageCircle, Smartphone, AlertCircle } from 'lucide-react';
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
      // Validate WhatsApp number format
      const cleanNumber = whatsappNumber.replace(/\D/g, '');
      if (cleanNumber.length < 10) {
        throw new Error('Número de WhatsApp inválido');
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

  const handleWhatsAppSync = () => {
    const message = "Oi, gostaria de sincronizar minha conta Smart In Bet";
    const whatsappUrl = `https://wa.me/5511999999999?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp with pre-filled message
    window.open(whatsappUrl, '_blank');
    
    // Show success message
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
            <MessageCircle className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle>Configure seu WhatsApp</CardTitle>
          <CardDescription>
            Para receber notificações e enviar apostas via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleWhatsAppNumberSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Número do WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="(11) 99999-9999"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                required
              />
              <p className="text-sm text-gray-500">
                Inclua o código do país (ex: +55 para Brasil)
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
          <CardTitle>Sincronize sua conta</CardTitle>
          <CardDescription>
            Envie uma mensagem para sincronizar sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Instruções:</strong>
            </p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Clique no botão abaixo</li>
              <li>Será aberto o WhatsApp com uma mensagem pré-definida</li>
              <li>Envie a mensagem para nosso bot</li>
              <li>Volte aqui e clique em "Concluir"</li>
            </ol>
          </div>

          <Button 
            onClick={handleWhatsAppSync} 
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Abrir WhatsApp
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
          <CardTitle>WhatsApp Configurado!</CardTitle>
          <CardDescription>
            Sua conta foi sincronizada com sucesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ Agora você pode enviar apostas via WhatsApp
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
