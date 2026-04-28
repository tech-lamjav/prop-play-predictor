import React, { useState } from 'react';

/**
 * Mapeia códigos FIFA (3 letras, ex: BRA, ARG) para ISO 3166-1 alpha-2
 * (2 letras, lowercase, ex: br, ar) — formato esperado pelo flagcdn.com.
 *
 * Cobre os 48 países da Copa do Mundo 2026 + alguns outros comuns.
 */
const FIFA_TO_ISO: Record<string, string> = {
  // Anfitriões
  USA: 'us', CAN: 'ca', MEX: 'mx',
  // CONMEBOL
  ARG: 'ar', BRA: 'br', URU: 'uy', PAR: 'py', PER: 'pe', COL: 'co', CHI: 'cl', ECU: 'ec', BOL: 'bo', VEN: 've',
  // UEFA
  FRA: 'fr', GER: 'de', ENG: 'gb-eng', ESP: 'es', POR: 'pt', NED: 'nl', BEL: 'be', ITA: 'it', CRO: 'hr',
  POL: 'pl', SUI: 'ch', DEN: 'dk', SWE: 'se', NOR: 'no', AUT: 'at', UKR: 'ua', SRB: 'rs', CZE: 'cz',
  TUR: 'tr', SCO: 'gb-sct', WAL: 'gb-wls', NIR: 'gb-nir', IRL: 'ie', HUN: 'hu', ROU: 'ro', GRE: 'gr',
  RUS: 'ru', SVK: 'sk', SVN: 'si', BIH: 'ba', BUL: 'bg', BLR: 'by', ALB: 'al', MNE: 'me',
  MKD: 'mk', LUX: 'lu', ISL: 'is', FIN: 'fi', LVA: 'lv', LTU: 'lt', EST: 'ee', MDA: 'md',
  KOS: 'xk', ARM: 'am', AZE: 'az', GEO: 'ge', KAZ: 'kz',
  // CONCACAF
  CRC: 'cr', PAN: 'pa', HON: 'hn', JAM: 'jm', SLV: 'sv', GUA: 'gt', HAI: 'ht', TRI: 'tt',
  CUW: 'cw', SUR: 'sr', GUY: 'gy', BAR: 'bb', GRN: 'gd', NCA: 'ni',
  // CAF (África)
  MAR: 'ma', SEN: 'sn', TUN: 'tn', ALG: 'dz', EGY: 'eg', NGA: 'ng', GHA: 'gh', CMR: 'cm', CIV: 'ci',
  RSA: 'za', MLI: 'ml', BFA: 'bf', BEN: 'bj', GAB: 'ga', CPV: 'cv', COD: 'cd', ANG: 'ao', UGA: 'ug',
  KEN: 'ke', ZAM: 'zm', ZIM: 'zw', ETH: 'et', SUD: 'sd', MOZ: 'mz', LBY: 'ly', MAD: 'mg', TOG: 'tg',
  // AFC (Ásia)
  JPN: 'jp', KOR: 'kr', AUS: 'au', IRN: 'ir', KSA: 'sa', QAT: 'qa', UAE: 'ae', UZB: 'uz', IRQ: 'iq',
  SYR: 'sy', JOR: 'jo', LIB: 'lb', PRK: 'kp', CHN: 'cn', THA: 'th', VIE: 'vn', PHI: 'ph', MAS: 'my',
  // OFC (Oceania)
  NZL: 'nz', SOL: 'sb',
};

interface TeamFlagProps {
  code: string;
  /** Tamanho preset — default w-5 h-3.5 (~20×14) */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-5 h-3.5',
  md: 'w-7 h-5',
  lg: 'w-10 h-7',
};

/**
 * Bandeira de seleção. Usa flagcdn.com (CDN público, free) com fallback
 * pra placeholder cinza se o código FIFA não mapeia ou se a imagem falha.
 */
export function TeamFlag({ code, size = 'sm', className = '' }: TeamFlagProps) {
  const [errored, setErrored] = useState(false);
  const isoCode = FIFA_TO_ISO[code?.toUpperCase()];
  const sizeClass = SIZE_CLASSES[size];

  if (!isoCode || errored) {
    return (
      <div
        className={`${sizeClass} rounded-sm bg-terminal-border-subtle/40 border border-terminal-border-subtle/60 shrink-0 ${className}`}
        title={code}
        aria-label={`Bandeira de ${code} (não disponível)`}
      />
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${isoCode}.png`}
      srcSet={`https://flagcdn.com/w40/${isoCode}.png 1x, https://flagcdn.com/w80/${isoCode}.png 2x`}
      alt={`Bandeira de ${code}`}
      title={code}
      onError={() => setErrored(true)}
      loading="lazy"
      className={`${sizeClass} rounded-sm border border-terminal-border-subtle/40 shrink-0 object-cover ${className}`}
    />
  );
}
