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
  if (!status) {
    // Default to UNK (available) - green
    return {
      textClass: 'text-terminal-green',
      borderClass: 'border-terminal-green/30',
      bgClass: 'bg-terminal-green/10',
    };
  }

  const statusLower = status.toLowerCase();

  // Active / Available / UNK -> Green
  if (
    statusLower === 'active' ||
    statusLower === 'available' ||
    statusLower.includes('unk') ||
    statusLower === 'probable'
  ) {
    return {
      textClass: 'text-terminal-green',
      borderClass: 'border-terminal-green/30',
      bgClass: 'bg-terminal-green/10',
    };
  }

  // Questionable / Doubtful -> Yellow
  if (
    statusLower.includes('questionable') ||
    statusLower.includes('doubtful')
  ) {
    return {
      textClass: 'text-terminal-yellow',
      borderClass: 'border-terminal-yellow/30',
      bgClass: 'bg-terminal-yellow/10',
    };
  }

  // Out / Inactive -> Red
  if (
    statusLower === 'out' ||
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
 * Get short status label (first 3 characters)
 */
export function getInjuryStatusLabel(status: string | null | undefined): string {
  if (!status) return 'UNK';
  
  const statusUpper = status.toUpperCase();
  if (statusUpper.includes('QUESTIONABLE')) return 'Q';
  if (statusUpper.includes('DOUBTFUL')) return 'D';
  if (statusUpper.includes('PROBABLE')) return 'P';
  if (statusUpper.includes('ACTIVE') || statusUpper.includes('AVAILABLE')) return 'ACT';
  if (statusUpper.includes('OUT') || statusUpper.includes('INACTIVE')) return 'OUT';
  
  return statusUpper.substring(0, 3);
}
