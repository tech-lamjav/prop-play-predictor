import React, { useState, useEffect } from 'react';
import { createClient } from '../integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Copy, Users, Mail, Check } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface Referral {
  referred_id: string;
  referred_email: string;
  referred_name: string | null;
  referral_code: string;
  created_at: string;
}

interface ReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  referralCode: string | null;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  open,
  onOpenChange,
  userId,
  referralCode,
}) => {
  const { toast } = useToast();
  const supabase = createClient();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const referralLink = referralCode
    ? `https://www.smartbetting.app/betinho?ref=${referralCode}`
    : '';

  useEffect(() => {
    if (open && userId) {
      fetchReferrals();
    }
  }, [open, userId]);

  const fetchReferrals = async () => {
    try {
      setIsLoading(true);
      
      if (!userId) {
        setReferrals([]);
        return;
      }

      // Use the function to get referrals from users table
      // This bypasses RLS and uses the referred_by field
      const { data, error } = await supabase
        .rpc('get_user_referrals_from_users', {
          p_user_id: userId
        });

      if (error) {
        console.error('Error fetching referrals:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log('Referrals fetched:', data);
      
      // Transform the data to match the Referral interface
      const transformedData = (data || []).map((item: any) => ({
        referred_id: item.referred_id,
        referred_email: item.referred_email || '',
        referred_name: item.referred_name || null,
        referral_code: item.referral_code || referralCode || '',
        created_at: item.created_at
      }));
      
      setReferrals(transformedData as Referral[]);
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setReferrals([]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
      toast({
        title: 'Copiado!',
        description: type === 'link' ? 'Link copiado para a área de transferência' : 'Código copiado para a área de transferência',
      });
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-terminal-green">
            <Users className="w-5 h-5" />
            Indique um amigo
          </DialogTitle>
          <DialogDescription className="text-terminal-text opacity-60">
            Compartilhe seu link ou código e ganhe descontos progressivos na assinatura
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Link completo */}
          <div className="space-y-2">
            <Label className="text-xs uppercase opacity-70">Link completo</Label>
            <div className="flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="bg-terminal-black border-terminal-border text-terminal-text text-sm"
              />
              <Button
                onClick={() => copyToClipboard(referralLink, 'link')}
                className="bg-terminal-green hover:bg-terminal-green-bright text-white px-4"
                disabled={!referralCode}
              >
                {copiedLink ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Código separado */}
          <div className="space-y-2">
            <Label className="text-xs uppercase opacity-70">Código do amigo</Label>
            <div className="flex gap-2">
              <Input
                value={referralCode || ''}
                readOnly
                className="bg-terminal-black border-terminal-border text-terminal-text text-sm font-mono text-center text-lg tracking-wider"
              />
              <Button
                onClick={() => copyToClipboard(referralCode || '', 'code')}
                className="bg-terminal-green hover:bg-terminal-green-bright text-white px-4"
                disabled={!referralCode}
              >
                {copiedCode ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Indicações feitas */}
          <div className="space-y-2 border-t border-terminal-border-subtle pt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs uppercase opacity-70 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Indicações feitas
              </Label>
              <div className="flex items-center gap-2">
                <div className="bg-terminal-green/20 border border-terminal-green/50 rounded px-3 py-1">
                  <span className="text-terminal-green font-bold text-lg">{referrals.length}</span>
                </div>
                <span className="text-xs opacity-60">usuários indicados</span>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-4 text-sm opacity-50">
                Carregando...
              </div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-4 text-sm opacity-50">
                Nenhuma indicação ainda. Compartilhe seu link para começar!
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {referrals.map((referral) => (
                  <div
                    key={referral.referred_id}
                    className="bg-terminal-black border border-terminal-border-subtle rounded p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Mail className="w-4 h-4 text-terminal-blue flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-terminal-text truncate">
                          {referral.referred_name || referral.referred_email}
                        </p>
                        {referral.referred_name && (
                          <p className="text-xs opacity-60 truncate">
                            {referral.referred_email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs opacity-50 ml-2 flex-shrink-0">
                      {new Date(referral.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Informação sobre descontos */}
          <div className="bg-terminal-black border border-terminal-border-subtle rounded p-3 text-xs opacity-60">
            <p className="text-center">
              Cada indicação que se cadastra neste mês te dá 25% de desconto no próximo mês
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

