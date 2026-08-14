import { useState } from 'react';
import { getFutebolTeamLogoUrl, crestInitials } from '@/utils/futebol-logos';

/**
 * Escudo do time, com fallback pra sigla quando não há mirror do logo.
 *
 * Estava copiado em 6 telas do futebol. Aqui é a versão única pras telas que a
 * agenda toca; as outras seguem com a cópia local até alguém passar por elas
 * (troca mecânica, mas fora do escopo desta mudança).
 */
export function Crest({ name, id, size = 24 }: { name: string; id: number; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(id);
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={name}
        onError={() => setErr(true)}
        style={{ width: size, height: size }}
        className="object-contain shrink-0"
        loading="lazy"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[8px] font-bold text-ink-2 shrink-0"
    >
      {crestInitials(name)}
    </div>
  );
}
