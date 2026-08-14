import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { getFutebolLeagueLogoUrl } from '@/utils/futebol-logos';

/**
 * Brasão do campeonato, com o troféu como plano B.
 *
 * Mesma lógica do Crest dos times: a imagem vem do nosso Storage, nunca da
 * api-sports direto (o navegador leva bloqueio de hotlink lá). Quem popula o
 * bucket é a edge function mirror-futebol-league-logos, que também é onde entra
 * liga nova. Sem arquivo, o <img> 404 e a tela mostra o troféu.
 *
 * Copa do Mundo cai sempre no troféu: a api-sports não tem brasão dela, devolve
 * um escudo cinza de "sem imagem", então ela ficou fora do espelho de propósito.
 */
export function LigaCrest({ slug, size = 20 }: { slug: string; size?: number }) {
  const [falhou, setFalhou] = useState(false);
  const url = getFutebolLeagueLogoUrl(slug);

  if (!url || falhou) return <Trophy className="text-ink-2" style={{ width: size, height: size }} />;

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFalhou(true)}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
