import { useState } from 'react';

/**
 * A bandeira de um país, por código ISO.
 *
 * ⚠️ POR QUE NÃO EMOJI. A primeira versão do seletor de país usava 🇧🇷 e
 * companhia, e no Windows apareceu "BR", "PE", "AR" — o sistema não tem fonte
 * de bandeira e desenha as duas letras do indicador regional. Funcionava no
 * Mac de quem escreveu e não na máquina de quem ia usar.
 *
 * Usa a mesma fonte que o bolão já usa para bandeira de seleção, com o mesmo
 * recuo para um retângulo cinza quando a imagem falha. Irmão de `TeamFlag`, e
 * separado dele porque aquele traduz código FIFA e aqui o código já é ISO.
 */
export function BandeiraDoPais({
  codigo,
  nome,
  className = '',
}: {
  /** ISO 3166-1 alfa-2, maiúsculo ou minúsculo. */
  codigo: string;
  /** Para o texto alternativo — quem usa leitor de tela ouve o nome, não "BR". */
  nome: string;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const iso = codigo.toLowerCase();

  if (falhou) {
    return (
      <div
        className={`w-5 h-3.5 rounded-sm bg-zinc-300/40 border border-zinc-400/30 shrink-0 ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${iso}.png`}
      srcSet={`https://flagcdn.com/w40/${iso}.png 1x, https://flagcdn.com/w80/${iso}.png 2x`}
      alt={nome}
      onError={() => setFalhou(true)}
      loading="lazy"
      className={`w-5 h-3.5 rounded-sm border border-zinc-400/30 shrink-0 object-cover ${className}`}
    />
  );
}
