import { supabase } from '@/integrations/supabase/client';

/**
 * URL pública do brasão do time no Storage (bucket futebol-team-logos).
 * Se o bucket ainda não tiver o arquivo, o <img> 404 → o componente que usa
 * cai pras iniciais (onError). Portado de smartbetting.main.
 */
export function getFutebolTeamLogoUrl(teamId: number | null | undefined): string | null {
  if (!teamId) return null;
  const { data } = supabase.storage.from('futebol-team-logos').getPublicUrl(`${teamId}.png`);
  return data.publicUrl;
}
