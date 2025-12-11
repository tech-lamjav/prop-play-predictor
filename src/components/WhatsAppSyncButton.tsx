import React from 'react';
import { Button } from './ui/button';
import { MessageCircle, CheckCircle, AlertCircle, Send } from 'lucide-react';
import { useWhatsAppSync } from '../hooks/use-whatsapp-sync';

interface WhatsAppSyncButtonProps {
  userId: string;
  onSyncComplete?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export default function WhatsAppSyncButton({ 
  userId, 
  onSyncComplete,
  variant = 'default',
  size = 'default',
  className = ''
}: WhatsAppSyncButtonProps) {
  const { isSynced, isLoading, error, syncWhatsApp } = useWhatsAppSync(userId);

  const handleSync = () => {
    const telegramUrl = 'https://t.me/betinho_assistente_bot';
    window.open(telegramUrl, '_blank');
    alert('No Telegram, toque em Start (/start) e depois em “Enviar meu número”.');
  };

  const handleConfirmSync = async () => {
    // In a real implementation, this would be called when the webhook receives the message
    // For now, we'll simulate the sync
    const success = await syncWhatsApp('temp-conversation-id');
    if (success && onSyncComplete) {
      onSyncComplete();
    }
  };

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <MessageCircle className="w-4 h-4 mr-2 animate-spin" />
        Sincronizando...
      </Button>
    );
  }

  if (isSynced) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
        Telegram sincronizado
      </Button>
    );
  }

  if (error) {
    return (
      <Button 
        variant={variant} 
        size={size} 
        onClick={handleSync}
        className={className}
      >
        <AlertCircle className="w-4 h-4 mr-2 text-red-600" />
        Tentar Novamente
      </Button>
    );
  }

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleSync}
      className={className}
    >
      <Send className="w-4 h-4 mr-2" />
      Abrir bot no Telegram
    </Button>
  );
}
