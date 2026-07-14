import { supabase } from '@/integrations/supabase/client';

/**
 * URL pública do brasão do time no nosso Storage (bucket futebol-team-logos),
 * populado pela edge function mirror-futebol-team-logos. Usar por team_id.
 * Se o bucket ainda não tiver o arquivo, o <img> 404 → o componente Crest cai
 * pras iniciais (onError).
 */
export function getFutebolTeamLogoUrl(teamId: number | null | undefined): string | null {
  if (!teamId) return null;
  const { data } = supabase.storage.from('futebol-team-logos').getPublicUrl(`${teamId}.png`);
  return data.publicUrl;
}

/**
 * URL pública da foto do jogador no nosso Storage (bucket futebol-player-photos),
 * espelhada da API-Sports pela edge function mirror-futebol-player-photos. Por player_id.
 * 404 → o componente cai pras iniciais (onError).
 */
export function getFutebolPlayerPhotoUrl(playerId: number | null | undefined): string | null {
  if (!playerId) return null;
  const { data } = supabase.storage.from('futebol-player-photos').getPublicUrl(`${playerId}.png`);
  return data.publicUrl;
}
