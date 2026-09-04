/**
 * A legenda do bloco "Como chegam".
 *
 * Ela existe porque a tela mostra, uma embaixo da outra, DUAS MEDIDAS
 * DIFERENTES do mesmo confronto — e sem dizer isso parece erro de aritmética.
 *
 * Caso real, Criciúma × Cuiabá de 04/09: a premissa anuncia "2,4 gols marcados
 * por jogo, somados" e este bloco mostra 1,0 e 0,9. Quem soma chega a 1,9,
 * conclui que um dos dois mente, e perde a confiança nos dois.
 *
 * Nenhum dos dois mente:
 *
 * - a PREMISSA mede a janela dela — os últimos 10 jogos em qualquer competição,
 *   mandante em casa e visitante fora —, que é o que o modelo compara
 *   (`int_futebol_premissas_ou`, vars `todas` + `ultimos_10`; migration 117);
 * - este BLOCO é o perfil de temporada no campeonato, média total, sem recorte
 *   de mando, e é assim de propósito: classificação, forma e artilharia vivem
 *   nessa mesma escala (ADR 0008).
 *
 * ⚠️ NÃO "corrigir" o bloco para a janela da premissa. Já foi tentado o inverso
 * — alinhar o gráfico ao perfil de temporada — e o resultado foi a spec #349
 * inteira: nenhum número da tela era o número que acendia a premissa. As duas
 * medidas convivem; o que faltava era a tela dizer qual é qual.
 *
 * Vive num componente só porque três telas desenham o bloco (o painel da
 * agenda, a bancada do detalhe e o resumo do jogo) e a explicação não pode
 * divergir entre elas.
 */
export function ComoChegamLegenda({ className = '', cor = '#8d8672' }: { className?: string; cor?: string }) {
  return (
    <p className={`text-[10.5px] leading-snug ${className}`} style={{ color: cor }}>
      Média da temporada no campeonato. As premissas medem outra janela: os últimos 10 jogos,
      mandante em casa e visitante fora.
    </p>
  );
}
