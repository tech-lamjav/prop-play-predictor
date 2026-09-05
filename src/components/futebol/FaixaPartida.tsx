import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { Blur } from '@/components/futebol/FutebolGate';
import { Crest } from '@/components/futebol/Crest';
import { useVitrine } from '@/hooks/use-futebol-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';

import type { FutebolFixturePremissas, FutebolFixtureValueRow, FutebolFormResult } from '@/services/futebol-data.service';
import { melhorLeitura, resumoDosMercados, type SaidaPreferida } from '@/utils/futebol-leitura';
import { rotuloDaFaixa } from '@/utils/futebol-score';
import { outcomeLabel, contaQueValem, PORTA_PREMISSAS } from '@/utils/futebol-premissas';
import { isFinished, isLive } from '@/utils/futebol-datas';
import type { JogoInfo } from './JogoResumo';

/**
 * A faixa da partida: o jogo e a melhor leitura na MESMA faixa forest, colada no
 * cabeçalho (protótipo "Futebol Jogo", direção B).
 *
 * O que mudou de ideia em relação ao que existia: o card branco do confronto e o
 * hero da leitura eram dois blocos concorrendo pela mesma atenção no topo. Aqui o
 * jogo fica à esquerda, a leitura à direita, o Score é a única coisa em âmbar e o
 * botão de registrar mora ao lado dele.
 */

const RES_PT: Record<string, 'V' | 'E' | 'D'> = { W: 'V', D: 'E', L: 'D' };
const COR_RES: Record<'V' | 'E' | 'D', string> = { V: '#2f7d50', E: 'rgba(255,255,255,.16)', D: '#b8341c' };

function Forma({ form, alinhar }: { form: FutebolFormResult[]; alinhar?: 'fim' }) {
  if (!form.length) return null;
  return (
    <div className={`flex gap-[3px] mt-1.5 ${alinhar === 'fim' ? 'justify-end' : ''}`}>
      {form.slice(0, 5).map((g, i) => {
        const r = RES_PT[g.result] ?? 'E';
        return (
          <span
            key={`${g.fixture_id}-${i}`}
            className="w-4 h-4 rounded-[3px] grid place-items-center text-[8.5px] font-bold text-white"
            style={{ background: COR_RES[r], color: r === 'E' ? 'rgba(255,255,255,.75)' : '#fff' }}
            title={`${g.opponent}: ${g.goals_for} a ${g.goals_against}`}
          >
            {r}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Um time do cabeçalho: escudo, nome e forma.
 *
 * Dois arranjos, e a escolha é medida e não estética.
 *
 * No DESKTOP o nome fica ao lado do escudo, que é o que sempre funcionou ali —
 * sobra largura e a linha lê bem.
 *
 * No CELULAR o nome vai PARA BAIXO do escudo, como no Sofascore. O escudo ao
 * lado consumia 44px dos 120px da coluna, e sobravam 77px para o nome: dos 202
 * times das nossas ligas, só 119 cabiam — 41% truncava, e não era caso raro,
 * era a regra. Empilhado o nome recebe os 120px inteiros e 186 cabem numa
 * linha; com a segunda liberada, os 202.
 *
 * Deixar quebrar em duas linhas SEM empilhar não resolvia: nove desses nomes
 * têm uma palavra só, sozinha, mais larga que 77px — "Mönchengladbach" mede
 * 126, "Bournemouth" 94. Palavra não quebra; ela transborda uma linha abaixo.
 */
function TimeDoCabecalho({
  nome,
  teamId,
  form,
  lado,
  empilhado,
}: {
  nome: string;
  teamId?: number | null;
  form: FutebolFormResult[];
  lado: 'casa' | 'fora';
  empilhado: boolean;
}) {
  // Empilhado o escudo cresce de 36 para 44px, e a razão é a linha e não ele.
  // Com o nome embaixo, a linha de cima fica só com dois escudos e o horário em
  // 303px de largura — muito ar, contra uma linha de baixo em que os nomes
  // ocupam os 121px de cada coluna. O escudo maior fecha o vão sem mexer no
  // espaçamento, que já está simétrico ao pixel.
  const escudo = (
    <span
      className={`rounded-full bg-white/10 grid place-items-center shrink-0 ${
        empilhado ? 'w-11 h-11' : 'w-9 h-9 md:w-[42px] md:h-[42px]'
      }`}
    >
      <Crest name={nome} id={teamId} size={empilhado ? 32 : 26} />
    </span>
  );

  if (empilhado) {
    return (
      // `h-full` + `flex-1` no nome empurram a forma para a base dos dois lados.
      // Sem isso, um confronto de nome curto contra nome de duas linhas deixava
      // um chip mais alto que o outro. Alinhar assim não custa altura: a linha
      // já tem a altura do lado mais alto de qualquer jeito.
      <div className="flex flex-col items-center min-w-0 h-full">
        {escudo}
        <div className="mt-1.5 w-full flex-1">
          {/* `break-words` importa: sem ele um nome de palavra única mais larga
              que a coluna estoura para fora em vez de cortar. É o caso de
              "Mönchengladbach", que sozinha mede 126px numa coluna de 122. */}
          <div className="text-[15px] font-semibold leading-tight text-white text-center line-clamp-2 break-words">
            {nome}
          </div>
        </div>
        <Forma form={form} />
      </div>
    );
  }

  const texto = (
    <div className="min-w-0">
      <div className={`text-[15px] md:text-[18px] font-semibold leading-tight text-white truncate${lado === 'fora' ? ' text-right' : ''}`}>
        {nome}
      </div>
      <Forma form={form} alinhar={lado === 'fora' ? 'fim' : undefined} />
    </div>
  );

  return (
    <div className={`flex items-center gap-2 md:gap-2.5 min-w-0${lado === 'fora' ? ' justify-end' : ''}`}>
      {lado === 'fora' ? <>{texto}{escudo}</> : <>{escudo}{texto}</>}
    </div>
  );
}

export function FaixaPartida({
  jogo,
  premissas,
  valueRows,
  leituraCarregando,
  locked,
  rodada,
  estadio,
  data,
  hora,
  formHome,
  formAway,
  homeTeamId,
  awayTeamId,
  onAbrirMercado,
  preferida,
  ocultos,
}: {
  jogo: JogoInfo;
  /** As premissas do jogo. Vêm da página: ela já faz essa query e é a dona do estado. */
  premissas: FutebolFixturePremissas[] | null | undefined;
  valueRows: FutebolFixtureValueRow[] | null | undefined;
  /**
   * Alguma das duas fontes da leitura ainda está em voo.
   *
   * "Sem leitura ainda" é uma conclusão: só cabe quando as duas chegaram e
   * nenhuma sustenta uma linha. Enquanto carregam, a faixa mostra o esqueleto,
   * senão a tela afirma um vazio que ela ainda não sabe se é verdade.
   */
  leituraCarregando: boolean;
  locked: boolean;
  rodada: string;
  estadio: string | null;
  /** "sáb 18:30" já formatado pela página. */
  /**
   * Data e hora VIAJAM SEPARADAS porque moram em lugares diferentes.
   *
   * A data desceu para a linha de rodada/estádio e só a hora ficou no meio, e
   * o motivo está medido: num iPhone de 390px a grade do cabeçalho tem 303px, e
   * a coluna do meio comia 103 deles. Sobravam 48px para o nome do time, e
   * "Palmeiras" precisa de 71 — todo nome truncava.
   *
   * Receber a string pronta "10/08, 18:30" e cortá-la aqui seria fingir que o
   * formato é estável: basta o dia virar "10/08/26" para o corte pegar errado.
   */
  data: string;
  hora: string;
  formHome: FutebolFormResult[];
  formAway: FutebolFormResult[];
  homeTeamId: number;
  awayTeamId: number;
  onAbrirMercado: (slug: string) => void;
  /** A saída que o usuário clicou em Oportunidades, quando ele veio de lá. */
  preferida?: SaidaPreferida | null;
  /**
   * Os mercados fora da vitrine (#324). Vem por PROP e não por hook: este é um
   * componente de apresentação, sem consulta própria, e um hook aqui passaria a
   * exigir QueryClient de quem só queria desenhar a faixa — foi o que quebrou os
   * três testes dele na primeira tentativa.
   */
  ocultos: readonly string[];
}) {
  const resumos = useMemo(() => resumoDosMercados(premissas, valueRows, preferida, ocultos), [premissas, valueRows, preferida, ocultos]);
  const top = useMemo(() => melhorLeitura(resumos), [resumos]);
  const fim = isFinished(jogo.statusShort);
  // A faixa conhecia dois estados, encerrado e "não começou", então o jogo EM
  // ANDAMENTO caía no segundo e a tela dizia "Não começou" com a bola rolando.
  // Passou a importar mais com a migration 101: a partir dela, o valor exibido
  // durante o jogo é a FOTO DO APITO, e sem dizer que já começou o leitor lê um
  // preço congelado como se ainda desse para pegar.
  const rolando = isLive(jogo.statusShort);

  const pick = top
    ? outcomeLabel(top.candidato, jogo.home, jogo.away)
    : null;
  const v = top?.value ?? null;
  const nValem = top ? contaQueValem(top.candidato) : 0;

  // No celular a data e o estado sobem para a linha da rodada, e o miolo fica
  // só com a hora. É de lá que sai a largura: "Não começou" mede 95px sozinho,
  // mais que a data e a hora juntas (92px), e cada pixel devolvido aqui vira
  // nome de time legível.
  //
  // No desktop nada disso é preciso, então o arranjo antigo continua — data,
  // hora e estado no meio, como sempre esteve.
  const empilhado = useIsMobile();

  const estado = rolando ? (
    <span className="inline-flex items-center gap-1.5 text-white/75">
      <span className="w-1.5 h-1.5 rounded-full bg-status-danger" aria-hidden />
      Em andamento
    </span>
  ) : (
    <span className="whitespace-nowrap">{fim ? 'Encerrado' : 'Não começou'}</span>
  );

  // O botão é o MESMO nos dois arranjos; o que muda é onde ele entra. Declarar
  // duas vezes no JSX abriria caminho para as duas cópias divergirem, que é
  // como um rascunho de aposta passa a mandar dado diferente conforme a tela.
  const podeRegistrar = Boolean(v && !fim && !locked && top);
  const botaoRegistrar = v ? (
    <RegistrarApostaCTA
      draft={{
        homeName: jogo.home,
        awayName: jogo.away,
        competition: jogo.competition,
        kickoffUtc: jogo.kickoffUtc,
        market: v.market,
        outcome: v.outcome,
        lineValue: v.line_value,
        bestOdd: v.best_odd,
        oddKind: 'melhor',
      }}
      variant="ambar"
      larguraTotal={empilhado}
    />
  ) : null;

  const centro = (
    // `h-9` no empilhado é a altura do escudo: com a grade alinhada pelo topo,
    // a hora fica na altura dos escudos e não na dos nomes — é assim no
    // Sofascore, e é o que faz o cabeçalho parecer uma linha só.
    <div className={`text-center shrink-0 ${empilhado ? 'h-11 self-start grid place-items-center' : 'px-1'}`}>
      {fim || rolando ? (
        <div className="tabular-nums text-[22px] md:text-[26px] font-bold leading-none text-white">
          {jogo.goalsHome ?? '-'} <span className="text-white/40">:</span> {jogo.goalsAway ?? '-'}
        </div>
      ) : (
        <div className={`tabular-nums font-bold leading-none text-white whitespace-nowrap ${
          empilhado ? 'text-[17px]' : 'text-[15px] md:text-[17px]'
        }`}>
          {empilhado ? hora : `${data}, ${hora}`}
        </div>
      )}
      {!empilhado && (
        <div className="mt-1.5 text-[9px] md:text-[9.5px] uppercase tracking-[0.1em] text-white/45">
          {estado}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-rebrand-xl" style={{ background: 'linear-gradient(135deg,#0a3d2e,#08321f 55%,#051f12)' }}>
      <div
        className="absolute pointer-events-none"
        style={{ right: 180, top: -140, width: 420, height: 420, borderRadius: 999, background: 'radial-gradient(circle,rgba(251,191,36,.22),transparent 68%)' }}
      />
      <div className="relative grid xl:grid-cols-[1fr_1px_470px] gap-6 xl:gap-8 items-center p-5 md:p-6">
        <div className="min-w-0">
          {/* Rodada · [data · estado] · estádio. Os dois do meio só existem no
              celular; no desktop eles moram no miolo da grade. O estádio vai
              por último de propósito: é o único que trunca, e truncar o menos
              importante é melhor do que truncar a data. */}
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 flex items-center gap-1.5 flex-wrap">
            <span>{rodada}</span>
            {empilhado && (
              <>
                <span>·</span>
                <span className="whitespace-nowrap">{data}</span>
                <span>·</span>
                {estado}
              </>
            )}
            {estadio && (
              // Pino e nome num item só, e não soltos no `flex-wrap`. Soltos,
              // cada um quebrava por conta própria: o pino terminava a primeira
              // linha e o estádio começava a segunda, órfão do próprio ícone.
              //
              // `basis-full` no celular manda o par para uma linha inteira sua.
              // Lá o "·" some junto: quem já está em outra linha não precisa de
              // separador para se distinguir do que veio antes.
              <span className={`inline-flex items-center gap-1.5 min-w-0 ${empilhado ? 'basis-full' : ''}`}>
                {!empilhado && <span>·</span>}
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{estadio}</span>
              </span>
            )}
          </div>

          {/* Mandante · placar · visitante numa grade de três colunas. Em `flex-wrap`
              o visitante caía para a linha de baixo e o placar ficava colado no
              mandante, parecendo o placar dele. */}
          <div className={`grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 mt-3 ${empilhado ? 'items-stretch' : 'items-center'}`}>
            <TimeDoCabecalho nome={jogo.home} teamId={homeTeamId} form={formHome} lado="casa" empilhado={empilhado} />
            {centro}
            <TimeDoCabecalho nome={jogo.away} teamId={awayTeamId} form={formAway} lado="fora" empilhado={empilhado} />
          </div>
        </div>

        <div className="hidden xl:block h-[76px] w-px bg-white/15" />

        {/* A melhor leitura, na mesma faixa. Sem preço coletado, o número grande é
            quantas premissas sustentam, que é o que existe para afirmar. */}
        {/* A área clicável é o TEXTO da leitura, não a faixa inteira.

            Era um <button> só, envolvendo tudo, com o botão de registrar dentro:
            HTML não permite botão dentro de botão, e o navegador não recusa, ele
            reescreve a árvore sozinho na hora de ler a página, tirando o de dentro
            de dentro do de fora. Ou seja, o que ia para a tela não era o que estava
            escrito aqui, e cada navegador reescrevia do seu jeito. Para leitor de
            tela e teclado, dois controles um dentro do outro não têm resposta: não
            dá para dizer qual deles está em foco.

            Funcionava por acaso, porque o CTA chama stopPropagation. O Score ficou
            fora da área clicável de propósito: ele é leitura, não controle, e é o
            vizinho do botão de registrar. */}
        {leituraCarregando ? (
          // O esqueleto ocupa a mesma caixa da leitura pronta, para a faixa não
          // saltar de altura quando o dado chega. Tons de branco, não o Skeleton
          // padrão: aqui o fundo é o forest, e o cinza dele sumiria.
          <div data-testid="faixa-leitura-carregando" className="flex items-center gap-5 min-w-0" aria-busy="true">
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] uppercase text-white/45 truncate ${empilhado ? 'tracking-[0.12em]' : 'tracking-[0.16em]'}`}>Melhor leitura do jogo</div>
              <div className="mt-2 h-[26px] w-[68%] rounded bg-white/15 animate-pulse" />
              <div className="mt-3 h-[16px] w-[45%] rounded bg-white/10 animate-pulse" />
            </div>
            <div className="text-center shrink-0">
              <div className="h-[44px] w-[62px] rounded bg-white/15 animate-pulse" />
              <div className="mt-2 h-[10px] w-[62px] rounded bg-white/10 animate-pulse" />
            </div>
          </div>
        ) : (
        // No celular isto é uma COLUNA: em cima o título com o Score ao lado,
        // embaixo o botão de registrar, sozinho na largura toda.
        //
        // Antes o botão dividia a linha com o título, e o `shrink-0` dele fazia
        // o lado esquerdo cair para ~151px dos 303 disponíveis — o rótulo
        // quebrava em duas linhas e o nome da aposta ficava espremido contra um
        // alvo de toque estreito.
        <div className={empilhado ? 'flex flex-col gap-3 min-w-0' : 'min-w-0'}>
          <div className={`flex items-center min-w-0 ${empilhado ? 'gap-3' : 'gap-5'}`}>
          <button
            type="button"
            onClick={() => top && onAbrirMercado(top.mercado.slug)}
            className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08321f]"
          >
            <div className={`text-[10px] uppercase text-white/45 truncate ${empilhado ? 'tracking-[0.12em]' : 'tracking-[0.16em]'}`}>Melhor leitura do jogo</div>
            {/* Sem truncate: "Mais de 1,75 g…" escondia justamente a linha da
                leitura. Aqui ela quebra em duas linhas. */}
            <div className="mt-1.5 text-[19px] md:text-[24px] font-semibold leading-tight tracking-[-0.025em] text-white">
              {pick ?? 'Sem leitura ainda'}
            </div>
            {v ? (
              <div className="flex gap-5 mt-2.5">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-white/45">Chance</div>
                  <div className="tabular-nums text-[16px] font-semibold text-white mt-0.5">
                    <Blur active={locked}>{Math.round(v.prob_justa_fechamento * 100)}%</Blur>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-white/45">Odd</div>
                  <div className="tabular-nums text-[16px] font-semibold text-white mt-0.5">
                    <Blur active={locked}>{v.best_odd.toFixed(2)}</Blur>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-white/45">Valor</div>
                  <div
                    className="tabular-nums text-[16px] font-semibold mt-0.5"
                    style={{ color: v.edge > 0 ? '#8ee6b0' : 'rgba(255,255,255,.55)' }}
                  >
                    <Blur active={locked}>{`${v.edge >= 0 ? '+' : '−'}${Math.abs(v.edge * 100).toFixed(1).replace('.', ',')}%`}</Blur>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-white/55 mt-2.5 leading-relaxed">
                {top ? `${nValem} de ${top.totalQueValem} premissas a favor` : 'Sem premissas suficientes'} · as odds entram
                perto do jogo
              </div>
            )}
          </button>

          <div className="text-center shrink-0">
            <div className="tabular-nums font-bold leading-none tracking-[-0.04em] text-[44px]" style={{ color: '#fbbf24' }}>
              {v ? <Blur active={locked}>{String(v.score)}</Blur> : nValem}
            </div>
            <div className="mt-1.5 text-[9.5px] uppercase tracking-[0.12em] text-white/50">
              {v ? `Score · ${rotuloDaFaixa(v.faixa)}` : 'premissas a favor'}
            </div>
            {podeRegistrar && !empilhado && (
              <div className="mt-2.5 flex justify-center">{botaoRegistrar}</div>
            )}
            {!v && top && nValem >= PORTA_PREMISSAS && !fim && (
              <div className="mt-2 text-[10px] text-white/45 max-w-[130px] mx-auto leading-snug">sem preço coletado</div>
            )}
          </div>
          </div>
          {podeRegistrar && empilhado && botaoRegistrar}
        </div>
        )}
      </div>
    </div>
  );
}
