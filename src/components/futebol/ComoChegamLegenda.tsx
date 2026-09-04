/**
 * A legenda do bloco "Como chegam".
 *
 * O bloco mede a MESMA JANELA das premissas — os últimos 10 jogos em qualquer
 * competição —, e a legenda existe para dizer o recorte de mando, que muda de
 * linha para linha porque muda no modelo: gols marcados e sofridos somam o
 * mandante em casa com o visitante fora (`gf_comb`/`ga_comb`), e o percentual
 * de jogos sem sofrer gol olha a janela inteira (`clean_sheets_altos`).
 *
 * ⚠️ NÃO devolver este bloco ao perfil de temporada. Ele veio de lá até 04/09, e
 * o efeito era a tela se desmentir em aritmética simples: em Criciúma × Cuiabá,
 * a premissa anunciava "2,4 gols marcados por jogo, somados" e o bloco logo
 * abaixo mostrava 1,0 e 0,9. Os dois números estavam certos — mediam coisas
 * diferentes —, mas quem lê soma, chega a 1,9, e conclui que um dos dois mente.
 * Explicar a diferença numa legenda não devolve a credibilidade que a
 * contradição tira; foi por isso que o bloco mudou de fonte em vez de ganhar
 * uma nota de rodapé.
 *
 * A POSIÇÃO na tabela é a exceção que continua vindo da temporada, e continua
 * certa aí: classificação é da competição e da temporada por definição (ADR
 * 0008), não de uma janela de dez jogos que atravessa campeonatos. Onde não há
 * tabela — mata-mata — ela simplesmente não aparece.
 *
 * Vive num componente só porque duas telas desenham o bloco (o painel da agenda
 * e a bancada do detalhe) e a explicação não pode divergir entre elas.
 */
export function ComoChegamLegenda({ className = '', cor = '#8d8672' }: { className?: string; cor?: string }) {
  return (
    <p className={`text-[10.5px] leading-snug ${className}`} style={{ color: cor }}>
      Últimos 10 jogos, a mesma janela das premissas. Nos gols, o mandante em casa e o visitante fora.
    </p>
  );
}
