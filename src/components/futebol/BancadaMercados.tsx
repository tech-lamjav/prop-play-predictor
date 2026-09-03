import { useMemo, useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Blur } from '@/components/futebol/FutebolGate';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';
import {
  useVitrine,
  useFutebolFixturePremissas,
  useFutebolFixtureNumeros,
  useFutebolFixtureHistorico,
  useFutebolFixtureInjuries,
  useFutebolFixtureOdds,
  useFutebolFixtureReasonContract,
  useFutebolFixtureDisponibilidade,
} from '@/hooks/use-futebol-data';
import type { FutebolFixturePremissas, FutebolFixtureReasonContractRow, FutebolFixtureValueRow } from '@/services/futebol-data.service';
import {
  MERCADOS,
  PORTA_PREMISSAS,
  PREMISSAS_OCULTAS,
  contaQueValem,
  contextoDoMercado,
  melhorCandidato,
  outcomeLabel,
  pesoForte,
  premissaDe,
  premissasDaSaida,
  type MercadoInfo,
  type Premissa,
} from '@/utils/futebol-premissas';
import { evidenciaDe, ladoDaSaida } from '@/utils/futebol-evidencias';
import { evidenciaDoHistorico } from '@/utils/futebol-historico';
import { MotivosJogoPorJogo } from './MotivosJogoPorJogo';
import { avisoSemDado } from '@/utils/futebol-sem-dado';
import { valueDoCandidato, resumoDosMercados, mesmaLinha, saidaQueAbreAFolha, type SaidaPreferida } from '@/utils/futebol-leitura';
import { ehDestaque, ehFaixaAlta, rotuloDaFaixa, fronteirasDoScore } from '@/utils/futebol-score';
import { leituraDaCotacao } from '@/utils/futebol-cotacao';
import { filtrarCatalogoDeMercados } from '@/utils/futebol-mercados-ocultos';
import { disponivelDesdeDaSaida, rotuloDisponivelDesde } from '@/utils/futebol-disponibilidade';
import { separarMotivosDoContrato } from '@/utils/futebol-motivos';
import { evidenciaDaPremissa } from '@/utils/futebol-evidencia-da-premissa';
import { acendeuNaSaida, rotuloEmTitulo } from '@/utils/futebol-estado-da-premissa';
import { useGuardaDeDivergencia } from '@/hooks/use-guarda-de-divergencia';
import { settleFutebol, resultBadge, isHit, type BetResult } from '@/utils/futebol-settlement';
import { hasKickoffPassed, isFinished, parseUtc } from '@/utils/futebol-datas';
import { linhaDaSaida } from '@/utils/futebol-saida';
import type { MatchupTendencies } from '@/utils/futebol-tendencias';
import type { JogoInfo } from './JogoResumo';

/**
 * Aba MERCADOS — a "bancada" do Protótipo 1b: um mercado por vez, com a régua de
 * linhas (gols e handicap) ou as saídas (1X2, ambos marcam, dupla chance), os dois
 * lados comparados, o veredito em uma frase, e as premissas com peso em PALAVRA.
 *
 * Os ESTADOS de uma premissa são cinco e nunca se misturam (#357, e o vocabulário
 * mora em futebol-estado-da-premissa.ts):
 *   · acesa                    o insumo cruzou o corte
 *   · não atingiu o corte      tem insumo, foi avaliada, ficou aquém
 *   · não se aplica            é do outro lado da saída, ou de outro mercado
 *   · sem dado                 faltou insumo, o Motor não avaliou (vem do contador)
 *   · sem número para conferir acendeu, e o front não tem o insumo para mostrar
 *
 * ⚠️ "Não aconteceu neste jogo" era o rótulo do segundo, e era falso: no clean
 * sheets com 38%, os jogos sem sofrer gol ACONTECERAM — só ficaram abaixo do
 * corte de 40%. Mesma família de erro do rótulo "Contra".
 *
 * Corta o peso por cima disso: peso 0 não é estado, é quanto ela vale. A premissa
 * de peso zero aparece, com o selo "já na odd" dizendo por que não soma.
 *
 * Score/odd/chance/edge são REAIS (get_futebol_fixture_value) e só existem com
 * odds coletadas. Sem odds, a bancada vive das premissas e diz "sem preço ainda".
 */

const TIPO_LINHA = new Set(['goals_over_under', 'asian_handicap']);

/** Linha em pt-BR. Sinal só no handicap: "+2,5 gols" não existe. */
function fmtLinha(v: number, comSinal: boolean): string {
  return `${comSinal && v > 0 ? '+' : ''}${String(v).replace('.', ',')}`;
}

/** Reavalia a tela no apito, mesmo se a fonte ainda não atualizou o status. */
function useJogoJaComecou(kickoffUtc: string | null): boolean {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const kickoff = parseUtc(kickoffUtc);
    if (!kickoff || hasKickoffPassed(kickoffUtc, agora)) return;
    const espera = Math.min(kickoff.getTime() - agora.getTime(), 2_147_483_647);
    const timer = window.setTimeout(() => setAgora(new Date()), espera);
    return () => window.clearTimeout(timer);
  }, [kickoffUtc, agora]);

  return hasKickoffPassed(kickoffUtc, agora);
}

/**
 * A régua de linhas: arrastar a bolinha, clicar na trilha ou usar as setas.
 *
 * Era uma fileira de pills com as 5 linhas mais centrais, e o mart cota 21 no
 * mercado de gols e 19 no handicap: as outras 16 simplesmente não existiam na tela.
 * As paradas ficam em intervalos iguais (não proporcionais ao valor), porque o que
 * se escolhe aqui é uma cotação da lista, não uma posição numa reta contínua.
 */
function ReguaLinhas({
  paradas,
  valor,
  onEscolher,
  rotulo,
  destaque,
  forca,
}: {
  paradas: number[];
  valor: number | null;
  onEscolher: (v: number) => void;
  rotulo: (v: number) => string;
  /** A linha da melhor leitura, marcada em âmbar. */
  destaque: number | null;
  /**
   * Quantas premissas sustentam cada linha, no lado escolhido. A parada mostrava a
   * liquidação (verde/rosa) do jogo encerrado, e isso não tinha relação nenhuma com
   * a força da leitura naquela linha, que é o que a régua deveria dizer.
   */
  forca: Map<number, number>;
}) {
  const trilha = useRef<HTMLDivElement | null>(null);
  // A medida da trilha é tirada UMA vez, no pointerdown, e vale o arrasto inteiro.
  // Medindo a cada movimento, qualquer mudança de largura no meio do caminho
  // reposicionava a mão do usuário: a parada com preço faz aparecer o botão de
  // registrar, a trilha encolhia, e o mesmo X do cursor virava outra parada.
  const medidaDaTrilha = useRef<DOMRect | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const soltar = () => { setArrastando(false); medidaDaTrilha.current = null; };
  const i = valor != null ? paradas.findIndex((p) => mesmaLinha(p, valor)) : -1;
  const idx = i < 0 ? 0 : i;
  const pos = paradas.length > 1 ? (idx / (paradas.length - 1)) * 100 : 0;

  const escolherPorX = (clientX: number) => {
    const r = medidaDaTrilha.current ?? trilha.current?.getBoundingClientRect();
    if (!r || !r.width || paradas.length < 2) return;
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onEscolher(paradas[Math.round(t * (paradas.length - 1))]);
  };

  return (
    <div className="flex-1 min-w-[220px]">
      <div
        ref={trilha}
        role="slider"
        tabIndex={0}
        aria-label="Linha"
        aria-valuemin={paradas[0]}
        aria-valuemax={paradas[paradas.length - 1]}
        aria-valuenow={valor ?? undefined}
        aria-valuetext={valor != null ? rotulo(valor) : undefined}
        className="relative h-8 cursor-pointer select-none touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#fbbf24] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08321f]"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          medidaDaTrilha.current = e.currentTarget.getBoundingClientRect();
          setArrastando(true);
          escolherPorX(e.clientX);
        }}
        onPointerMove={(e) => arrastando && escolherPorX(e.clientX)}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        // Fecha o caminho em que o navegador não tem captura de ponteiro: sem ela o
        // pointerup cai fora do elemento, "arrastando" ficava travado em true e a
        // trilha seguia respondendo ao mouse depois de solta.
        onLostPointerCapture={soltar}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onEscolher(paradas[Math.max(0, idx - 1)]);
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onEscolher(paradas[Math.min(paradas.length - 1, idx + 1)]);
          }
        }}
      >
        <div className="absolute left-0 right-0 top-[13px] h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,.14)' }} />
        <div className="absolute left-0 top-[13px] h-1.5 rounded-full" style={{ width: `${pos}%`, background: '#fbbf24' }} />

        {paradas.map((p, k) => {
          const left = `${(k / (paradas.length - 1)) * 100}%`;
          const n = forca.get(p) ?? 0;
          const ehDestaque = destaque != null && Math.abs(p - destaque) < 0.001;
          // Ponto maior e mais claro onde a linha tem mais premissas a favor; âmbar
          // na linha da melhor leitura.
          const tam = n >= PORTA_PREMISSAS ? 6 : n > 0 ? 4 : 3;
          return (
            <span
              key={p}
              className="absolute rounded-full pointer-events-none"
              title={`${rotulo(p)} · ${n} ${n === 1 ? 'premissa' : 'premissas'} a favor`}
              style={{
                left,
                top: 16 - (tam - 3) / 2,
                width: tam,
                height: tam,
                transform: 'translateX(-50%)',
                background: ehDestaque ? '#fbbf24' : `rgba(255,255,255,${n >= PORTA_PREMISSAS ? 0.85 : n > 0 ? 0.5 : 0.28})`,
              }}
            />
          );
        })}

        <span
          className="absolute top-[7px] w-[18px] h-[18px] rounded-full pointer-events-none"
          style={{
            left: `${pos}%`,
            transform: 'translateX(-50%)',
            background: '#fff',
            border: '3px solid #fbbf24',
            boxShadow: '0 2px 8px rgba(0,0,0,.35)',
          }}
        />
      </div>
      <div className="flex justify-between text-[9.5px] tabular-nums" style={{ color: 'rgba(255,255,255,.4)' }}>
        <span>{rotulo(paradas[0])}</span>
        <span>{rotulo(paradas[paradas.length - 1])}</span>
      </div>
    </div>
  );
}

function SeloRes({ r }: { r: BetResult }) {
  const b = resultBadge(r);
  const c =
    b.tone === 'won'
      ? { bg: '#dcefe2', fg: '#0a3d2e', dot: '#2f7d50' }
      : b.tone === 'push'
        ? { bg: '#eef0eb', fg: '#5a625a', dot: '#8a8f86' }
        : { bg: '#fbe3e8', fg: '#be123c', dot: '#be123c' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[10.5px] font-bold tracking-[0.06em]"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {b.label}
    </span>
  );
}

export function BancadaMercados({
  jogo,
  valueRows,
  tendencies,
  locked,
  mercadoAtivo,
  onMercado,
  preferida,
}: {
  jogo: JogoInfo;
  valueRows: FutebolFixtureValueRow[] | null | undefined;
  tendencies?: MatchupTendencies | null;
  locked: boolean;
  mercadoAtivo: string;
  onMercado: (slug: string) => void;
  /** A saída que o usuário clicou em Oportunidades, quando ele veio de lá. */
  preferida?: SaidaPreferida | null;
}) {
  const { data: rows, isLoading } = useFutebolFixturePremissas(jogo.fixtureId);
  const { data: numeros } = useFutebolFixtureNumeros(jogo.fixtureId);
  const { data: historico } = useFutebolFixtureHistorico(jogo.fixtureId);
  const { data: injuries } = useFutebolFixtureInjuries(jogo.fixtureId);
  const { data: oddsRows } = useFutebolFixtureOdds(jogo.fixtureId);
  const {
    data: reasonContractRows,
    isLoading: carregandoContratoMotivos,
    isError: falhaContratoMotivos,
  } = useFutebolFixtureReasonContract(jogo.fixtureId);
  const { data: disponibilidade } = useFutebolFixtureDisponibilidade(jogo.fixtureId);

  const fim = isFinished(jogo.statusShort);
  const jogoJaComecou = useJogoJaComecou(jogo.kickoffUtc);
  const placar = fim ? { home: jogo.goalsHome, away: jogo.goalsAway } : null;
  // A vitrine (#324). Sem ela a prateleira sairia do catálogo inteiro, e o
  // mercado escondido voltaria como chip — com barra de Score e sem odd.
  const { ocultos } = useVitrine();
  const mercadosVisiveis = useMemo(
    () => filtrarCatalogoDeMercados(MERCADOS, ocultos),
    [ocultos],
  );

  // `mercadoAtivo` vem de fora e pode apontar para um mercado que saiu da
  // vitrine (link antigo, estado guardado). O fallback é o primeiro VISÍVEL, e
  // não `MERCADOS[0]`, senão a aba ressuscitaria o que a lista escondeu.
  const mercado: MercadoInfo =
    mercadosVisiveis.find((m) => m.slug === mercadoAtivo) ?? mercadosVisiveis[0] ?? MERCADOS[0];
  const ehLinha = TIPO_LINHA.has(mercado.slug);
  const ehAH = mercado.slug === 'asian_handicap';

  const resumos = useMemo(
    () => resumoDosMercados(rows, valueRows, preferida, ocultos),
    [rows, valueRows, preferida, ocultos],
  );
  const mercadosCotados = useMemo(
    () => resumos.filter((r) => leituraDaCotacao(
      r.mercado.slug,
      r.candidato.outcome,
      r.candidato.line_value,
      valueRows,
      oddsRows,
    ).estado !== 'sem_cotacao').length,
    [resumos, valueRows, oddsRows],
  );

  const doMercado = useMemo(
    () => (rows ?? []).filter((r) => r.market === mercado.slug).filter((r) => !(mercado.slug === 'asian_handicap' && r.line_value === 0)),
    [rows, mercado.slug],
  );

  // O candidato que abre a folha é o MESMO do card do mercado e do hero: com preço
  // coletado, a saída do melhor Score. Vinha só das premissas, então clicar num card
  // que dizia "Mais de 1,5 gols" abria a régua em 4,5.
  //
  // Sem fallback de propósito: resumoDosMercados só deixa um mercado de fora quando
  // melhorCandidato dele já é nulo, então um "?? melhorCandidato(...)" aqui nunca
  // teria o que devolver, e ainda reabriria a porta das duas verdades.
  const candidatoInicialDoMercado = useMemo(
    () => saidaQueAbreAFolha(resumos.find((r) => r.mercado.slug === mercado.slug)),
    [resumos, mercado.slug],
  );

  // TODAS as linhas ANALISADAS do mercado, em ordem — não só as cotadas, que é o
  // que este comentário dizia e o código nunca fez: a fonte é `doMercado`, que
  // são as premissas. A distinção passou a importar na #346, onde a régua abre
  // numa linha sem cotação de propósito.
  //
  // Com pills a tela mostrava as 5 mais centrais e as outras 16 não existiam; na
  // régua arrastável cabem todas.
  const paradas = useMemo(() => {
    if (!ehLinha) return [] as number[];
    return [...new Set(doMercado.map((r) => r.line_value).filter((v): v is number => v != null))].sort((a, b) => a - b);
  }, [doMercado, ehLinha]);

  const [linha, setLinha] = useState<number | null>(null);
  const [saida, setSaida] = useState<string | null>(null);
  // Depende do candidato inicial, não só de `rows`: premissas e preço chegam em requisições
  // separadas, e quando o preço chegava depois a régua ficava parada na linha que as
  // premissas tinham escolhido sozinhas.
  useEffect(() => {
    const anunciada = candidatoInicialDoMercado?.line_value;
    // `mesmaLinha`, e não `includes`: a linha é float e a comparação estrita
    // falha por ruído de representação. Hoje a linha anunciada vem do mesmo
    // array das paradas, então o `includes` acertava por sorte — no dia em que
    // ela vier de outra fonte (a URL, por exemplo), a régua centralizaria em
    // silêncio, que é o desvio que a #346 existe para tirar da frente.
    const naRegua = anunciada != null && paradas.some((p) => mesmaLinha(p, anunciada));
    setLinha(naRegua ? anunciada : paradas[Math.floor(paradas.length / 2)] ?? null);
    setSaida(candidatoInicialDoMercado?.outcome ?? null);
  }, [candidatoInicialDoMercado, paradas]);

  // Os lados da parada atual.
  const [ladoA, ladoB] = useMemo((): [FutebolFixturePremissas | null, FutebolFixturePremissas | null] => {
    if (ehLinha) {
      const [oa, ob] = mercado.slug === 'goals_over_under' ? ['Under', 'Over'] : ['Home', 'Away'];
      const at = (o: string) => doMercado.find((r) => r.outcome === o && r.line_value != null && linha != null && mesmaLinha(r.line_value, linha)) ?? null;
      return [at(oa), at(ob)];
    }
    const sel = doMercado.find((r) => r.outcome === saida) ?? candidatoInicialDoMercado;
    return [sel ?? null, null];
  }, [ehLinha, doMercado, linha, saida, candidatoInicialDoMercado, mercado.slug]);

  // Principal = o lado analisado. Começa no que tem mais contexto e o usuário troca
  // clicando no outro card: é assim que ele vê as premissas do outro lado, em vez de
  // uma lista de espelhos ("defesas frágeis" contra "defesas firmes") que se
  // contradiziam na mesma tela.
  const nA = ladoA ? contaQueValem(ladoA) : 0;
  const nB = ladoB ? contaQueValem(ladoB) : 0;
  const valA = ladoA ? valueDoCandidato(valueRows, ladoA) : null;
  const valB = ladoB ? valueDoCandidato(valueRows, ladoB) : null;
  const [ladoSel, setLadoSel] = useState<'a' | 'b' | null>(null);
  useEffect(() => setLadoSel(null), [mercado.slug, linha, saida]);
  // Sub-abas da folha: a favor e contra, as duas jogo a jogo (é onde mora a auditoria).
  const [abaMotivo, setAbaMotivo] = useState<'favor' | 'contra'>('favor');
  // O lado que abre por padrão. Onde a linha tem preço é o lado que TEM preço, que é
  // o que o card do mercado está anunciando; sem preço nenhum, o de mais premissas.
  const ladoPadrao = (() => {
    if (valA && valB) return valB.score > valA.score ? ladoB : ladoA;
    if (valA) return ladoA;
    if (valB) return ladoB;
    return ladoB && nB > nA ? ladoB : ladoA;
  })();
  const principal = ladoSel === 'a' ? ladoA : ladoSel === 'b' ? ladoB : ladoPadrao;
  const valPrincipal = principal === ladoB ? valB : valA;
  const cotacaoPrincipal = principal
    ? leituraDaCotacao(mercado.slug, principal.outcome, principal.line_value, valueRows, oddsRows)
    : { estado: 'sem_cotacao' as const, odd: null };

  // Nas saídas cotadas, o banco é a fonte do grupo de cada motivo. Ele evita
  // transformar uma premissa do lado oposto em frase negativa e mantém contador
  // e detalhe iguais nos cinco mercados.
  const contratoMotivos = useMemo((): FutebolFixtureReasonContractRow | null => {
    if (!principal) return null;
    return reasonContractRows?.find((r) =>
      r.market === principal.market &&
      r.outcome === principal.outcome &&
      mesmaLinha(r.line_value, principal.line_value),
    ) ?? null;
  }, [reasonContractRows, principal]);
  const requerContratoMotivos = valPrincipal != null;
  const contratoMotivosIndisponivel = requerContratoMotivos && !contratoMotivos;


  const labelDe = (c: FutebolFixturePremissas | null) =>
    c ? outcomeLabel(c, jogo.home, jogo.away) : '';

  // Favor / apagadas do lado principal. Só as premissas DAQUELE lado: as do outro
  // medem o mesmo número ao contrário ("defesas frágeis" × "defesas firmes"), então
  // listá-las aqui como "não aconteceu" fazia a tela se contradizer.
  const visiveis = principal
    ? premissasDaSaida(mercado, principal)
    : mercado.premissas.filter((p) => !PREMISSAS_OCULTAS.has(p.slug));
  // O agrupamento sai do vocabulário dos cinco estados (#357), e não de um
  // `acesasSet.has` solto: era assim que "não atingiu o corte" e "não se aplica a
  // esta saída" viravam a mesma pilha de apagadas.
  //
  // `acendeuNaSaida` junta `acesa` e `sem número para conferir` de propósito: as
  // duas acenderam, e o que difere é a tela ter o número — o que não muda de lista
  // quem é. Quem separa esses dois é a regra de exibição logo abaixo.
  const porPeso = (a: Premissa, b: Premissa) => (b.peso ?? 0) - (a.peso ?? 0);
  const acendeu = (p: Premissa) => principal != null && acendeuNaSaida(p, principal, principal.acesas);
  const favor = visiveis.filter(acendeu).sort(porPeso);
  const apagadas = visiveis.filter((p) => !acendeu(p)).sort(porPeso);
  const penAtivas = (principal?.penalidades ?? [])
    .filter((s) => !PREMISSAS_OCULTAS.has(s))
    .map((s) => premissaDe(mercado.slug, s))
    .filter((p): p is Premissa => p != null);

  const semCalibragem = mercado.teto == null;
  const ctx = contextoDoMercado(favor.filter(pesoForte).length, semCalibragem);

  const ladoPrincipal = principal ? ladoDaSaida(mercado.slug, principal.outcome) : null;
  const nPrincipal = principal ? contaQueValem(principal) : 0;
  const ate = numeros?.[0]?.ate ?? null;

  const chaveDosVisiveis = visiveis.map((p) => p.slug).join('|');

  // A guarda de divergência (#353). Ela não desenha nada: emite evento quando a
  // nossa derivação do critério discorda do booleano do mart. Fica aqui porque é
  // aqui que existem, juntos, o lado da saída, a linha e o histórico.
  //
  // ⚠️ NÃO tratar a divergência escondendo o número na tela. Foi o que as guardas
  // `desmenteAlta`/`desmenteBaixa` faziam, e um silenciador ao lado de um detector
  // anula o detector.
  useGuardaDeDivergencia({
    mercado: mercado.slug,
    acesas: principal?.acesas,
    historico,
    lado: ladoPrincipal,
    linha,
    // ⚠️ A chave do memo é a string dos slugs, e não o array `visiveis`: ele é
    // reconstruído a cada render, e memoizar sobre ele nunca segura — o memo de
    // dentro do hook estouraria junto, e a varredura de divergência rodaria a
    // cada render de uma tela que rerenderiza ao arrastar a régua.
    slugs: useMemo(() => visiveis.map((p) => p.slug), [chaveDosVisiveis]), // eslint-disable-line react-hooks/exhaustive-deps
  });

  // "Como chegam": as barras espelhadas casa × fora, agora dentro da coluna dos
  // mercados. A barra da posição usa o valor do OUTRO lado, porque na tabela menor
  // é melhor.
  const barras = useMemo(() => {
    const casa = numeros?.find((x) => x.side === 'home');
    const fora = numeros?.find((x) => x.side === 'away');
    if (!casa || !fora) return [];
    const d1 = (v: number) => v.toFixed(1).replace('.', ',');
    const linhas: { l: string; a: string; b: string; va: number; vb: number }[] = [];
    if (casa.gf_total != null && fora.gf_total != null)
      linhas.push({ l: 'Gols marcados', a: d1(casa.gf_total), b: d1(fora.gf_total), va: casa.gf_total, vb: fora.gf_total });
    if (casa.ga_total != null && fora.ga_total != null)
      linhas.push({ l: 'Gols sofridos', a: d1(casa.ga_total), b: d1(fora.ga_total), va: fora.ga_total, vb: casa.ga_total });
    if (casa.posicao != null && fora.posicao != null)
      linhas.push({ l: 'Posição', a: `${casa.posicao}º`, b: `${fora.posicao}º`, va: fora.posicao, vb: casa.posicao });
    if (casa.clean_sheets != null && fora.clean_sheets != null)
      linhas.push({ l: 'Sem sofrer gol', a: String(casa.clean_sheets), b: String(fora.clean_sheets), va: casa.clean_sheets, vb: fora.clean_sheets });
    return linhas.map((x) => {
      const tot = x.va + x.vb || 1;
      return { ...x, wa: `${Math.round((x.va / tot) * 100)}%`, wb: `${Math.round((x.vb / tot) * 100)}%` };
    });
  }, [numeros]);

  // O número da premissa: temporada (094) e, para o que ela não cobre, calculado dos
  // jogos do histórico (095) — é o que dá número às premissas de chance de gol.
  const evDe = (slug: string, acesa = true) =>
    evidenciaDaPremissa({
      mercado: mercado.slug,
      slug,
      numeros,
      historico,
      lado: ladoPrincipal,
      linha,
      acesa,
    });


  // A premissa aparece se ela CONTA para o Score, ou se, mesmo sem contar, existe
  // número para o assinante conferir.
  //
  // A regra é UMA para os dois lados da tela (#351). Antes eram duas: a acesa de
  // peso zero aparecia quando tinha número, e a apagada de peso zero sumia sempre.
  // O efeito era o assinante ver três premissas embaixo de um Over que tem seis, e
  // não ter como saber se as outras não existiam, não foram avaliadas ou não
  // bateram. Peso zero não é premissa quebrada: é premissa que a recalibragem
  // tirou da conta e que continua descrevendo o jogo — o selo "já na odd" é quem
  // conta essa parte.
  //
  // O que segue de fora é a premissa que não conta E não tem número: hoje só a de
  // ritmo, cujo insumo não existe em nada que o front alcance (#348). Acesa, ela
  // está no estado SEM NÚMERO PARA CONFERIR; apagada, a linha seria "jogo de ritmo
  // alto · não conta" sem nada embaixo. Nos dois casos ela levanta a pergunta "de
  // onde veio isso?" sem ter resposta na tela, e por decisão de produto fica fora
  // enquanto a #348 não servir o insumo.
  //
  // ⚠️ A regra olha o NÚMERO, e não o estado: `sem número para conferir` é
  // definido só para premissa ACESA, e usá-lo aqui deixaria a de ritmo apagada
  // aparecer. São perguntas diferentes — o estado é sobre o modelo, esta regra é
  // sobre o que a tela consegue mostrar.
  const temOQueMostrar = (p: Premissa, acesa: boolean) =>
    p.peso == null || p.peso > 0 || evDe(p.slug, acesa) != null;

  // `acesa: false` nas apagadas de propósito: numa premissa que não bateu o número
  // nunca é suprimido, porque é ele que explica o porquê de não ter batido.
  const naoAtingiuOCorte = apagadas.filter((p) => temOQueMostrar(p, false));
  const favorVisivel = favor.filter((p) => temOQueMostrar(p, true));

  const motivosDoContrato = (itens: FutebolFixtureReasonContractRow['favor']) => {
    const separados = separarMotivosDoContrato(itens);
    return {
      premissas: separados.slugsDePremissas
        .map((slug) => premissaDe(mercado.slug, slug))
        .filter((p): p is Premissa => p != null),
      extras: separados.motivosSemDrilldown,
    };
  };
  const motivosFavor = contratoMotivos
    ? motivosDoContrato(contratoMotivos.favor)
    : requerContratoMotivos
      ? { premissas: [], extras: [] }
      : { premissas: favorVisivel, extras: [] };

  // Contras: os do backend (quando há preço) + penalidades ativas.
  //
  // A penalidade de desfalque aparecia como título solto, sem dizer QUEM está fora.
  // Aqui ela puxa a lista de desfalques do lado certo; quando a lista ainda não
  // saiu, a tela diz isso em vez de deixar a linha muda.
  const contras = useMemo(() => {
    if (requerContratoMotivos) return [];
    const out: { t: string; sub?: string }[] = [];
    (valPrincipal?.contras ?? []).forEach((t) => out.push({ t }));
    (valPrincipal?.avisos ?? []).forEach((t) => out.push({ t }));

    const idDoLado = ladoPrincipal === 'away' ? jogo.awayId : jogo.homeId;
    const idDoAdv = ladoPrincipal === 'away' ? jogo.homeId : jogo.awayId;
    const nomes = (teamId: number | undefined) =>
      (injuries ?? [])
        .filter((i) => teamId != null && i.team_id === teamId)
        .slice(0, 4)
        .map((i) => i.player_name)
        .join(', ');

    penAtivas.forEach((p) => {
      let sub = p.motivo;
      if (p.slug === 'desfalque_proprio' || p.slug === 'desfalque_adversario') {
        const lista = nomes(p.slug === 'desfalque_proprio' ? idDoLado : idDoAdv);
        sub = lista
          ? `Fora: ${lista}.`
          // Não existe "escalação provável": a fonte não publica previsão de
          // escalação em momento nenhum. O que sai perto do jogo é a escalação
          // CONFIRMADA. Ver futebol-escalacao.ts.
          : 'A lista de desfalques deste jogo ainda não saiu: ela entra junto com a escalação confirmada, perto do jogo.';
      }
      out.push({ t: `Penalidade: ${p.label.toLowerCase()}`, sub });
    });
    return out;
  }, [requerContratoMotivos, valPrincipal, penAtivas, injuries, ladoPrincipal, jogo.homeId, jogo.awayId]);
  const motivosContra = contratoMotivos
    ? motivosDoContrato(contratoMotivos.contra)
    : requerContratoMotivos
      ? { premissas: [], extras: [] }
      : { premissas: naoAtingiuOCorte, extras: contras };

  // Zero motivo listado a favor. Alimenta o veredito, para ele não afirmar um
  // cenário que a aba ao lado não consegue mostrar.
  const semMotivosAFavor = motivosFavor.premissas.length + motivosFavor.extras.length === 0;

  // O veredito em uma frase, sem inventar número.
  const veredito = useMemo(() => {
    const lbl = labelDe(principal);
    if (fim) {
      const r = placar && principal ? settleFutebol(principal, placar.home, placar.away) : null;
      return r ? `O mapa apontava ${lbl}: ${resultBadge(r).label.toLowerCase()}.` : `Jogo encerrado.`;
    }
    if (valPrincipal) {
      // Sem nenhum motivo listado, o veredito não afirma cenário. Acontece na
      // janela da virada: a nota legacy podia vir do preço, e o contrato antigo
      // devolvia só os componentes de preço em A favor — que a tela não mostra
      // mais. Prometer "o cenário está bem a favor" acima de uma aba vazia é a
      // tela se contradizendo.
      if (semMotivosAFavor) return `${lbl} está publicada, mas o cenário do jogo não foi detalhado aqui.`;
      if (ehFaixaAlta(valPrincipal.faixa)) return `O cenário do jogo está bem a favor de ${lbl}.`;
      if (ehDestaque(valPrincipal.faixa)) return `${lbl} tem parte do cenário a favor: leitura parcial.`;
      return `Pouco do cenário sustenta ${lbl}: entra como consulta, não como aposta.`;
    }
    if (cotacaoPrincipal.estado === 'cotada') {
      return `${lbl} tem cotação, mas ficou fora dos filtros de oportunidade.`;
    }
    const n = principal ? contaQueValem(principal) : 0;
    if (n >= PORTA_PREMISSAS) return `O jogo aponta para ${lbl}, mas falta o preço: as odds entram perto do jogo.`;
    return `O jogo não sustenta esta saída.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal, valPrincipal, cotacaoPrincipal.estado, fim, mercado.slug, placar, semMotivosAFavor]);

  // Distribuição de gols: só no mercado de gols, cortada pela linha selecionada.
  const dist = useMemo(() => {
    if (mercado.slug !== 'goals_over_under' || !tendencies?.lambdas || linha == null) return null;
    const lambda = tendencies.lambdas.lh + tendencies.lambdas.la;
    const fact = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
    const pois = (k: number) => (Math.exp(-lambda) * Math.pow(lambda, k)) / fact(k);
    const bars = [0, 1, 2, 3].map((k) => ({ k: String(k), kn: k, p: pois(k) }));
    bars.push({ k: '4+', kn: 4, p: Math.max(0, 1 - bars.reduce((s, b) => s + b.p, 0)) });
    const max = Math.max(...bars.map((b) => b.p), 0.001);
    return {
      bars: bars.map((b) => ({ ...b, h: `${(b.p / max) * 100}%`, pct: `${Math.round(b.p * 100)}%`, menos: b.kn < linha })),
      divisor: `${((Math.floor(linha) + 1) / bars.length) * 100}%`,
      lambda: lambda.toFixed(1).replace('.', ','),
    };
  }, [mercado.slug, tendencies, linha]);

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-16 w-full bg-canvas-2 rounded-rebrand-md" />
        <Skeleton className="h-96 w-full rounded-[24px]" style={{ background: 'var(--canvas-2)' }} />
      </div>
    );
  }

  const pickAtual = labelDe(principal);
  const linhaExibida = linhaDaSaida({
    market: mercado.slug,
    outcome: principal?.outcome ?? 'Home',
    line_value: linha,
  });
  const cotacaoDoDraft = cotacaoPrincipal.estado === 'oportunidade'
    ? { bestOdd: cotacaoPrincipal.odd, oddKind: 'melhor' as const }
    : cotacaoPrincipal.estado === 'cotada'
      ? { bestOdd: cotacaoPrincipal.odd, oddKind: 'referencia' as const }
      : { bestOdd: null, oddKind: 'sem_cotacao' as const };

  const cta =
    principal && !jogoJaComecou && !locked ? (
      <RegistrarApostaCTA
        draft={{
          homeName: jogo.home,
          awayName: jogo.away,
          competition: jogo.competition,
          kickoffUtc: jogo.kickoffUtc,
          market: principal.market,
          outcome: principal.outcome,
          lineValue: principal.line_value,
          ...cotacaoDoDraft,
        }}
        variant="ambar"
        rotulo="Adicionar à gestão"
      />
    ) : null;

  /**
   * Quantas premissas sustentam cada linha, no lado escolhido. É o que a régua
   * mostra nas paradas: onde a leitura se sustenta e onde ela some.
   */
  const forcaPorLinha = new Map<number, number>();
  if (ehLinha && principal) {
    paradas.forEach((p) => {
      const r = doMercado.find(
        (x) => x.outcome === principal.outcome && x.line_value != null && Math.abs(x.line_value - p) < 0.001,
      );
      forcaPorLinha.set(p, r ? contaQueValem(r) : 0);
    });
  }

  /** As saídas fixas do 1X2, ambos marcam e dupla chance (mercado sem régua). */
  const paradasUI = ehLinha
    ? []
    : doMercado.map((o) => {
        const val = valueDoCandidato(valueRows, o);
        const n = contaQueValem(o);
        return {
          chave: o.outcome,
          rotulo: outcomeLabel(o, jogo.home, jogo.away),
          ativa: o.outcome === (saida ?? candidatoInicialDoMercado?.outcome),
          passa: val ? ehDestaque(val.faixa) : n >= PORTA_PREMISSAS,
          res: placar ? settleFutebol(o, placar.home, placar.away) : null,
          escolher: () => setSaida(o.outcome),
        };
      });

  const resPrincipal =
    placar && principal
      ? settleFutebol(principal, placar.home, placar.away)
      : null;

  return (
    <div
      className="grid xl:grid-cols-[300px_1fr] xl:grid-rows-[auto_1fr] bg-white rounded-[24px] overflow-hidden"
      style={{ border: '1px solid #ded2b6' }}
      data-tour="fut-jogo-mapa"
    >
      {/* A coluna dos 5 mercados fica FIXA: clicar em qualquer um troca a folha da
          direita sem sair da página. Antes eram abas no topo, e a comparação entre
          mercados sumia assim que você entrava em um.
          No desktop, mercados e contexto ocupam a coluna da esquerda (linhas 1 e 2)
          e a folha ocupa a direita inteira; no celular a ordem do DOM manda, e é
          por isso que o contexto vem DEPOIS da folha: "como chegam" antes da
          análise empurrava o mercado duas telas para baixo. */}
      <div data-tour="fut-jogo-mercados" className="min-w-0 xl:col-start-1 xl:row-start-1 xl:border-r" style={{ borderColor: '#ded2b6', background: '#fdfbf6' }}>
        <div className="px-5 pt-4 pb-3.5" style={{ borderBottom: '1px solid #f1e9d6' }}>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: '#8d8672' }}>
            {/* Conta o que a VITRINE mostra, não o catálogo: com um mercado
                escondido (#324) o rótulo fixo "Os 5 mercados" mentiria em cima
                de uma lista de quatro. */}
            {resumos.length === 1 ? 'O mercado' : `Os ${resumos.length} mercados`}
          </div>
          <div className="mt-1 text-[11.5px] leading-relaxed" style={{ color: '#6b6350' }}>
            {/* A frase conta só os mercados COTADOS. `passa` também é verdadeiro
                para mercado sem odds, pela porta de premissas, e contar os dois
                juntos afirmaria uma faixa para quem não tem faixa nenhuma. */}
            {resumos.some((r) => r.value)
              ? `${resumos.filter((r) => r.value && r.passa).length} de ${resumos.filter((r) => r.value).length} mercados cotados em faixa Alta ou Média. A barra é o Score; o tracinho marca onde começa a faixa Alta.`
              : mercadosCotados > 0
                ? `${mercadosCotados} de ${resumos.length} mercados têm cotação. Os demais continuam analisados pelas premissas.`
              : `Sem preço ainda: a barra conta as premissas e o tracinho é a porta de ${PORTA_PREMISSAS}.`}
          </div>
        </div>

        {/* No mobile os 5 mercados rolam na horizontal: empilhados, empurravam a
            folha do mercado cinco cards para baixo. */}
        <div className="p-3.5 flex gap-1.5 overflow-x-auto no-scrollbar xl:flex-col xl:overflow-visible">
          {resumos.map((r) => {
            const on = r.mercado.slug === mercado.slug;
            const temScore = r.value != null;
            const leituraCotacao = leituraDaCotacao(
              r.mercado.slug,
              r.candidato.outcome,
              r.candidato.line_value,
              valueRows,
              oddsRows,
            );
            const candidataCotada = leituraCotacao.estado === 'cotada';
            const s = temScore ? r.value!.score : r.nValem;
            const larg = temScore ? `${s}%` : `${Math.min(100, (r.nValem / Math.max(r.totalQueValem, 1)) * 100)}%`;
            // O tracinho marca onde começa a faixa Alta NA ESCALA daquela linha.
            const regua = temScore
              ? `${fronteirasDoScore(r.value!.score_versao).alta}%`
              : `${(PORTA_PREMISSAS / Math.max(r.totalQueValem, 1)) * 100}%`;
            const cor = on ? '#fbbf24' : r.passa ? (temScore && ehFaixaAlta(r.value!.faixa) ? '#0a3d2e' : '#d4a017') : '#c4bda8';
            const pick = outcomeLabel(r.candidato, jogo.home, jogo.away);
            return (
              <button
                key={r.mercado.slug}
                onClick={() => onMercado(r.mercado.slug)}
                className="text-left w-[210px] shrink-0 xl:w-full p-3.5 rounded-[14px] cursor-pointer transition"
                style={{
                  background: on ? '#0a3d2e' : r.passa ? '#fff' : '#fdfbf6',
                  border: `1px ${r.passa || on ? 'solid' : 'dashed'} ${on ? '#0a3d2e' : r.passa ? '#ded2b6' : '#e5d9bd'}`,
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-[13px] truncate"
                    style={{ color: on ? '#fff' : r.passa ? '#1a1d1a' : '#6b6350', fontWeight: r.passa ? 600 : 500 }}
                  >
                    {r.mercado.label}
                  </span>
                  {!candidataCotada && (
                    <span
                      className="tabular-nums text-[18px] font-bold shrink-0"
                      // O corte da Alta vem do `fronteirasDoScore`, na escala em
                      // que a nota foi calculada. Era 60 cravado: acertava por
                      // coincidência, porque 60 é a fronteira nas duas escalas,
                      // e quebraria em silêncio na próxima mudança de número.
                      style={{ color: on ? '#fbbf24' : r.passa ? (temScore && s >= fronteirasDoScore(r.value!.score_versao).alta ? '#0a3d2e' : '#b8870f') : '#8d8672' }}
                    >
                      <Blur active={locked && temScore}>{String(s)}</Blur>
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11.5px] truncate" style={{ color: on ? 'rgba(255,255,255,.6)' : '#8d8672' }}>
                  {pick}
                  {temScore ? (
                    <>
                      {' · '}
                      <Blur active={locked}>{`${Math.round(r.value!.prob_justa_fechamento * 100)}%`}</Blur>
                      {' · '}
                      <Blur active={locked}>{r.value!.best_odd.toFixed(2)}</Blur>
                    </>
                  ) : (
                    leituraCotacao.estado === 'cotada'
                      ? ` · cotada @ ${leituraCotacao.odd.toFixed(2)}`
                      : ' · sem cotação'
                  )}
                </div>
                {!candidataCotada && (
                  <div
                    className="relative mt-2.5 h-1.5 rounded-full"
                    style={{ background: on ? 'rgba(255,255,255,.16)' : '#f1e9d6' }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: larg, background: cor }} />
                    <div
                      className="absolute -top-[3px] -bottom-[3px] w-0"
                      style={{ left: regua, borderLeft: `1px dashed ${on ? 'rgba(255,255,255,.6)' : '#8d8672'}` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* A folha do mercado aberto. */}
      <div data-tour="fut-jogo-folha" className="min-w-0 xl:col-start-2 xl:row-start-1 xl:row-span-2">
        <div className="relative overflow-hidden px-6 md:px-8 py-6" style={{ background: 'linear-gradient(135deg,#0a3d2e,#08321f 60%,#051f12)' }}>
          <div
            className="absolute pointer-events-none"
            style={{ right: -40, top: -90, width: 300, height: 300, borderRadius: 999, background: 'radial-gradient(circle,rgba(251,191,36,.24),transparent 68%)' }}
          />
          {/* Arrastar a régua troca pick, selo e veredito ao mesmo tempo. Sem altura
              reservada, o bloco inteiro saltava a cada parada: o selo Green/Red
              empurrava o título, e o veredito ia de uma para duas linhas. O selo
              subiu para a linha do rótulo, que tem altura fixa, e o pick e o
              veredito ganharam altura mínima. */}
          <div className="relative flex items-end justify-between gap-7 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 min-h-6 md:h-6">
                <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,.45)' }}>
                  Mercado aberto · {mercado.label}
                </span>
                {cotacaoPrincipal.estado === 'cotada' && (
                  <span
                    className="inline-flex shrink-0 items-center min-h-5 px-2.5 py-1 rounded-full whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-[0.08em]"
                    style={{ background: '#dcefe2', color: '#0a3d2e' }}
                  >
                    Cotada · fora dos filtros
                  </span>
                )}
                {cotacaoPrincipal.estado === 'oportunidade' && (
                  <span
                    className="inline-flex shrink-0 items-center min-h-5 px-2.5 py-1 rounded-full whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-[0.08em]"
                    style={{ background: '#fbbf24', color: '#1a1d1a' }}
                  >
                    Oportunidade
                  </span>
                )}
                {cotacaoPrincipal.estado === 'sem_cotacao' && (
                  <span
                    className="inline-flex shrink-0 items-center min-h-5 px-2.5 py-1 rounded-full whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-[0.08em]"
                    style={{ background: '#ede4ce', color: '#6b6350' }}
                  >
                    Sem cotação
                  </span>
                )}
                {resPrincipal && <SeloRes r={resPrincipal} />}
              </div>
              <div className="mt-1.5 text-[28px] md:text-[34px] font-semibold leading-tight tracking-[-0.035em] text-white min-h-[42px] md:min-h-[46px]">
                {pickAtual || '—'}
              </div>
              <div
                className="mt-2 text-[13.5px] leading-relaxed max-w-[560px] min-h-[42px]"
                style={{ color: 'rgba(255,255,255,.78)' }}
              >
                {veredito}
              </div>
            </div>

            {/* Sem `shrink-0`: com quatro colunas fixas, a linha estourava a largura
                no celular e a página inteira ganhava rolagem lateral. */}
            <div className="flex items-end gap-4 md:gap-6 flex-wrap">
              <div className="min-w-[58px]">
                <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Chance</div>
                <div className="tabular-nums text-[22px] font-semibold leading-none mt-1 text-white">
                  {valPrincipal ? <Blur active={locked}>{`${Math.round(valPrincipal.prob_justa_fechamento * 100)}%`}</Blur> : '—'}
                </div>
              </div>
              <div className="min-w-[52px]">
                <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Odd</div>
                <div className="tabular-nums text-[22px] font-semibold leading-none mt-1 text-white">
                  {cotacaoPrincipal.odd != null
                    ? <Blur active={locked}>{cotacaoPrincipal.odd.toFixed(2)}</Blur>
                    : '—'}
                </div>
              </div>
              <div className="min-w-[76px]">
                <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,.45)' }}>Vantagem</div>
                <div
                  className="tabular-nums text-[22px] font-semibold leading-none mt-1"
                  style={{ color: valPrincipal && valPrincipal.edge > 0 ? '#8ee6b0' : 'rgba(255,255,255,.55)' }}
                >
                  {valPrincipal ? (
                    <Blur active={locked}>{`${valPrincipal.edge >= 0 ? '+' : '−'}${Math.abs(valPrincipal.edge * 100).toFixed(1).replace('.', ',')}%`}</Blur>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <div className="text-center pl-6 min-w-[128px]" style={{ borderLeft: '1px solid rgba(255,255,255,.15)' }}>
                <div className="tabular-nums text-[44px] font-bold leading-none tracking-[-0.04em]" style={{ color: '#fbbf24' }}>
                  {valPrincipal ? <Blur active={locked}>{String(valPrincipal.score)}</Blur> : nPrincipal}
                </div>
                <div className="mt-1.5 text-[9.5px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,.5)' }}>
                  {valPrincipal
                    ? `Score · ${rotuloDaFaixa(valPrincipal.faixa)}`
                    : 'premissas a favor'}
                </div>
              </div>
            </div>
          </div>

          {/* A régua de paradas mora no hero: trocar a parada troca o que precisa ser
              verdade, e o Score muda junto. */}
          <div data-tour="fut-jogo-regua" className="relative mt-5 pt-4 flex items-center gap-3.5 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,.15)' }}>
            <span className="text-[9.5px] uppercase tracking-[0.14em] shrink-0" style={{ color: 'rgba(255,255,255,.45)' }}>
              {ehLinha ? 'Linha' : 'Saída'}
            </span>

            {/* O lado da linha é um toggle, não um link: na régua você escolhe QUAL
                linha, aqui de que lado dela está a aposta. Só existe onde o mercado
                tem dois lados na mesma linha (gols e handicap). */}
            {ehLinha && ladoA && ladoB && (
              <div className="flex p-[3px] rounded-full shrink-0" style={{ background: 'rgba(255,255,255,.08)' }}>
                {([['a', ladoA], ['b', ladoB]] as const).map(([k, l]) => {
                  const on = principal === l;
                  return (
                    <button
                      key={k}
                      onClick={() => setLadoSel(k)}
                      className="h-6 px-3 rounded-full border-0 cursor-pointer truncate max-w-[110px]"
                      style={{
                        background: on ? '#fff' : 'transparent',
                        color: on ? '#0a3d2e' : 'rgba(255,255,255,.72)',
                        font: `${on ? 700 : 500} 11.5px Inter,sans-serif`,
                      }}
                    >
                      {mercado.slug === 'goals_over_under'
                        ? l.outcome === 'Under'
                          ? 'Menos'
                          : 'Mais'
                        : l.outcome === 'Home'
                          ? jogo.home
                          : jogo.away}
                    </button>
                  );
                })}
              </div>
            )}

            {ehLinha && paradas.length > 1 ? (
              <>
                {/* O número antes da trilha: com ele depois, no celular a régua
                    quebrava a linha e o valor ficava sozinho, solto embaixo. */}
                <span className="tabular-nums text-[22px] font-bold leading-none shrink-0 min-w-[58px]" style={{ color: '#fbbf24' }}>
                  {linhaExibida != null ? fmtLinha(linhaExibida, ehAH) : '—'}
                </span>
                <ReguaLinhas
                  paradas={paradas}
                  valor={linha}
                  onEscolher={setLinha}
                  rotulo={(v) => fmtLinha(
                    linhaDaSaida({ market: mercado.slug, outcome: principal?.outcome ?? 'Home', line_value: v }) ?? v,
                    ehAH,
                  )}
                  destaque={candidatoInicialDoMercado?.line_value ?? null}
                  forca={forcaPorLinha}
                />
              </>
            ) : (
              <div className="flex-1 min-w-0 flex gap-1.5 flex-wrap">
                {paradasUI.map((p) => (
                  <button
                    key={p.chave}
                    onClick={p.escolher}
                    className="h-7 px-3 rounded-full inline-flex items-center gap-1.5 cursor-pointer border-0 whitespace-nowrap tabular-nums"
                    style={{
                      background: p.ativa ? '#fbbf24' : 'rgba(255,255,255,.08)',
                      color: p.ativa ? '#1a1d1a' : 'rgba(255,255,255,.72)',
                      font: `${p.ativa ? 700 : 500} 12px Inter,sans-serif`,
                      opacity: p.passa || p.ativa ? 1 : 0.5,
                    }}
                  >
                    {p.rotulo}
                    {p.res && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: isHit(p.res) ? '#2f7d50' : p.res === 'push' ? '#8a8f86' : '#be123c' }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            {/* Na régua o botão desce para uma fileira só dele (`basis-full`). Ele só
                existe na parada que tem preço, e dividindo a fileira com a trilha,
                entrar nessa parada encolhia a trilha e sair dela esticava de volta:
                no meio do arrasto a parada debaixo do cursor mudava sozinha. Embaixo
                ele pode aparecer e sumir à vontade, porque a largura da trilha não
                depende dele. Reservar a altura custaria uma faixa vazia nas outras
                17 paradas, que é pior do que a fileira entrar e sair.
                Sem régua (1X2, ambos marcam, dupla chance) não há o que proteger. */}
            {ehLinha && paradas.length > 1 ? cta && <div className="basis-full mt-1">{cta}</div> : cta}
          </div>
        </div>

        {cotacaoPrincipal.estado === 'cotada' && (
          <div
            className="px-6 md:px-8 py-3 text-[12px] leading-relaxed"
            style={{ background: '#edf5ef', borderBottom: '1px solid #cfe4d5', color: '#0a3d2e' }}
          >
            Confirme a cotação na sua casa antes de registrar.
          </div>
        )}

        {mercado.aviso && (
          <div className="px-6 md:px-8 py-3 text-[12px] leading-relaxed" style={{ background: '#fef7df', borderBottom: '1px solid #fde68a', color: '#5a3c00' }}>
            {mercado.aviso}
          </div>
        )}

        {/* Sub-abas em forma de pasta.
            A segunda se chamava "Contra", e o rótulo AFIRMAVA oposição: quem lia
            "1 contra" entendia que existia evidência empurrando para o outro lado.
            Não existe. O que o backend agrupa ali são premissas DO PRÓPRIO LADO
            que não atingiram o corte — num Under 3,5 vieram quatro em favor e uma
            em contra, e o Under tem exatamente cinco premissas (#351). O nome
            passa a ser o do glossário; o contrato do backend não muda. */}
        <div data-tour="fut-jogo-premissas" className="px-6 md:px-8 pt-4 flex items-center gap-2 flex-wrap" style={{ borderBottom: '1px solid #f1e9d6' }}>
          {(
            [
              ['favor', 'A favor', contratoMotivosIndisponivel ? null : motivosFavor.premissas.length + motivosFavor.extras.length],
              ['contra', rotuloEmTitulo('nao_atingiu_o_corte'), contratoMotivosIndisponivel ? null : motivosContra.premissas.length + motivosContra.extras.length],
            ] as const
          ).map(([k, rot, n]) => {
            const on = abaMotivo === k;
            return (
              <button
                key={k}
                onClick={() => setAbaMotivo(k)}
                className="h-[34px] px-3.5 -mb-px inline-flex items-center gap-1.5 cursor-pointer text-[12.5px] font-semibold"
                style={{
                  borderRadius: '9px 9px 0 0',
                  color: on ? '#0a3d2e' : '#5a625a',
                  background: on ? '#fff' : 'transparent',
                  // Lados separados de propósito: misturar `border` com
                  // `borderBottom` faz o React avisar de conflito de shorthand.
                  borderStyle: 'solid',
                  borderColor: on ? '#ded2b6' : 'transparent',
                  borderTopWidth: 1,
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderBottomWidth: 0,
                }}
              >
                {rot}
                <span className="tabular-nums text-[11px] font-bold" style={{ color: on ? '#0a3d2e' : '#8d8672' }}>
                  {n ?? '—'}
                </span>
              </button>
            );
          })}
          <span className="ml-auto pb-2 text-[11.5px] hidden md:block" style={{ color: '#8d8672' }}>
            {ctx.label}
          </span>
        </div>

        {contratoMotivosIndisponivel ? (
          <div className="p-6 md:p-8 text-[13px]" style={{ color: '#8d8672' }}>
            {carregandoContratoMotivos
              ? 'Carregando os motivos desta leitura.'
              : falhaContratoMotivos
                ? 'Os motivos desta leitura estão sendo atualizados. Tente novamente em instantes.'
                : 'Os motivos desta leitura ainda não estão disponíveis.'}
          </div>
        ) : abaMotivo === 'favor' ? (
          <MotivosJogoPorJogo
            mercado={mercado.slug}
            premissas={motivosFavor.premissas}
            modo="favor"
            extras={motivosFavor.extras}
            historico={historico}
            numeros={numeros}
            lado={ladoPrincipal}
            linha={linha}
            saidaLabel={pickAtual}
          />
        ) : (
          <MotivosJogoPorJogo
            mercado={mercado.slug}
            premissas={motivosContra.premissas}
            modo="contra"
            extras={motivosContra.extras}
            historico={historico}
            numeros={numeros}
            lado={ladoPrincipal}
            linha={linha}
            saidaLabel={pickAtual}
          />
        )}

        {/* Leitura de risco do PREÇO. Saiu da aba "Contra" na virada do Score de
            contexto (spec #301): aquela aba é premissa do jogo, e odd de zebra
            ou casa única não é premissa nenhuma — é característica da cotação.
            Mas a informação continua valendo, então desce para o rodapé em vez
            de sumir, ao lado da ressalva de dado faltando.

            O filtro existe pela janela da virada: enquanto o contrato antigo
            estiver no ar, ele ainda manda esses mesmos textos dentro de Contra,
            e sem isto a frase apareceria duas vezes na mesma tela. */}
        {(() => {
          const jaEmContra = new Set(motivosContra.extras.map((e) => e.t));
          const avisosDeCotacao = (valPrincipal?.avisos ?? []).filter((t) => !jaEmContra.has(t));
          return avisosDeCotacao.length > 0 ? (
            <div className="px-6 md:px-8 py-3.5 text-[11.5px] leading-relaxed" style={{ borderTop: '1px solid #f1e9d6', background: '#fdfbf6', color: '#5a625a' }}>
              <span className="font-semibold">Sobre a cotação: </span>
              {avisosDeCotacao.join(' · ')}
            </div>
          ) : null;
        })()}

        {/* Desde quando esta saída está publicada. Responde a pergunta que o
            usuário faz de verdade — "desde quando isso está aqui?" — e que a
            tela respondia com a janela de odds, que é outra coisa (issue #300).

            Preso a valPrincipal de propósito. A RPC devolve a corrida da última
            versão que o snapshot tem, inclusive de chave já retirada do board;
            é o que faz o campo continuar respondendo em jogo encerrado, que lê
            a foto do apito. Sem esta trava, arrastar a régua até uma parada sem
            cotação mostraria "disponível desde" de algo que não está publicado. */}
        {valPrincipal && rotuloDisponivelDesde(disponivelDesdeDaSaida(disponibilidade, principal)) && (
          <div className="px-6 md:px-8 py-3.5 text-[11.5px] leading-relaxed" style={{ borderTop: '1px solid #f1e9d6', background: '#fdfbf6', color: '#5a625a' }}>
            <span className="font-semibold">Disponível desde: </span>
            {rotuloDisponivelDesde(disponivelDesdeDaSaida(disponibilidade, principal))}
          </div>
        )}

        {/* Ressalva de informação faltando. Fica AQUI, no rodapé, e não na aba
            "Contra" de propósito: aquela aba lista o que foi checado e não
            bateu; isto é o que nem deu para checar. Juntar as duas faria a
            tela dizer que a aposta é pior, quando o que existe para dizer é que
            sabemos menos sobre ela. Ver futebol-sem-dado.ts e a ADR 0003. */}
        {(() => {
          const semDado = avisoSemDado(valPrincipal?.premissas_sem_dado);
          return semDado ? (
            <div className="px-6 md:px-8 py-3.5 text-[11.5px] leading-relaxed" style={{ borderTop: '1px solid #f1e9d6', background: '#fdfbf6', color: '#5a625a' }}>
              {semDado}
            </div>
          ) : null;
        })()}

        <div className="px-6 md:px-8 py-3.5 text-[11px] leading-relaxed" style={{ borderTop: '1px solid #f1e9d6', background: '#fdfbf6', color: '#8d8672' }}>
          {ehLinha
            ? 'Cada parada da régua tem o seu conjunto de premissas: trocar a linha muda o que precisa ser verdade.'
            : 'Cada saída do mercado tem o seu conjunto de premissas.'}{' '}
          {ate ? `Números da temporada até ${ate}.` : ''}
        </div>
      </div>

      {/* Contexto do confronto: no desktop desce na coluna da esquerda, embaixo
          dos mercados; no celular vem DEPOIS da folha, senão "como chegam"
          empurrava a análise duas telas para baixo. */}
      <div className="min-w-0 xl:col-start-1 xl:row-start-2 xl:border-r" style={{ borderColor: '#ded2b6', background: '#fdfbf6' }}>
          {barras.length > 0 && (
            <div className="px-5 py-4" style={{ borderTop: '1px solid #f1e9d6' }}>
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-3" style={{ color: '#8d8672' }}>
                Como chegam
              </div>
              <div className="flex flex-col gap-3.5">
                {barras.map((x) => (
                  <div key={x.l}>
                    <div className="flex justify-between items-baseline mb-1.5 tabular-nums">
                      <span className="text-[13px] font-semibold" style={{ color: '#0a3d2e' }}>{x.a}</span>
                      <span className="text-[10.5px] font-medium" style={{ color: '#8d8672' }}>{x.l}</span>
                      <span className="text-[13px] font-semibold" style={{ color: '#6b6350' }}>{x.b}</span>
                    </div>
                    <div className="flex gap-[3px] h-1.5">
                      <div className="flex-1 flex justify-end overflow-hidden" style={{ background: '#f1e9d6', borderRadius: '999px 0 0 999px' }}>
                        <div style={{ width: x.wa, background: '#0a3d2e' }} />
                      </div>
                      <div className="flex-1 overflow-hidden" style={{ background: '#f1e9d6', borderRadius: '0 999px 999px 0' }}>
                        <div style={{ width: x.wb, height: '100%', background: '#c4bda8' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dist && (
            <div className="px-5 py-4" style={{ borderTop: '1px solid #f1e9d6' }}>
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: '#8d8672' }}>
                Onde a linha corta
              </div>
              <p className="text-[11px] leading-relaxed mt-1 mb-3" style={{ color: '#6b6350' }}>
                Quantos gols o modelo espera, e de que lado da linha cada cenário cai.
              </p>
              <div className="relative pb-1">
                <div className="flex items-end gap-1.5 h-[84px]">
                  {dist.bars.map((b) => (
                    <div key={b.k} className="flex-1 flex flex-col items-center justify-end h-full">
                      <span className="tabular-nums text-[9.5px] font-semibold mb-1" style={{ color: b.menos ? '#0a3d2e' : '#8d8672' }}>
                        {b.pct}
                      </span>
                      <div className="w-full flex items-end flex-1 min-h-0">
                        <div className="w-full rounded-t" style={{ height: b.h, background: b.menos ? '#0a3d2e' : '#c9cec6' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {dist.bars.map((b) => (
                    <span key={b.k} className="flex-1 text-center tabular-nums text-[10px] font-semibold" style={{ color: b.menos ? '#0a3d2e' : '#8d8672' }}>
                      {b.k}
                    </span>
                  ))}
                </div>
                <div className="absolute -top-1 bottom-4 w-0 opacity-35" style={{ left: dist.divisor, borderLeft: '2px dashed #1a1d1a' }} />
              </div>
              <p className="text-[10.5px] leading-relaxed mt-2" style={{ color: '#8d8672' }}>
                Média esperada de {dist.lambda} gols.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
