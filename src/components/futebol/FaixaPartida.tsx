import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { Blur } from '@/components/futebol/FutebolGate';
import { Crest } from '@/components/futebol/Crest';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';
import { useFutebolFixturePremissas } from '@/hooks/use-futebol-data';
import type { FutebolFixtureValueRow, FutebolFormResult } from '@/services/futebol-data.service';
import { melhorLeitura, resumoDosMercados, REGUA_SCORE, type SaidaPreferida } from '@/utils/futebol-leitura';
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

export function FaixaPartida({
  jogo,
  valueRows,
  locked,
  rodada,
  estadio,
  quando,
  formHome,
  formAway,
  homeTeamId,
  awayTeamId,
  onAbrirMercado,
  preferida,
}: {
  jogo: JogoInfo;
  valueRows: FutebolFixtureValueRow[] | null | undefined;
  locked: boolean;
  rodada: string;
  estadio: string | null;
  /** "sáb 18:30" já formatado pela página. */
  quando: string;
  formHome: FutebolFormResult[];
  formAway: FutebolFormResult[];
  homeTeamId: number;
  awayTeamId: number;
  onAbrirMercado: (slug: string) => void;
  /** A saída que o usuário clicou em Oportunidades, quando ele veio de lá. */
  preferida?: SaidaPreferida | null;
}) {
  const { data: rows } = useFutebolFixturePremissas(jogo.fixtureId);
  const resumos = useMemo(() => resumoDosMercados(rows, valueRows, preferida), [rows, valueRows, preferida]);
  const top = useMemo(() => melhorLeitura(resumos), [resumos]);
  const fim = isFinished(jogo.statusShort);
  // A faixa conhecia dois estados, encerrado e "não começou", então o jogo EM
  // ANDAMENTO caía no segundo e a tela dizia "Não começou" com a bola rolando.
  // Passou a importar mais com a migration 101: a partir dela, o valor exibido
  // durante o jogo é a FOTO DO APITO, e sem dizer que já começou o leitor lê um
  // preço congelado como se ainda desse para pegar.
  const rolando = isLive(jogo.statusShort);

  const pick = top
    ? outcomeLabel(top.mercado.slug, top.candidato.outcome, jogo.home, jogo.away, top.candidato.line_value)
    : null;
  const v = top?.value ?? null;
  const nValem = top ? contaQueValem(top.mercado.slug, top.candidato.acesas) : 0;

  const dia = (
    <div className="text-center px-1 shrink-0">
      {fim || rolando ? (
        <div className="tabular-nums text-[22px] md:text-[26px] font-bold leading-none text-white">
          {jogo.goalsHome ?? '-'} <span className="text-white/40">:</span> {jogo.goalsAway ?? '-'}
        </div>
      ) : (
        <div className="tabular-nums text-[15px] md:text-[17px] font-bold leading-none text-white whitespace-nowrap">{quando}</div>
      )}
      {rolando ? (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[9px] md:text-[9.5px] uppercase tracking-[0.1em] text-white/75">
          <span className="w-1.5 h-1.5 rounded-full bg-status-danger" aria-hidden />
          Em andamento
        </div>
      ) : (
        <div className="mt-1.5 text-[9px] md:text-[9.5px] uppercase tracking-[0.1em] text-white/45">
          {fim ? 'Encerrado' : 'Não começou'}
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
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 flex items-center gap-1.5 flex-wrap">
            <span>{rodada}</span>
            {estadio && (
              <>
                <span>·</span>
                <MapPin className="w-3 h-3" />
                <span className="truncate">{estadio}</span>
              </>
            )}
          </div>

          {/* Mandante · placar · visitante numa grade de três colunas. Em `flex-wrap`
              o visitante caía para a linha de baixo e o placar ficava colado no
              mandante, parecendo o placar dele. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4 mt-3">
            <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
              <span className="w-9 h-9 md:w-[42px] md:h-[42px] rounded-full bg-white/10 grid place-items-center shrink-0">
                <Crest name={jogo.home} id={homeTeamId} size={26} />
              </span>
              <div className="min-w-0">
                <div className="text-[15px] md:text-[18px] font-semibold leading-tight text-white truncate">{jogo.home}</div>
                <Forma form={formHome} />
              </div>
            </div>
            {dia}
            <div className="flex items-center gap-2 md:gap-2.5 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <div className="text-[15px] md:text-[18px] font-semibold leading-tight text-white truncate">{jogo.away}</div>
                <Forma form={formAway} alinhar="fim" />
              </div>
              <span className="w-9 h-9 md:w-[42px] md:h-[42px] rounded-full bg-white/10 grid place-items-center shrink-0">
                <Crest name={jogo.away} id={awayTeamId} size={26} />
              </span>
            </div>
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
        <div className="flex items-center gap-5 min-w-0">
          <button
            type="button"
            onClick={() => top && onAbrirMercado(top.mercado.slug)}
            className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08321f]"
          >
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Melhor leitura do jogo</div>
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
                  <div className="text-[9px] uppercase tracking-[0.14em] text-white/45">Vantagem</div>
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
              {v ? `Score · ${v.score >= 60 ? 'faixa alta' : v.score >= REGUA_SCORE ? 'faixa média' : 'abaixo da régua'}` : 'premissas a favor'}
            </div>
            {v && !fim && !locked && top && (
              <div className="mt-2.5 flex justify-center">
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
                  }}
                  variant="ambar"
                />
              </div>
            )}
            {!v && top && nValem >= PORTA_PREMISSAS && !fim && (
              <div className="mt-2 text-[10px] text-white/45 max-w-[130px] mx-auto leading-snug">sem preço coletado</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
