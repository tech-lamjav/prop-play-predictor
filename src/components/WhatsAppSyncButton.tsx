import React from 'react';
import { Button } from './ui/button';
import { MessageCircle, CheckCircle, AlertCircle } from 'lucide-react';
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
    const message = "Oi, gostaria de sincronizar minha conta Smart In Bet";
    const whatsappUrl = `https://wa.me/5511952132563?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp with pre-filled message
    window.open(whatsappUrl, '_blank');
    
    // Show instructions
    alert('Envie a mensagem no WhatsApp e aguarde a confirmação. Em seguida, clique novamente neste botão para confirmar a sincronização.');
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
        WhatsApp Sincronizado
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
      <MessageCircle className="w-4 h-4 mr-2" />
      Sincronizar WhatsApp
    </Button>
  );
}
