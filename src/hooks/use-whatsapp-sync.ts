import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../integrations/supabase/client';

interface WhatsAppSyncState {
  isSynced: boolean;
  whatsappNumber: string | null;
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useWhatsAppSync(userId: string) {
  const [state, setState] = useState<WhatsAppSyncState>({
    isSynced: false,
    whatsappNumber: null,
    conversationId: null,
    isLoading: true,
    error: null
  });

  const supabase = createClient();

  const checkWhatsAppSync = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!userId) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('whatsapp_number, conversation_id, whatsapp_synced')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      setState(prev => ({
        ...prev,
        isSynced: data.whatsapp_synced || false,
        whatsappNumber: data.whatsapp_number,
        conversationId: data.conversation_id,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao verificar sincronização',
        isLoading: false
      }));
    }
  }, [userId, supabase]);

  useEffect(() => {
    if (userId && userId.trim() !== '') {
      checkWhatsAppSync();
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [userId, checkWhatsAppSync]);

  const updateWhatsAppNumber = async (whatsappNumber: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { error } = await supabase
        .from('users')
        .update({ whatsapp_number: whatsappNumber })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setState(prev => ({
        ...prev,
        whatsappNumber,
        isLoading: false
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao atualizar número',
        isLoading: false
      }));
      return false;
    }
  };

  const syncWhatsApp = async (conversationId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { error } = await supabase
        .rpc('sync_whatsapp', {
          user_id: userId,
          whatsapp_number: state.whatsappNumber,
          conversation_id: conversationId
        });

      if (error) {
        throw error;
      }

      setState(prev => ({
        ...prev,
        isSynced: true,
        conversationId,
        isLoading: false
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao sincronizar WhatsApp',
        isLoading: false
      }));
      return false;
    }
  };

  const resetSync = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { error } = await supabase
        .from('users')
        .update({ 
          whatsapp_synced: false,
          conversation_id: null,
          whatsapp_sync_token: null
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      setState(prev => ({
        ...prev,
        isSynced: false,
        conversationId: null,
        isLoading: false
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Erro ao resetar sincronização',
        isLoading: false
      }));
      return false;
    }
  };

  return {
    ...state,
    updateWhatsAppNumber,
    syncWhatsApp,
    resetSync,
    checkWhatsAppSync
  };
}
