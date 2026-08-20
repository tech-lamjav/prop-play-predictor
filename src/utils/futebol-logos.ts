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
 * URL pública do brasão do campeonato no nosso Storage (bucket
 * futebol-league-logos), populado pela edge function mirror-futebol-league-logos.
 * O arquivo é salvo com o nome do slug do mart (`brasileirao.png`), então a tela
 * não precisa conhecer o id da API. Sem arquivo, o <img> 404 → cai no troféu.
 */
export function getFutebolLeagueLogoUrl(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const { data } = supabase.storage.from('futebol-league-logos').getPublicUrl(`${slug}.png`);
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

/**
 * Sigla de até 3 letras pro fallback de imagem (escudo de time ou foto de jogador)
 * quando o mirror ainda não tem o arquivo. Mora aqui porque é sempre o outro lado
 * do mesmo `onError` dos getters acima.
 */
export function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}
