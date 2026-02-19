import { supabase } from '@/integrations/supabase/client';

function normalizeAssetBaseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

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
 * Supports both:
 * - New flat format: ui_images/players/{normalized_player_name}.{ext}
 * - Legacy team format: ui_images/players/{team_name}/{player_name}.{ext}
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
  if (!playerName || !teamName || extensions.length === 0) return '';

  // Return the first candidate. Consumers should call tryNextPlayerPhotoUrl on onError.
  const urls = getPlayerPhotoUrls(playerName, teamName, extensions);
  return urls[0] || '';
}

/**
 * Get all possible player photo URLs to try different extensions
 * Supports both:
 * - New flat format: ui_images/players/{normalized_player_name}.{ext}
 * - Legacy team format: ui_images/players/{team_name}/{player_name}.{ext}
 * @param playerName - Full player name
 * @param teamName - Full team name
 * @returns Array of possible URLs to try
 */
export function getPlayerPhotoUrls(
  playerName: string,
  teamName: string,
  extensions: string[] = ['avif', 'webp', 'png', 'jpg', 'jpeg']
): string[] {
  if (!playerName) return [];

  const normalizedName = normalizeAssetBaseName(playerName);
  const baseNames = Array.from(new Set([normalizedName, playerName].filter(Boolean)));
  const extList = Array.from(new Set(extensions.map((ext) => ext.toLowerCase())));
  const urls: string[] = [];

  // New preferred format: flat players folder.
  for (const baseName of baseNames) {
    for (const ext of extList) {
      const fileName = `${baseName}.${ext}`;
      const { data } = supabase.storage
        .from('ui_images')
        .getPublicUrl(`players/${fileName}`);
      urls.push(data.publicUrl);
    }
  }

  // Legacy fallback format with team folder.
  if (teamName) {
    for (const baseName of baseNames) {
      for (const ext of extList) {
        const fileName = `${baseName}.${ext}`;
        const { data } = supabase.storage
          .from('ui_images')
          .getPublicUrl(`players/${teamName}/${fileName}`);
        urls.push(data.publicUrl);
      }
    }
  }

  return Array.from(new Set(urls));
}

/**
 * Try next available player photo URL when current src fails.
 * Usage: call inside <img onError>, and fallback to initials only when this returns false.
 */
export function tryNextPlayerPhotoUrl(
  target: HTMLImageElement,
  playerName: string,
  teamName: string,
  extensions: string[] = ['avif', 'webp', 'png', 'jpg', 'jpeg']
): boolean {
  const urls = getPlayerPhotoUrls(playerName, teamName, extensions);
  if (urls.length === 0) return false;

  const currentIndex = Number(target.dataset.playerPhotoIndex ?? '0');
  const nextIndex = currentIndex + 1;

  if (nextIndex >= urls.length) {
    return false;
  }

  target.dataset.playerPhotoIndex = String(nextIndex);
  target.src = urls[nextIndex];
  return true;
}
