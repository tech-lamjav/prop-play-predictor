import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X, Minus } from 'lucide-react';
import { Crest } from './Crest';
import { RegistrarApostaCTA } from './RegistrarAposta';
import {
  useFutebolFixturePremissas,
  useFutebolFixtureNumeros,
  useFutebolFixtureInjuries,
  useFutebolFixtureHistorico,
  useFutebolFixtureReasonContract,
  useVitrine,
} from '@/hooks/use-futebol-data';
import { fmtDayChip, fmtTime, isFinished, isLive } from '@/utils/futebol-datas';
import { hrefDaSaida } from '@/utils/futebol-links';
import { chancePct, pickLabel } from '@/utils/futebol-score';
import { marketShort, rotuloDaFaixa } from '@/utils/futebol-score';
import { contaQueValem, rotuloPremissa, pesoForte } from '@/utils/futebol-premissas';
import { melhorLeitura, resumoDosMercados } from '@/utils/futebol-leitura';
import { estadoDosMotivos, explicacaoDaLeitura } from '@/utils/futebol-motivos';
import { ladoDaSaida } from '@/utils/futebol-evidencias';
import { evidenciaDoHistorico } from '@/utils/futebol-historico';
import { settleFutebol, isHit } from '@/utils/futebol-settlement';
import type {
  FutebolFixtureByDay,
  FutebolFixtureNumeros,
  FutebolFixturePremissas,
  FutebolValueBoardRow,
} from '@/services/futebol-data.service';

/**
 * O painel do jogo na coluna da direita (protótipo "Futebol Jogos").
 *
 * Ele responde uma pergunta só: POR QUE esta leitura. A lista já mostra pick, odd e
 * Score em cada linha, então aqui entra o motivo (as premissas com o número que as
 * embasa), como os dois chegam, a forma e os desfalques.
 *
 * Sem leitura o painel NÃO esvazia: explica o motivo e mostra o contexto assim
 * mesmo. A maioria dos jogos legitimamente não tem oportunidade, e um painel em
 * branco lê como defeito.
 *
 * Mas "sem leitura" só é dito depois que as fontes responderam. Enquanto elas
 * carregam entra o esqueleto: afirmar a ausência cedo demais é o mesmo erro,
 * com a agravante de aparecer em tamanho grande ao lado da lista.
 *
 * Três queries por jogo aberto (premissas, números e desfalques), todas leves e
 * compartilhadas com a tela de jogo: abrir o painel aquece a análise completa. A
 * `fixture_detail` saiu junto com o bloco de stats, que este desenho não tem mais.
 */

const RES_COR: Record<'V' | 'E' | 'D', { bg: string; fg: string }> = {
  V: { bg: '#2f7d50', fg: '#fff' },
  E: { bg: '#f1e9d6', fg: '#6b6350' },
  D: { bg: '#b8341c', fg: '#fff' },
};

function Forma({ forma }: { forma: string | null | undefined }) {
  if (!forma) return <span className="text-[11px]" style={{ color: '#8d8672' }}>—</span>;
  const ult = forma.slice(-5).split('').map((c) => (c === 'W' ? 'V' : c === 'D' ? 'E' : 'D') as 'V' | 'E' | 'D');
  return (
    <span className="flex gap-[3px]">
      {ult.map((r, i) => (
        <span
          key={i}
          className="w-[17px] h-[17px] rounded grid place-items-center text-[8.5px] font-bold"
          style={{ background: RES_COR[r].bg, color: RES_COR[r].fg }}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export function JogoResumoPanel({
  fixture,
  best,
  leituraCarregando,
  onClose,
  demo,
}: {
  fixture: FutebolFixtureByDay;
  best: FutebolValueBoardRow | null;
  /**
   * O board da página ainda está em voo. Somado ao carregando das premissas
   * daqui, decide se o painel pode concluir "Sem leitura para este jogo" — ela
   * é uma conclusão, e no desktop aparece em tamanho grande ao lado da linha
   * que ainda está em esqueleto.
   */
  leituraCarregando: boolean;
  onClose: () => void;
  /**
   * Premissas e números de exemplo, usados só enquanto o tour roda. O jogo do
   * tour é fictício, então buscar no banco devolvia vazio e o passo do porquê
   * abria um painel sem porquê nenhum.
   */
  demo?: { premissas: FutebolFixturePremissas[]; numeros: FutebolFixtureNumeros[] };
}) {
  const { data: premissasReais, isLoading: premissasCarregando } = useFutebolFixturePremissas(
    demo ? undefined : fixture.fixture_id,
  );
  const { data: numerosReais } = useFutebolFixtureNumeros(demo ? undefined : fixture.fixture_id);
  const premissas = demo?.premissas ?? premissasReais;
  const numeros = demo?.numeros ?? numerosReais;
  const { data: injuries } = useFutebolFixtureInjuries(fixture.fixture_id);
  const { data: historico } = useFutebolFixtureHistorico(fixture.fixture_id);
  // O contrato de motivos (#334). No tour os dados são de mentira, então não há
  // o que buscar.
  const { data: contrato, isLoading: contratoCarregando } = useFutebolFixtureReasonContract(
    demo ? undefined : fixture.fixture_id,
  );

  const fim = isFinished(fixture.status_short);
  const live = isLive(fixture.status_short);
  const dia = fmtDayChip(fixture.day_brt);

  // A leitura: com preço, a melhor do value board; sem preço, o mercado com mais
  // premissas. É a mesma conta da tela de jogo, então os dois nunca divergem.
  // A vitrine (#324): mesma razão do JogoResumo — a prateleira sai do catálogo.
  const { ocultos } = useVitrine();
  const resumos = useMemo(() => resumoDosMercados(premissas, best ? [] : null, null, ocultos), [premissas, best, ocultos]);
  const topo = useMemo(() => melhorLeitura(resumos), [resumos]);

  const mercadoLeitura = best ? best.market : topo?.mercado.slug ?? null;
  // As premissas têm que ser as da MESMA saída do pick. Pegando só "o melhor
  // candidato do mercado", o painel listava as premissas da linha 4,25 embaixo de um
  // pick de 2,5 — duas leituras diferentes na mesma caixa.
  const cand = !mercadoLeitura
    ? null
    : (best
        ? (premissas ?? []).find(
            (r) =>
              r.market === best.market &&
              r.outcome === best.outcome &&
              ((r.line_value == null && best.line_value == null) ||
                (r.line_value != null && best.line_value != null && Math.abs(r.line_value - best.line_value) < 0.011)),
          )
        : null) ?? resumos.find((r) => r.mercado.slug === mercadoLeitura)?.candidato ?? null;
  const pick = best
    ? pickLabel(best, fixture.home_team_name, fixture.away_team_name)
    : topo
      ? pickLabel(topo.candidato, fixture.home_team_name, fixture.away_team_name)
      : null;

  // No tour os dados são de mentira e chegam prontos: não há espera a mostrar.
  const carregandoLeitura = demo ? false : leituraCarregando || premissasCarregando;
  const temLeitura = !!best || (topo != null && topo.nValem > 0);
  // Os dois links do painel levam à MESMA leitura que ele está exibindo (#344).
  // Sem isso a tela do jogo abria no desempate padrão — normalmente gols — e o
  // pick que a pessoa acabou de ler não estava mais na tela. Sem preço não há
  // saída para filtrar, e aí abre a tela inteira, que é o honesto.
  const paraOJogo = hrefDaSaida(best, fixture.fixture_id);
  const lado = cand ? ladoDaSaida(mercadoLeitura!, cand.outcome) : null;
  const nValem = cand && mercadoLeitura ? contaQueValem(mercadoLeitura, cand.acesas) : 0;

  // A resposta a "por que essa aposta", da mesma fonte que a home, o resumo do
  // jogo e a bancada usam (#334). Com preço quem agrupa é o backend; sem preço
  // seguem as premissas acesas, e o rótulo muda.
  const explicacao = explicacaoDaLeitura(
    {
      mercado: mercadoLeitura ?? '',
      candidato: cand,
      temPreco: !!best,
      contrato,
      numeros,
      historico,
      lado,
    },
    { max: 4, incluirPesoZero: false, maxContra: 2 },
  );
  const porques = explicacao.itens;

  // O contrato entra no que a tela espera antes de concluir. Sem isto o painel
  // afirmava "0 premissas a favor" enquanto a consulta voava — o mesmo defeito
  // que o card da home levou um ticket inteiro para consertar.
  const estadoDaExplicacao = estadoDosMotivos(
    explicacao.itens,
    explicacao.contra,
    !demo && !!best && contratoCarregando,
  );

  // Com preço são motivos, e motivo tem lado. Sem preço são premissas acesas, e
  // não há lado — o sufixo não pode prometer o que o rótulo acabou de tirar.
  const sufixoDaExplicacao =
    explicacao.rotulo === 'Por quê'
      ? explicacao.total === 1
        ? 'premissa a favor'
        : 'premissas a favor'
      : explicacao.total === 1
        ? 'premissa acesa'
        : 'premissas acesas';

  // O que pesou contra, AGORA DO CONTRATO.
  //
  // Antes era fabricado por negação: pegava as premissas do mercado que não
  // acenderam e negava cada uma, sem filtrar se ela se aplica à saída escolhida.
  // Num Over isso listava como contra uma premissa que só existe para o Under —
  // o defeito que o aceite da virada proíbe com esse exemplo literal.
  const contra = explicacao.contra.length
    ? `${explicacao.contra.length} ${explicacao.contra.length === 1 ? 'pesou' : 'pesaram'} contra: ${explicacao.contra
        .map(({ premissa }) => rotuloPremissa(premissa, lado, true).toLowerCase())
        .join(' e ')}.`
    : null;

  const casa = numeros?.find((n) => n.side === 'home');
  const fora = numeros?.find((n) => n.side === 'away');
  const d1 = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(1).replace('.', ','));
  const chegam = casa && fora
    ? [
        { label: 'Gols marcados', a: casa.gf_total, b: fora.gf_total, maiorEhCasa: true },
        { label: 'Gols sofridos', a: casa.ga_total, b: fora.ga_total, maiorEhCasa: false },
        { label: 'Sem sofrer gol', a: casa.clean_sheets, b: fora.clean_sheets, maiorEhCasa: true },
      ].filter((x) => x.a != null && x.b != null)
    : [];

  const desfalques = (teamId: number) =>
    (injuries ?? [])
      .filter((i) => i.team_id === teamId)
      .slice(0, 2)
      .map((i) => i.player_name)
      .join(', ') || '—';

  const desfecho =
    fim && cand && mercadoLeitura
      ? settleFutebol(cand, fixture.goals_home, fixture.goals_away)
      : null;

  const chance = best ? chancePct(best.prob_justa_fechamento) : null;

  return (
    <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: '1px solid #ded2b6' }}>
      <div
        className="px-4 py-2.5 flex items-center gap-2.5"
        style={{ background: 'var(--canvas-2)', borderBottom: '1px solid #ded2b6' }}
      >
        <Crest name={fixture.home_team_name} id={fixture.home_team_id} size={20} />
        {/* O título leva à tela do jogo (#341). Era o único caminho para lá que
            não existia: o painel só tinha o botão do rodapé, que fica abaixo da
            dobra em painel comprido. */}
        {/* `py-1.5 -my-1.5` dá 24px de altura de alvo sem empurrar o cabeçalho:
            o texto tem 13,5px e sozinho ficava em ~18px, abaixo do mínimo de
            alvo de clique. A margem negativa devolve o espaço ao layout. */}
        <Link
          to={paraOJogo}
          className="text-[13.5px] font-semibold tracking-tight text-ink truncate hover:underline py-1.5 -my-1.5"
          title="Abrir a tela do jogo"
        >
          {fixture.home_team_name} × {fixture.away_team_name}
        </Link>
        <Crest name={fixture.away_team_name} id={fixture.away_team_id} size={20} />
        <span className="text-[11px] truncate" style={{ color: '#8d8672' }}>
          {fim || live
            ? `${live ? 'ao vivo' : 'encerrado'} · ${fixture.goals_home ?? 0} × ${fixture.goals_away ?? 0}`
            : `${dia.weekday} ${dia.day} ${fmtTime(fixture.kickoff_utc) ?? ''}`}
        </span>
        <button
          onClick={onClose}
          className="ml-auto w-6 h-6 shrink-0 grid place-items-center rounded-md transition hover:bg-white"
          style={{ color: '#8d8672' }}
          aria-label="Fechar resumo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {temLeitura && pick && (
        <div className="relative overflow-hidden px-5 py-5" style={{ background: 'linear-gradient(135deg,#0a3d2e,#08321f 60%,#051f12)' }}>
          <div
            className="absolute pointer-events-none"
            style={{ right: -50, top: -70, width: 230, height: 230, borderRadius: 999, background: 'radial-gradient(circle,rgba(251,191,36,.24),transparent 68%)' }}
          />
          <div className="relative flex items-end justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 h-[17px]">
                <span className="text-[9.5px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,.45)' }}>
                  Melhor leitura · {marketShort(mercadoLeitura!)}
                </span>
                {desfecho && (
                  <span
                    className="inline-flex items-center h-[17px] px-1.5 rounded text-[9px] font-bold uppercase tracking-[0.08em]"
                    style={
                      isHit(desfecho)
                        ? { background: 'rgba(142,230,176,.18)', color: '#8ee6b0' }
                        : { background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)' }
                    }
                  >
                    {isHit(desfecho) ? 'bateu' : desfecho === 'push' ? 'anulada' : 'não bateu'}
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.025em] text-white">{pick}</div>
              {best ? (
                <div className="flex gap-4 mt-2.5">
                  <div>
                    <div className="text-[8.5px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Chance</div>
                    <div className="tabular-nums text-[15px] font-semibold text-white mt-0.5">{chance}%</div>
                  </div>
                  <div>
                    <div className="text-[8.5px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Odd</div>
                    <div className="tabular-nums text-[15px] font-semibold text-white mt-0.5">{best.best_odd.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[8.5px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Vantagem</div>
                    <div className="tabular-nums text-[15px] font-semibold mt-0.5" style={{ color: best.edge > 0 ? '#8ee6b0' : 'rgba(255,255,255,.55)' }}>
                      {`${best.edge >= 0 ? '+' : '−'}${Math.abs(best.edge * 100).toFixed(1).replace('.', ',')}%`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] mt-2.5" style={{ color: 'rgba(255,255,255,.55)' }}>
                  sem preço coletado ainda · as odds entram perto do jogo
                </div>
              )}
            </div>
            <div className="text-center shrink-0">
              <div className="tabular-nums text-[40px] font-bold leading-none tracking-[-0.04em]" style={{ color: '#fbbf24' }}>
                {best ? best.score : nValem}
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,.5)' }}>
                {best ? `Score · ${rotuloDaFaixa(best.faixa)}` : 'premissas a favor'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {temLeitura ? (
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: '#8d8672' }}>
              {/* O sufixo acompanha o rótulo. Dizer "a favor" sob "O que o jogo
                  mostra" seria a mesma promessa que o rótulo acabou de tirar:
                  sem preço não há aposta a favor de quê. */}
              {explicacao.rotulo} · {explicacao.total} {sufixoDaExplicacao}
            </div>
            {/* Enquanto o contrato voa, esqueleto — e não a lista vazia, que
                afirmaria "não há motivo" antes de saber. */}
            {estadoDaExplicacao === 'carregando' && (
              <div className="mt-2.5 flex flex-col gap-2.5" aria-hidden>
                <Skeleton className="h-[16px] w-full" />
                <Skeleton className="h-[16px] w-4/5" />
              </div>
            )}
            <div className="mt-2.5 flex flex-col gap-2.5">
              {porques.map(({ premissa: p, evidencia: ev }) => (
                <div key={p.slug} className="flex gap-2.5 items-start">
                  <span
                    className="shrink-0 mt-0.5 h-[18px] px-1.5 rounded inline-flex items-center text-[9px] font-bold uppercase tracking-[0.08em]"
                    style={pesoForte(p) ? { background: '#dcefe2', color: '#0a3d2e' } : { background: '#eae2cf', color: '#8d8672' }}
                  >
                    {pesoForte(p) ? 'Forte' : 'Médio'}
                  </span>
                  <span className="flex-1 min-w-0 text-[12.5px] leading-relaxed" style={{ color: '#3f463d' }}>
                    <b className="font-semibold">{rotuloPremissa(p, lado)}.</b>
                    {ev ? ` ${ev.texto}.` : ''}
                  </span>
                </div>
              ))}
            </div>
            {contra && (
              <div
                className="mt-3.5 px-3.5 py-2.5 rounded-xl flex gap-2.5 items-start"
                style={{ background: 'var(--canvas-2)', border: '1px solid #e5d9bd' }}
              >
                <Minus className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#b8870f' }} strokeWidth={3} />
                <span className="text-[12px] leading-relaxed" style={{ color: '#6b6350' }}>{contra}</span>
              </div>
            )}
          </div>
        ) : carregandoLeitura ? (
          // Nem "tem leitura" nem "não tem": ainda não dá para dizer. O bloco
          // ocupa a mesma caixa da negação, que é a maior das duas.
          <div
            data-testid="painel-leitura-carregando"
            aria-busy="true"
            className="px-4 py-3.5 rounded-[14px] flex flex-col gap-2"
            style={{ background: 'var(--canvas-2)', border: '1px solid #e5d9bd' }}
          >
            <Skeleton className="h-[13px] w-[60%] bg-line/60" />
            <Skeleton className="h-[12px] w-[85%] bg-line/60" />
            <Skeleton className="h-[12px] w-[70%] bg-line/60" />
          </div>
        ) : (
          <div className="px-4 py-3.5 rounded-[14px]" style={{ background: 'var(--canvas-2)', border: '1px solid #e5d9bd' }}>
            <div className="text-[12.5px] font-semibold text-ink">Sem leitura para este jogo</div>
            <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: '#6b6350' }}>
              {premissas?.length
                ? 'Nenhuma premissa passou a porta de 2 em nenhum mercado.'
                : 'As premissas deste jogo ainda não foram calculadas.'}
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: '#8d8672' }}>
              Isso não é defeito: a maioria dos jogos legitimamente não tem oportunidade. O contexto abaixo continua
              valendo.
            </p>
          </div>
        )}

        {chegam.length > 0 && (
          <div className="mt-4 pt-3.5" style={{ borderTop: '1px solid #f1e9d6' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: '#8d8672' }}>
                Como chegam
              </span>
              <span className="text-[10.5px] truncate max-w-[60%]" style={{ color: '#8d8672' }}>
                {fixture.home_team_name} · {fixture.away_team_name}
              </span>
            </div>
            <div className="mt-2.5 flex flex-col gap-3">
              {chegam.map((c) => {
                const tot = (c.a ?? 0) + (c.b ?? 0) || 1;
                const wa = `${Math.round(((c.a ?? 0) / tot) * 100)}%`;
                const wb = `${Math.round(((c.b ?? 0) / tot) * 100)}%`;
                const inteiro = c.label === 'Sem sofrer gol';
                return (
                  <div key={c.label}>
                    <div className="flex justify-between items-baseline mb-1 tabular-nums">
                      <span className="text-[14px] font-semibold" style={{ color: '#0a3d2e' }}>
                        {inteiro ? c.a : d1(c.a)}
                      </span>
                      <span className="text-[10.5px] font-medium" style={{ color: '#8d8672' }}>{c.label}</span>
                      <span className="text-[14px] font-semibold" style={{ color: '#6b6350' }}>
                        {inteiro ? c.b : d1(c.b)}
                      </span>
                    </div>
                    <div className="flex gap-[3px] h-1.5">
                      <div className="flex-1 flex justify-end overflow-hidden" style={{ background: '#f1e9d6', borderRadius: '999px 0 0 999px' }}>
                        <div style={{ width: wa, background: '#0a3d2e' }} />
                      </div>
                      <div className="flex-1 overflow-hidden" style={{ background: '#f1e9d6', borderRadius: '0 999px 999px 0' }}>
                        <div style={{ width: wb, height: '100%', background: '#c4bda8' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 flex items-center gap-2.5" style={{ borderTop: '1px solid #f1e9d6' }}>
              <span className="text-[10.5px] font-medium shrink-0" style={{ color: '#8d8672' }}>Forma</span>
              <Forma forma={casa?.forma} />
              <span className="ml-auto">
                <Forma forma={fora?.forma} />
              </span>
            </div>

            <div className="mt-3 pt-3 flex items-center gap-2.5" style={{ borderTop: '1px solid #f1e9d6' }}>
              <span className="text-[10.5px] font-medium shrink-0" style={{ color: '#8d8672' }}>Desfalques</span>
              <span className="text-[12px] truncate" style={{ color: '#3f463d' }}>{desfalques(fixture.home_team_id)}</span>
              <span className="ml-auto text-[12px] truncate" style={{ color: '#3f463d' }}>{desfalques(fixture.away_team_id)}</span>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Link
            to={paraOJogo}
            className="flex-1 h-10 rounded-[10px] bg-forest text-canvas text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-forest-2 transition"
          >
            {temLeitura ? 'Ver a análise dos 5 mercados' : 'Ver a análise completa'} <ArrowRight className="w-4 h-4" />
          </Link>
          {best && !fim && (
            <RegistrarApostaCTA
              draft={{
                homeName: fixture.home_team_name,
                awayName: fixture.away_team_name,
                competition: fixture.competition,
                kickoffUtc: fixture.kickoff_utc,
                market: best.market,
                outcome: best.outcome,
                lineValue: best.line_value,
                bestOdd: best.best_odd,
                oddKind: 'melhor',
              }}
              variant="ambar"
              rotulo="Registrar"
            />
          )}
        </div>
      </div>
    </div>
  );
}
