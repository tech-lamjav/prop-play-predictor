import { useCallback, useRef } from 'react';
import { useAsync } from './use-async';
import { nbaDataService, Player } from '@/services/nba-data.service';

export interface UseAllPlayersReturn {
  players: Player[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

// Cache para evitar requisições desnecessárias quando navegando rapidamente
let cachedPlayers: Player[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30000; // 30 segundos

/**
 * Hook for loading all players with automatic cleanup and error handling.
 * Handles duplicate removal and provides a clean API for components.
 * Includes caching to prevent unnecessary requests when navigating.
 */
export function useAllPlayers(): UseAllPlayersReturn {
  const asyncFn = useCallback(async (signal?: AbortSignal) => {
    // Check cache first
    const now = Date.now();
    if (cachedPlayers && (now - cacheTimestamp) < CACHE_DURATION) {
      // Check if request was aborted before returning cached data
      if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      return cachedPlayers;
    }

    try {
      // Note: Supabase client doesn't directly support AbortSignal,
      // but we can check signal.aborted before processing results
      const playersData = await nbaDataService.getAllPlayers();
      
      // Check if request was aborted
      if (signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      
      // Remove duplicates based on player ID
      const uniquePlayers = playersData.filter((player, index, self) => 
        index === self.findIndex(p => p.player_id === player.player_id)
      );
      
      // Update cache
      cachedPlayers = uniquePlayers;
      cacheTimestamp = now;
      
      return uniquePlayers;
    } catch (error: any) {
      // If we have cached data and it's a service error, return cached data
      if (cachedPlayers && (
        error?.status === 503 || 
        error?.code === 'PGRST001' ||
        error?.message?.includes('Service Unavailable') ||
        error?.message?.includes('Database service unavailable') ||
        error?.message?.includes('BigQuery')
      )) {
        console.warn('Service unavailable, using cached players data:', error.message);
        return cachedPlayers;
      }
      // Otherwise, re-throw the error
      throw error;
    }
  }, []);

  const { data, loading, error, execute, reset } = useAsync<Player[]>({
    asyncFn,
    immediate: true,
    onError: (err) => {
      // Silently handle service errors if we have cached data
      if (cachedPlayers && (
        err?.message?.includes('service unavailable') ||
        err?.message?.includes('Database service') ||
        err?.message?.includes('BigQuery') ||
        err?.status === 503 ||
        err?.code === 'PGRST001'
      )) {
        // Don't log errors when we have cache - this is expected behavior
        return;
      }
      // Only log unexpected errors
      console.error('Error loading players:', err);
    },
  });

  const refetch = useCallback(async () => {
    // Clear cache on manual refetch
    cachedPlayers = null;
    cacheTimestamp = 0;
    await execute();
  }, [execute]);

  // If we have cached data and a service error, suppress the error
  const shouldSuppressError = cachedPlayers && error && (
    error.message?.includes('service unavailable') ||
    error.message?.includes('Database service') ||
    error.message?.includes('BigQuery') ||
    error.status === 503 ||
    error.code === 'PGRST001'
  );

  return {
    players: data || cachedPlayers || [],
    loading: loading && !cachedPlayers, // Don't show loading if we have cache
    error: shouldSuppressError ? null : error,
    refetch,
    reset,
  };
}

