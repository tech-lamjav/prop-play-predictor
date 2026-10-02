// ============================================================
// futebol-score.ts — apresentação do Score (motor é backend)
// ============================================================
import { linhaDaSaida, type Saida } from '@/utils/futebol-saida';
import { fmtLinhaAnalisada } from '@/utils/formato';
import { preencher, type CopyComParametros } from '@/utils/futebol-copy';
// O estado do jogo se decide com o RELÓGIO e o status juntos — as três funções
// vêm do mesmo lugar que as telas usam, para não nascer uma segunda definição
// de 'acabou' aqui dentro.
import { hasKickoffPassed, isFinished, isLive } from '@/utils/futebol-datas';
// O Score, edge, premissas, evidências e avisos vêm prontos da
// fact_value_opportunities (pipeline dbt no BigQuery). Aqui só ROTULAMOS
// (mercado, pick com linha) e ajudamos a ranquear/agrupar. Nada de cálculo.
// Mercados: Resultado (1X2), Gols (Over/Under), Handicap asiático, Ambos marcam e Dupla chance.
// ============================================================
import type { FutebolFixtureValueRow, FutebolValueBoardRow } from '@/services/futebol-data.service';
import type { FutebolScoreVersion } from '@/services/futebol-score-contract';
// Reexportado porque quem lida com escala já importa `fronteirasDoScore` e
// `versaoDaJanela` daqui, e obrigar um segundo import do contrato só para o tipo
// espalha o conhecimento de onde ele mora. Faltava, e ninguém viu: o typecheck
// da raiz compila zero arquivo (`files: []`) e o CI não roda tsc.
export type { FutebolScoreVersion };

export type Faixa = 'alta' | 'media' | 'baixa';

/** Normaliza a faixa do backend ('Alta'|'Média'|'Baixa') para tom de UI. */
export function faixaTone(faixa: string): Faixa {
  const f = (faixa || '').toLowerCase();
  if (f.startsWith('alta')) return 'alta';
  if (f.startsWith('m')) return 'media';
  return 'baixa';
}

/**
 * A palavra de cada faixa. Fonte única: o catálogo em português é gerado daqui.
 */
export const COPY_DA_FAIXA: Record<Faixa, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

/** Palavra da faixa em PT (normalizada). */
export function faixaWord(faixa: string): string {
  return COPY_DA_FAIXA[faixaTone(faixa)];
}

/** A chave de idioma da palavra da faixa. */
export function chaveDaPalavraDaFaixa(faixa: string): string {
  return `faixa.palavra.${faixaTone(faixa)}`;
}

/** Classes do selo de Score por faixa: Alta=forest preenchido · Média=âmbar tint · Baixa=cinza. */
export function faixaBadgeCls(faixa: string): string {
  switch (faixaTone(faixa)) {
    case 'alta': return 'bg-forest text-canvas';
    case 'media': return 'bg-amber/15 text-amber-2 border border-amber/40';
    default: return 'bg-canvas-2 text-ink-3 border border-line';
  }
}

/** Cor da borda-esquerda (color-spine) da linha/card por faixa. */
export function faixaSpineCls(faixa: string): string {
  switch (faixaTone(faixa)) {
    case 'alta': return 'border-l-forest';
    case 'media': return 'border-l-amber';
    default: return 'border-l-line-2';
  }
}

/** 1ª evidência (o "por quê" curto) pra mostrar na lista; vazio se não houver. */
export function topEvidencia(evidencias: string[] | null | undefined): string | null {
  return evidencias && evidencias.length ? evidencias[0] : null;
}

/**
 * O nome longo de cada mercado. Fonte única do texto em português.
 *
 * Mercado que não está aqui sai como o slug veio — é dado que o catálogo não
 * conhece, e inventar nome esconderia isso.
 */
export const COPY_DO_MERCADO_LONGO: Record<string, string> = {
  match_winner: 'Vencedor (1X2)',
  goals_over_under: 'Gols (Over/Under)',
  asian_handicap: 'Handicap asiático',
  btts: 'Ambos marcam',
  double_chance: 'Dupla chance',
};

/** O nome curto de cada mercado. Fonte única do texto em português. */
export const COPY_DO_MERCADO_CURTO: Record<string, string> = {
  match_winner: 'Resultado',
  goals_over_under: 'Gols',
  asian_handicap: 'Handicap',
  btts: 'Ambos marcam',
  double_chance: 'Dupla chance',
};

/** Nome do mercado em PT. */
export function marketLabel(market: string): string {
  return COPY_DO_MERCADO_LONGO[market] ?? market;
}

/**
 * Nome curto do mercado, para etiqueta em caixa alta na lista e no painel da
 * agenda. "Gols (Over/Under)" em 9px com letter-spacing vira uma tira de ruído.
 */
export function marketShort(market: string): string {
  return COPY_DO_MERCADO_CURTO[market] ?? market;
}

/**
 * A chave do nome longo do mercado, ou `null` quando o catálogo não conhece o
 * mercado.
 *
 * `null` e não uma chave inventada: sem entrada no catálogo a tela mostra o slug,
 * que é exatamente o que ela mostrava antes. Uma chave que não existe faria a
 * tela mostrar o CÓDIGO DA CHAVE, que é pior que o slug.
 */
export function chaveDoMercadoLongo(market: string): string | null {
  return market in COPY_DO_MERCADO_LONGO ? `mercado.longo.${market}` : null;
}

/** A chave do nome curto do mercado. `null` pelo mesmo motivo do longo. */
export function chaveDoMercadoCurto(market: string): string | null {
  return market in COPY_DO_MERCADO_CURTO ? `mercado.curto.${market}` : null;
}

/** Linha do handicap com sinal e vírgula decimal (ex.: -1,5 / +1,5). */
function fmtHandicapLine(line: number): string {
  const sign = line > 0 ? '+' : line < 0 ? '−' : '';
  return `${sign}${fmtLinhaAnalisada(Math.abs(line))}`;
}

/**
 * Os moldes do rótulo da aposta, por identificador. Fonte única do português.
 *
 * ⚠️ Família SEPARADA dos moldes de `outcomeLabel` (`saida.*` em
 * `futebol-premissas.ts`), e não é descuido: os dois rótulos discordam em
 * português de propósito — a Dupla chance X2 é "Empate ou Fulano" aqui e
 * "Fulano ou empate" lá, e o Resultado é o nome do time aqui e "Vitória do
 * Fulano" lá. Uma chave só para os dois mudaria o português de um deles.
 */
export const COPY_DO_PICK = {
  over: 'Mais de {{linha}} gols',
  under: 'Menos de {{linha}} gols',
  handicap: '{{time}} {{linha}}',
  time: '{{time}}',
  // "Sim" e "Não" sozinhos não são aposta nenhuma: na agenda e no resumo do
  // dia o rótulo aparece SEM o nome do mercado ao lado, e a linha ficava
  // "Náutico × Botafogo — Sim". Por isso o rótulo carrega o mercado junto.
  //
  // O nome é o DA CASA DE APOSTAS, e não uma descrição do que acontece em
  // campo. Uma tentativa anterior descreveu — "Os dois marcam" / "Um dos dois
  // não marca" — e ficou mais preciso e menos reconhecível: quem aposta
  // procura "Ambos marcam" na casa, e é assim que a DM do Telegram já
  // escreve. Duas grafias para a mesma aposta é como o produto passa a
  // parecer dois produtos.
  bttsSim: 'Ambos marcam: Sim',
  bttsNao: 'Ambos marcam: Não',
  // 1X = mandante ou empate · X2 = empate ou visitante (aposta de proteção)
  casaOuEmpate: '{{time}} ou empate',
  empateOuFora: 'Empate ou {{time}}',
  empate: 'Empate',
  cru: '{{outcome}}',
} as const;

/** O identificador de um molde de rótulo de aposta. */
export type CopyDoPick = keyof typeof COPY_DO_PICK;

/** A chave e os parâmetros do outcome do 1X2, sem palavra de idioma dentro. */
export function copyDoOutcome(
  outcome: string,
  homeName: string,
  awayName: string,
): CopyComParametros {
  switch (outcome) {
    case 'Home': return { chave: 'pick.time', params: { time: homeName } };
    case 'Away': return { chave: 'pick.time', params: { time: awayName } };
    case 'Draw': return { chave: 'pick.empate' };
    default: return { chave: 'pick.cru', params: { outcome } };
  }
}

/** Outcome do 1X2 em PT. */
export function outcomePt(outcome: string, homeName: string, awayName: string): string {
  return pickEmPortugues(copyDoOutcome(outcome, homeName, awayName));
}

/** A chave e os parâmetros do rótulo da aposta, sem palavra de idioma dentro. */
export function copyDoPick(s: Saida, homeName: string, awayName: string): CopyComParametros {
  const { market, outcome, line_value: line } = s;
  if (market === 'goals_over_under') {
    const linha = line != null ? fmtLinhaAnalisada(line) : '';
    return { chave: outcome === 'Over' ? 'pick.over' : 'pick.under', params: { linha } };
  }
  if (market === 'asian_handicap') {
    const time = outcome === 'Home' ? homeName : awayName;
    const sideLine = linhaDaSaida(s);
    return sideLine == null
      ? { chave: 'pick.time', params: { time } }
      : { chave: 'pick.handicap', params: { time, linha: fmtHandicapLine(sideLine) } };
  }
  if (market === 'btts') {
    return { chave: outcome === 'Yes' ? 'pick.bttsSim' : 'pick.bttsNao' };
  }
  if (market === 'double_chance') {
    return outcome === '1X'
      ? { chave: 'pick.casaOuEmpate', params: { time: homeName } }
      : { chave: 'pick.empateOuFora', params: { time: awayName } };
  }
  return copyDoOutcome(outcome, homeName, awayName);
}

/** Preenche um molde de pick com o texto em português. */
function pickEmPortugues({ chave, params }: CopyComParametros): string {
  return preencher(COPY_DO_PICK[chave.slice('pick.'.length) as CopyDoPick], params);
}

/** Rótulo da aposta (pick), por mercado — inclui a linha no Over/Under. */
export function pickLabel(s: Saida, homeName: string, awayName: string): string {
  return pickEmPortugues(copyDoPick(s, homeName, awayName));
}

/** Frequência mastigada: "se paga em ~X de 10". */
export function freqEmDez(odd: number): number {
  return Math.max(1, Math.round(10 / odd));
}

export const fmtPctScore = (p: number) => `${Math.round(p * 100)}%`;

/** "Chance" (%) a partir da prob justa devigada (0..1). null se ausente. */
export function chancePct(prob: number | null | undefined): number | null {
  return typeof prob === 'number' && isFinite(prob) && prob > 0 ? Math.round(prob * 100) : null;
}

/** Melhor outcome do jogo (maior Score). */
export function bestOf(rows: FutebolFixtureValueRow[]): FutebolFixtureValueRow | null {
  return rows.reduce<FutebolFixtureValueRow | null>((b, r) => (b == null || r.score > b.score ? r : b), null);
}

/**
 * Fronteiras do Score de contexto (spec #301). As duas pertencem à faixa de
 * cima: 30 é Média, 60 é Alta.
 *
 * Elas existem aqui para a LEGENDA declarar o número certo, e para mais nada.
 * Quem classifica é o backend: a faixa chega pronta na resposta, e o front que
 * recalcula é o front que discorda da metodologia sem saber. Por isso estes
 * números têm de ser os MESMOS do `CASE` das faixas no mart — se divergirem, a
 * legenda mente em cima de um rótulo correto.
 *
 * ⚠️ Eram 25 e 55, medidos pela #107. Viraram 30 e 60 por DECISÃO DE PRODUTO em
 * 01/09/2026, registrada na `analytics-engineering#109`, e não por leitura de
 * evidência: a #107 concluiu que nenhum par da grade discrimina — os oito
 * passam nas restrições de forma e nenhum separa Alta de Baixa além de um
 * erro-padrão. O 30/60 está na mesma grade medida, então não é número novo.
 *
 * O que ele compra, contra o 25/55: a faixa Alta deixa de ser a segunda melhor
 * e passa a ser a melhor (ROI −3,6 contra −4,6), e o board padrão encolhe de
 * 63,5% para 52,8% do total. O que ele não conserta: a Média segue sendo o
 * fundo, igual ao 25/55 — faixa é rótulo, não porta.
 */
export const FAIXA_MEDIA_MIN = 30;
export const FAIXA_ALTA_MIN = 60;

/**
 * As fronteiras da escala em que a nota foi calculada.
 *
 * Durante a janela da virada o board ainda chega em `legacy`, e anunciar 55+ ao
 * lado de uma nota legacy de 57 classificaria errado na cara do usuário: ela é
 * Média naquela escala. A versão não aparece na tela, mas decide o número que
 * a legenda mostra.
 */
export function fronteirasDoScore(versao: FutebolScoreVersion): { media: number; alta: number } {
  return versao === 'contexto_v1'
    ? { media: FAIXA_MEDIA_MIN, alta: FAIXA_ALTA_MIN }
    : { media: 40, alta: 60 };
}

/**
 * A escala de uma janela da tela.
 *
 * `indefinida` cobre os dois casos em que não dá para afirmar um corte: a janela
 * mistura as duas escalas (acontece no dia da virada, quando a foto do apito
 * ainda é legacy e o board já é contexto_v1), ou não há linha nenhuma que
 * declare a sua escala.
 */
export type VersaoDaJanela = FutebolScoreVersion | 'indefinida';

/**
 * Só vota quem declara a escala. Linha sem o campo — a oportunidade registrada,
 * que vem de uma tabela que nunca guardou versão — se abstém, em vez de contar
 * como legacy: contando, quase todo dia teria uma e a legenda ficaria sem
 * números para sempre, não só na virada.
 */
export function versaoDaJanela(
  linhas: readonly { score_versao?: FutebolScoreVersion }[],
): VersaoDaJanela {
  let temLegacy = false;
  let temContexto = false;
  for (const l of linhas) {
    if (l.score_versao === 'contexto_v1') temContexto = true;
    else if (l.score_versao === 'legacy') temLegacy = true;
  }
  if (temContexto && !temLegacy) return 'contexto_v1';
  if (temLegacy && !temContexto) return 'legacy';
  return 'indefinida';
}

/**
 * A escala em que a tela deve LER uma janela, incluindo o caso de a janela não
 * declarar nenhuma.
 *
 * `indefinida` — janela vazia, mista, ou só de oportunidade registrada — resolve
 * na escala que o produto publica hoje. Cada tela resolvia isso por conta
 * própria, e as duas caíam em `legacy`; a justificativa escrita era a inferência
 * por forma do contrato antigo, que a contração matou (#310).
 *
 * Com ela morta, o padrão virou defeito: dia sem oportunidade publicada é janela
 * vazia, e a tela passava a explicar o Score pela fórmula aposentada — "junta o
 * cenário com o quanto a odd paga acima do risco". O preço saiu do Score na
 * virada de 03/09.
 *
 * `legacy` continua sendo herdado quando a janela é mesmo antiga: é o caso do
 * histórico point-in-time, e ali acompanhar é o certo.
 */
export function escalaDeExibicao(
  linhas: readonly { score_versao?: FutebolScoreVersion }[],
): FutebolScoreVersion {
  return versaoDaJanela(linhas) === 'legacy' ? 'legacy' : 'contexto_v1';
}

/**
 * As três faixas, na ordem em que a legenda as apresenta.
 *
 * Numa janela indefinida o selo sai: ou as duas escalas convivem e um número
 * descreveria errado metade da lista, ou não há linha nenhuma declarando escala
 * e o número seria chute. As três faixas seguem explicadas em palavras, que
 * valem nos dois casos.
 */
export type OpcaoDeFaixa = { tone: Faixa; rotulo: string; selo: string | null };

export function opcoesDeFaixa(
  versao: VersaoDaJanela,
): OpcaoDeFaixa[] {
  // O `rotulo` sai do MESMO mapa de `faixaWord`, e não de três literais
  // repetidos: a palavra da faixa tem uma fonte só, e é dela que o catálogo de
  // idioma é gerado. Quem desenha a legenda em espanhol pede por `tone`, que é
  // identificador — ver `chaveDaPalavraDaFaixa`.
  if (versao === 'indefinida') {
    return [
      { tone: 'alta', rotulo: COPY_DA_FAIXA.alta, selo: null },
      { tone: 'media', rotulo: COPY_DA_FAIXA.media, selo: null },
      { tone: 'baixa', rotulo: COPY_DA_FAIXA.baixa, selo: null },
    ];
  }
  const { media, alta } = fronteirasDoScore(versao);
  return [
    { tone: 'alta', rotulo: COPY_DA_FAIXA.alta, selo: `${alta}+` },
    { tone: 'media', rotulo: COPY_DA_FAIXA.media, selo: `${media}+` },
    { tone: 'baixa', rotulo: COPY_DA_FAIXA.baixa, selo: `<${media}` },
  ];
}

/** Seleção múltipla da tela de oportunidades: começa nas faixas publicáveis. */
export const FAIXAS_FILTRO_PADRAO: readonly Faixa[] = ['alta', 'media'];

/**
 * O filtro de faixa do painel, em seleção múltipla.
 *
 * Sem faixa guardada é a oportunidade REGISTRADA de antes da migration 091:
 * ela foi enviada no daily, ou seja, estava acima do corte no dia. Esconder do
 * padrão apagaria da lista uma oportunidade que existiu de verdade, então ela
 * entra sempre que Alta E Média estão as duas selecionadas — aí a lista não
 * afirma qual das duas ela era. Basta uma delas ficar de fora e a seleção passa
 * a afirmar uma faixa: com só Alta marcada, mostrá-la seria dizer que era Alta,
 * e isso o dado não sustenta. Por isso ela some de qualquer seleção que aponte
 * uma faixa só.
 */
export function passaNoFiltroDeFaixas(
  selecionadas: readonly Faixa[],
  faixa: string | null | undefined,
): boolean {
  if (faixa == null) return selecionadas.includes('alta') && selecionadas.includes('media');
  return selecionadas.includes(faixaTone(faixa));
}


/**
 * A faixa em palavras, para o selo do Score. Existia em três cópias, cada uma
 * comparando o número contra 60 e 40 por conta própria — e era esse trio que
 * classificaria errado assim que a escala mudasse.
 */
export function rotuloDaFaixa(faixa: string | null | undefined): string {
  return COPY_DO_ROTULO_DA_FAIXA[seloDoRotuloDaFaixa(faixa)];
}

/** O selo do rótulo da faixa, como identificador. `sem` é a faixa ausente. */
export type SeloDoRotuloDaFaixa = Faixa | 'sem';

/** A régua do rótulo da faixa, separada da palavra. */
export function seloDoRotuloDaFaixa(faixa: string | null | undefined): SeloDoRotuloDaFaixa {
  return faixa == null ? 'sem' : faixaTone(faixa);
}

/** O rótulo de cada faixa. Fonte única do texto em português. */
export const COPY_DO_ROTULO_DA_FAIXA: Record<SeloDoRotuloDaFaixa, string> = {
  sem: 'sem faixa',
  alta: 'faixa alta',
  media: 'faixa média',
  baixa: 'faixa baixa',
};

/** A chave de idioma do rótulo da faixa. */
export function chaveDoRotuloDaFaixa(faixa: string | null | undefined): string {
  return `faixa.rotulo.${seloDoRotuloDaFaixa(faixa)}`;
}

/** A linha está na faixa de destaque do painel (Alta ou Média). */
export function ehDestaque(faixa: string | null | undefined): boolean {
  return faixa != null && faixaTone(faixa) !== 'baixa';
}

/** A linha está na faixa Alta. */
export function ehFaixaAlta(faixa: string | null | undefined): boolean {
  return faixa != null && faixaTone(faixa) === 'alta';
}

// Board: melhor oportunidade por fixture.
export interface BoardFixture {
  fixtureId: number;
  best: FutebolValueBoardRow;
  all: FutebolValueBoardRow[];
}

export function groupBoardByFixture(rows: FutebolValueBoardRow[]): BoardFixture[] {
  const m = new Map<number, FutebolValueBoardRow[]>();
  for (const r of rows) {
    const arr = m.get(r.fixture_id);
    if (arr) arr.push(r); else m.set(r.fixture_id, [r]);
  }
  // `score` nulo NAO e comparavel: `r.score > b.score` com null e sempre falso,
  // entao o `best` virava a primeira linha do jogo, arbitraria, e a ordenacao
  // devolvia NaN. Isso so nao aparecia porque a home filtra antes (comNumeros);
  // a tela de Jogos nao filtra, e passava linha BLOQUEADA como "melhor leitura"
  // para o painel. Sem nota, a linha perde para qualquer linha com nota, e
  // empate entre nulas mantem a primeira.
  const nota = (r: FutebolValueBoardRow) => (r.score == null ? -Infinity : r.score);
  const out: BoardFixture[] = [];
  for (const [fixtureId, all] of m) {
    const best = all.reduce((b, r) => (nota(r) > nota(b) ? r : b), all[0]);
    out.push({ fixtureId, best, all });
  }
  return out.sort((a, b) => nota(b.best) - nota(a.best));
}


/**
 * Ordem da faixa para ranquear a lista. Sem faixa vai para o fim: não dá para
 * colocar numa banda a linha que não declara nenhuma.
 */
export function ordemDaFaixa(faixa: string | null | undefined): number {
  if (faixa == null) return 3;
  switch (faixaTone(faixa)) {
    case 'alta': return 0;
    case 'media': return 1;
    default: return 2;
  }
}

/**
 * Ranqueia por FAIXA e só depois por Score.
 *
 * A ordenação era só pelo Score, e isso vira comparação entre escalas no dia da
 * virada: um 46 legacy ao lado de um 46 de contexto não medem a mesma coisa. A
 * faixa é comparável, porque cada escala tem a sua fronteira e as duas produzem
 * as mesmas três palavras. Dentro da faixa o Score continua desempatando.
 */
export function compararOportunidades(
  a: { faixa: string | null; score: number | null },
  b: { faixa: string | null; score: number | null },
): number {
  // Sem Score vem primeiro: é a oportunidade registrada de antes da migration
  // 091, que foi enviada no daily e portanto estava entre as melhores do dia —
  // o número daquele instante é que não foi guardado. A promoção olha o Score, e
  // não a faixa, para não empurrar ao topo uma linha que tem nota mas não tem
  // banda declarada.
  const aSemNota = a.score == null;
  const bSemNota = b.score == null;
  if (aSemNota !== bSemNota) return aSemNota ? -1 : 1;
  if (aSemNota && bSemNota) return 0;

  const porFaixa = ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa);
  if (porFaixa !== 0) return porFaixa;
  return (b.score as number) - (a.score as number);
}

/**
 * O estado do jogo, para o filtro do painel.
 *
 * Substitui o antigo botão "Só jogos em aberto", que era um interruptor: ligado
 * mostrava o que ainda não começou, desligado mostrava tudo. Quem queria ver os
 * encerrados do dia — para conferir como as leituras fecharam — não tinha o que
 * apertar, e quem queria acompanhar o que está rolando agora também não.
 *
 * ⚠️ QUEM MANDA É O RELÓGIO, não o status. O `status_short` vem do espelho e
 * atrasa: jogo que já apitou segue em `NS` por alguns minutos. É a mesma razão
 * pela qual `hasKickoffPassed` existe, e a mesma regra que o filtro antigo já
 * usava — "em aberto" nunca foi "status diz que não começou", e sim "o apito
 * ainda não soou".
 *
 * A consequência é que "ao vivo" aqui significa COMEÇOU E NÃO ACABOU, e não
 * "a API disse que a bola está rolando". Jogo adiado depois do horário marcado
 * cai nesse balaio, porque o painel não recebe os status de adiamento (PST,
 * CANC, SUSP) em lugar nenhum hoje — o board só publica linha de jogo com odds
 * coletadas. Se um dia esses status chegarem, é aqui que eles entram, e não em
 * cada tela.
 */
export type EstadoDoJogo = 'aberto' | 'ao_vivo' | 'encerrado';

export const ESTADOS_DO_JOGO: readonly EstadoDoJogo[] = ['aberto', 'ao_vivo', 'encerrado'];

export function estadoDoJogo(
  status: string | null | undefined,
  kickoffUtc: string | null | undefined,
  agora: Date,
): EstadoDoJogo {
  if (isFinished(status)) return 'encerrado';
  if (isLive(status)) return 'ao_vivo';
  return hasKickoffPassed(kickoffUtc, agora) ? 'ao_vivo' : 'aberto';
}

/**
 * Lista vazia esconde tudo, e isso é decisão de produto: o seletor deixa
 * desmarcar o último item de propósito, e a tela responde com o vazio e a
 * instrução de escolher um. O contrário — o último clique não fazer nada — é
 * o que havia antes, e ninguém descobria por quê.
 */
export function passaNoFiltroDeEstado(
  selecionados: readonly EstadoDoJogo[],
  status: string | null | undefined,
  kickoffUtc: string | null | undefined,
  agora: Date,
): boolean {
  return selecionados.includes(estadoDoJogo(status, kickoffUtc, agora));
}
