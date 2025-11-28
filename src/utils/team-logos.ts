import { supabase } from '@/integrations/supabase/client';

/**
 * Get the public URL for a team logo from Supabase storage
 * @param teamName - Full team name (e.g., "Los Angeles Lakers", "New Orleans Pelicans")
 * @returns Public URL to the team logo SVG
 */
export function getTeamLogoUrl(teamName: string): string {
  if (!teamName) return '';
  
  // The logos are stored with the exact team name as the filename
  // e.g., "Los Angeles Lakers.svg"
  const fileName = `${teamName}.svg`;
  
  const { data } = supabase.storage
    .from('ui_images')
    .getPublicUrl(`team_logos/${fileName}`);
  
  return data.publicUrl;
}

/**
 * Get team logo URL with fallback to a placeholder
 * @param teamName - Full team name
 * @param fallbackText - Text to show in placeholder (defaults to team abbreviation)
 * @returns Public URL or placeholder URL
 */
export function getTeamLogoUrlWithFallback(
  teamName: string, 
  fallbackText?: string
): string {
  const logoUrl = getTeamLogoUrl(teamName);
  
  // If you want to add a fallback placeholder, you can return a data URL or placeholder service
  // For now, we'll just return the URL and let the component handle the fallback
  return logoUrl;
}

/**
 * Get the public URL for a player photo from Supabase storage
 * Photos are organized by team folders: ui_images/players/{team_name}/{player_name}.{ext}
 * @param playerName - Full player name (e.g., "LeBron James", "Stephen Curry")
 * @param teamName - Full team name (e.g., "Los Angeles Lakers")
 * @param extensions - Array of possible file extensions to try (default: ['avif', 'webp', 'png', 'jpg', 'jpeg'])
 * @returns Public URL to the player photo, or empty string if not found
 */
export function getPlayerPhotoUrl(
  playerName: string, 
  teamName: string,
  extensions: string[] = ['avif', 'webp', 'png', 'jpg', 'jpeg']
): string {
  if (!playerName || !teamName) return '';
  
  // Try the first extension (we'll rely on the component's onError to handle missing files)
  // Photos are stored as: players/{team_name}/{player_name}.{ext}
  const fileName = `${playerName}.${extensions[0]}`;
  
  const { data } = supabase.storage
    .from('ui_images')
    .getPublicUrl(`players/${teamName}/${fileName}`);
  
  return data.publicUrl;
}

/**
 * Get all possible player photo URLs to try different extensions
 * Photos are organized by team folders: ui_images/players/{team_name}/{player_name}.{ext}
 * @param playerName - Full player name
 * @param teamName - Full team name
 * @returns Array of possible URLs to try
 */
export function getPlayerPhotoUrls(
  playerName: string,
  teamName: string
): string[] {
  if (!playerName || !teamName) return [];
  
  const extensions = ['avif', 'webp', 'png', 'jpg', 'jpeg'];
  
  return extensions.map(ext => {
    const fileName = `${playerName}.${ext}`;
    const { data } = supabase.storage
      .from('ui_images')
      .getPublicUrl(`players/${teamName}/${fileName}`);
    return data.publicUrl;
  });
}
