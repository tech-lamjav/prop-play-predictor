/**
 * Get CSS classes for injury status display
 * @param status - Injury status string (e.g., "Active", "Questionable", "Out", "UNK", etc.)
 * @returns Object with text, border, and background color classes
 */
export function getInjuryStatusStyle(status: string | null | undefined): {
  textClass: string;
  borderClass: string;
  bgClass: string;
} {
  const raw = (status ?? '').trim();
  if (!raw) {
    // Default to UNK (available) - green
    return {
      textClass: 'text-terminal-green',
      borderClass: 'border-terminal-green/30',
      bgClass: 'bg-terminal-green/10',
    };
  }

  const statusLower = raw.toLowerCase();

  // Active / Available / UNK -> Green
  if (
    statusLower === 'active' ||
    statusLower === 'available' ||
    statusLower.includes('unk')
  ) {
    return {
      textClass: 'text-terminal-green',
      borderClass: 'border-terminal-green/30',
      bgClass: 'bg-terminal-green/10',
    };
  }

  // Probable -> intermediate green/yellow
  if (statusLower.includes('probable')) {
    return {
      textClass: 'text-lime-400',
      borderClass: 'border-lime-400/30',
      bgClass: 'bg-lime-400/10',
    };
  }

  // Questionable -> Yellow
  if (statusLower.includes('questionable')) {
    return {
      textClass: 'text-yellow-400',
      borderClass: 'border-yellow-400/30',
      bgClass: 'bg-yellow-400/10',
    };
  }

  // Doubtful -> Orange (between questionable and out)
  if (statusLower.includes('doubtful')) {
    return {
      textClass: 'text-orange-400',
      borderClass: 'border-orange-400/30',
      bgClass: 'bg-orange-400/10',
    };
  }

  // Out / Inactive -> Red (catch all variants so "Out" is always red)
  if (
    statusLower === 'out' ||
    statusLower.includes('out') ||
    statusLower === 'inactive' ||
    statusLower.includes('injured')
  ) {
    return {
      textClass: 'text-terminal-red',
      borderClass: 'border-terminal-red/30',
      bgClass: 'bg-terminal-red/10',
    };
  }

  // Default to green (available)
  return {
    textClass: 'text-terminal-green',
    borderClass: 'border-terminal-green/30',
    bgClass: 'bg-terminal-green/10',
  };
}

/**
 * Get full status label for better readability.
 */
export function getInjuryStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Available';
  
  const statusUpper = status.toUpperCase();
  const statusLower = status.toLowerCase();
  if (statusLower.includes('unk') || statusLower === 'unknown') return 'Available';
  if (statusUpper.includes('QUESTIONABLE')) return 'Questionable';
  if (statusUpper.includes('DOUBTFUL')) return 'Doubtful';
  if (statusUpper.includes('PROBABLE')) return 'Probable';
  if (statusUpper.includes('ACTIVE') || statusUpper.includes('AVAILABLE')) return 'Available';
  if (statusUpper.includes('OUT') || statusUpper.includes('INACTIVE')) return 'Out';
  
  return status;
}
