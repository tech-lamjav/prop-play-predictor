import type { FutebolFixturePremissas } from '@/services/futebol-data.service';
import { linhaDaSaida, mesmaLinha, type Saida } from '@/utils/futebol-saida';

// Catálogo das premissas do Score: rótulo, peso e agrupamento.
//
// O dado (quais acenderam) vem da RPC get_futebol_fixture_premissas (migration 093).
// O que mora AQUI é o que é copy e decisão de produto: como cada premissa se chama
// para o usuário, quanto ela vale e em qual grupo ela entra.
//
// Fonte dos pesos: docs/premissas-recalibragem.md (01/08/2026), seções "Pesos
// decididos" de cada mercado. Os pesos NOVOS são os da recalibragem, não os que o
// mart aplica hoje, porque o objetivo da tela é mostrar o que decide de verdade.
//
// O agrupamento sai do achado transversal do doc: "premissa de histórico recente não
// ajuda em nenhum mercado (histórico over, histórico seco, histórico de ambos marcam,
// confronto direto e invicto recente). É o dado mais fácil de olhar, então a casa de
// aposta já olhou antes da gente. E o que ajuda é sempre característica estrutural do
// time: como ele defende, como ele ataca, quanto ele descansou."
//
// Por isso os dois grupos:
//   'decide' → característica estrutural, peso novo > 0
//   'preco'  → o mercado já cobra, peso novo 0 ou quase
//
// ATENÇÃO ao mexer: Ambos Marcam e Dupla Chance estão marcados como PENDENTES no doc
// (não são recalibragem, são decisão de destravar ou aposentar), então peso `null`.
// Não inventar peso para eles.

export type GrupoPremissa = 'decide' | 'preco';

export interface Premissa {
  slug: string;
  /** Rótulo para o usuário. Segue as strings que o backend já manda no Telegram. */
  label: string;
  /**
   * Rótulo para quando a premissa não acendeu. Ele descreve a ausência de sinal na
   * régua, nunca inventa que o fato oposto aconteceu.
   */
  negativo: string;
  grupo: GrupoPremissa;
  /** Peso na recalibragem. `null` = mercado ainda não recalibrado. */
  peso: number | null;
  /** Por que vale pouco ou zero. Só preenchido quando ajuda a entender. */
  motivo?: string;
  /**
   * Rótulos por mando da aposta. "Manda bem em casa" aparecia para o visitante, e
   * "Defesa sólida jogando fora" aparecia para o mandante. Onde o mando muda o
   * sentido da frase, o par certo mora aqui; onde não muda, fica só o label.
   */
  labelCasa?: string;
  negativoCasa?: string;
  labelFora?: string;
  negativoFora?: string;
  /**
   * O lado do mercado a que a premissa pertence.
   *
   * Existe porque o catálogo de um mercado guarda os DOIS lados juntos, mas cada
   * saída só pode acender o seu: "defesas frágeis" é do Over, "defesas firmes" é do
   * Under, e as duas medem o mesmo número. Sem esta marca a tela mostrava, na mesma
   * saída, "defesas frágeis dos dois lados" a favor e "defesas firmes dos dois
   * lados" como premissa que não aconteceu, as duas com o mesmo 3,0 gols embaixo.
   * Confirmado na base (RPC 093): linha Over acende só premissa de Over, linha Under
   * só de Under, e no handicap o lado sai do sinal da linha.
   */
  lado?: LadoPremissa;
}

/** O lado do mercado a que uma premissa pertence. `undefined` = vale para os dois. */
export type LadoPremissa = 'favorito' | 'azarao' | 'over' | 'under' | 'sim' | 'nao';

/** Premissas que o doc manda NÃO mostrar. Ver 093 e "Frente 4: limpeza". */
export const PREMISSAS_OCULTAS = new Set([
  // "favorito_irregular sai da tela": acende em 43% das linhas, vale 0 ponto, e
  // aparecia como evidência ("O favorito não costuma golear").
  'favorito_irregular',
  // Score de contexto (spec #301): estas cinco descrevem PREÇO — movimento de
  // linha, movimento das casas e concordância do modelo. Elas não medem o
  // contexto do jogo, então deixam de ser razão. O preço continua publicado
  // como informação (odd, edge, casas) e como porta de segurança na faixa de
  // odd; o que acaba é ele se apresentar como premissa.
  'corroboracao_ambos',
  'linha_sharp_confirma',
  'modelo_api_concorda',
  'linha_subindo',
  'linha_descendo',
]);

const P = (
  slug: string,
  label: string,
  negativo: string,
  grupo: GrupoPremissa,
  peso: number | null,
  extra: {
    motivo?: string;
    lado?: LadoPremissa;
    labelCasa?: string;
    negativoCasa?: string;
    labelFora?: string;
    negativoFora?: string;
  } = {},
): Premissa => ({ slug, label, negativo, grupo, peso, ...extra });

/**
 * O rótulo da premissa para o mando da aposta. Só muda onde o mando importa; nas
 * outras a frase já serve para os dois.
 */
export function rotuloPremissa(p: Premissa, lado: 'home' | 'away' | null, negativo = false): string {
  if (lado === 'home') return (negativo ? p.negativoCasa : p.labelCasa) ?? (negativo ? p.negativo : p.label);
  if (lado === 'away') return (negativo ? p.negativoFora : p.labelFora) ?? (negativo ? p.negativo : p.label);
  return negativo ? p.negativo : p.label;
}

/** Resultado (1X2). Teto de premissa 51 → 30, de 7 ativas para 4. */
const P_1X2: Premissa[] = [
  P('forma', 'Em boa fase, vem ganhando', 'A forma recente não entrou como sinal a favor', 'decide', 10),
  // O rótulo base é o NEUTRO, e as variantes de mando ficam explícitas. Antes o base
  // era "Manda bem em casa" e o mandante caía nele por omissão, o que funcionava na
  // tela mas deixava o empate sem frase própria: o SQL tinha inventado um "Mando
  // relevante" que não existia aqui. Agora os três casos moram no mesmo lugar.
  P('mando', 'Mando relevante', 'O mando não entrou como sinal a favor', 'decide', 8, {
    labelCasa: 'Manda bem em casa',
    negativoCasa: 'Em casa, o mando não entrou como sinal a favor',
    labelFora: 'Vai bem fora de casa',
    negativoFora: 'Fora de casa, o mando não entrou como sinal a favor',
  }),
  P('superioridade_tabela', 'Bem à frente na tabela', 'A posição na tabela não entrou como sinal a favor', 'decide', 8),
  P('forca_mismatch', 'Ataque forte contra defesa frágil do adversário', 'O duelo entre ataque e defesa não entrou como sinal a favor', 'decide', 4, {
    motivo: 'entende o jogo, mas o preço já cobra quase tudo',
  }),
  P('superioridade_xg', 'Cria mais chances de gol que o adversário', 'A criação de chances não entrou como sinal a favor', 'preco', 0, {
    motivo: 'chance de gol prevê gols, não quem ganha',
  }),
  P('h2h_favoravel', 'Leva vantagem no histórico do confronto', 'O histórico do confronto não entrou como sinal a favor', 'preco', 0, {
    motivo: 'todo mundo olha, então já está na odd',
  }),
  P('desfalque_adversario', 'Adversário com desfalque de titular importante', 'Os desfalques do adversário não entraram como sinal a favor', 'preco', 0, {
    motivo: 'sem dado em 99,5% dos jogos futuros',
  }),
];

/** Gols (Over/Under). Teto do Over 56 → 34, do Under 52 → 40. De 13 ativas para 8. */
const P_OU: Premissa[] = [
  P('defesas_firmes', 'Defesas firmes dos dois lados', 'A solidez das defesas não entrou como sinal a favor', 'decide', 14, { lado: 'under' }),
  P('defesas_vazaveis', 'Defesas frágeis dos dois lados', 'A fragilidade das defesas não entrou como sinal a favor', 'decide', 12, { lado: 'over' }),
  P('ataque_combinado', 'Os dois somam muitos gols', 'O ataque dos dois times não entrou como sinal a favor', 'decide', 12, { lado: 'over' }),
  P('xg_baixo_combinado', 'Os dois criam pouca chance de gol', 'O baixo volume de chances não entrou como sinal a favor', 'decide', 10, { lado: 'under' }),
  P('xg_combinado_alto', 'Os dois criam muita chance de gol', 'O alto volume de chances não entrou como sinal a favor', 'decide', 10, { lado: 'over' }),
  P('clean_sheets_altos', 'Os dois passam muitos jogos sem sofrer gol', 'Os jogos sem sofrer gol não entraram como sinal a favor', 'decide', 10, { lado: 'under' }),
  P('ataques_fracos', 'Ataques fracos dos dois lados', 'A limitação dos ataques não entrou como sinal a favor', 'decide', 3, { lado: 'under', motivo: 'o preço já cobra' }),
  P('historico_under', 'Histórico de jogo com poucos gols', 'O histórico de poucos gols não entrou como sinal a favor', 'preco', 3, { lado: 'under', motivo: 'sinal fraco' }),
  P('ambos_vazam', 'Os dois sofrem gol quase todo jogo', 'Os gols sofridos não entraram como sinal a favor', 'preco', 0, {
    lado: 'over',
    motivo: 'o preço cobra mais do que ela vale',
  }),
  P('ritmo_alto', 'Jogo de ritmo alto', 'O ritmo do jogo não entrou como sinal a favor', 'preco', 0, { lado: 'over', motivo: 'atrapalha nos dois testes' }),
  P('historico_over', 'Histórico de jogo com muitos gols', 'O histórico de muitos gols não entrou como sinal a favor', 'preco', 0, { lado: 'over', motivo: 'atrapalha nos dois testes' }),
  P('linha_subindo', 'Mercado puxando a linha pra cima', 'O movimento da linha não entrou como sinal a favor', 'preco', 0, { lado: 'over', motivo: 'atrapalha nos dois testes' }),
  P('linha_descendo', 'Mercado puxando a linha pra baixo', 'O movimento da linha não entrou como sinal a favor', 'preco', 0, {
    lado: 'under',
    motivo: 'atrapalha nos dois testes',
  }),
];

/** Handicap asiático. Teto equilibrado em 35 nos dois lados (azarão era 13). */
const P_AH: Premissa[] = [
  P('tende_golear', 'Costuma ganhar por muitos gols', 'A margem das vitórias não entrou como sinal a favor', 'decide', 16, { lado: 'favorito' }),
  P('supremacia', 'Muito superior ao adversário', 'A superioridade sobre o adversário não entrou como sinal a favor', 'decide', 12, { lado: 'favorito' }),
  P('defesa_fora_solida', 'Defesa sólida jogando fora', 'A solidez defensiva não entrou como sinal a favor', 'decide', 10, {
    lado: 'azarao',
    labelCasa: 'Defesa sólida em casa',
    negativoCasa: 'Em casa, a solidez defensiva não entrou como sinal a favor',
  }),
  P('sem_rodizio', 'Deve entrar com força máxima', 'A escalação esperada não entrou como sinal a favor', 'decide', 3, { lado: 'favorito' }),
  // O rótulo antigo era "Raramente perde por dois ou mais", e ele enunciava uma
  // CONDIÇÃO DE APOSTA que só vale em duas das sete linhas do handicap: num +0,5 a
  // aposta morre em qualquer derrota, então a margem da derrota não responde nada.
  // Chegou ao usuário numa DM de +0,5 e não fechou a conta (issue #272).
  //
  // O sinal, porém, é real: gradada contra o placar dos 90 minutos no lado azarão,
  // ela separa em TODAS as linhas de meio gol, inclusive no +0,5, e o efeito
  // sobrevive ao controle por faixa de odd acima de 1,30. Ela funciona como atalho
  // para solidez defensiva geral. Logo o defeito era a frase, não o cálculo.
  P('raramente_perde_por_2', 'Quando perde, perde apertado', 'A margem das derrotas não entrou como sinal a favor', 'decide', 3, {
    lado: 'azarao',
    motivo: 'sinal quase nulo, mas é o que abre a porta do azarão',
  }),
  P('adversario_fragil_fora', 'Adversário fraco fora de casa', 'O desempenho do adversário não entrou como sinal a favor', 'preco', 2, {
    lado: 'favorito',
    motivo: 'o preço já cobra tudo',
    labelFora: 'Adversário fraco em casa',
    negativoFora: 'O desempenho do adversário não entrou como sinal a favor',
  }),
  P('mando_forte', 'Manda muito bem em casa', 'O mando não entrou como sinal a favor', 'preco', 2, {
    lado: 'favorito',
    motivo: 'o preço já cobra tudo',
    labelFora: 'Vai muito bem fora de casa',
    negativoFora: 'O mando não entrou como sinal a favor',
  }),
];

/** Ambos marcam. PENDENTE no doc: hoje nunca publica (a Pinnacle não cota o mercado). */
const P_BTTS: Premissa[] = [
  P('ambos_marcam', 'Os dois costumam marcar', 'Os gols dos dois times não entraram como sinal a favor', 'decide', null, { lado: 'sim' }),
  P('ataque_dos_dois', 'Os dois atacam bem', 'O ataque dos dois times não entrou como sinal a favor', 'decide', null, { lado: 'sim' }),
  P('defesas_vazaveis', 'Defesas frágeis dos dois lados', 'A fragilidade das defesas não entrou como sinal a favor', 'decide', null, { lado: 'sim' }),
  P('defesa_forte', 'Defesa forte de um dos lados', 'A força defensiva não entrou como sinal a favor', 'decide', null, { lado: 'nao' }),
  P('ataque_trava', 'Um dos ataques costuma passar em branco', 'A limitação ofensiva não entrou como sinal a favor', 'decide', null, { lado: 'nao' }),
  P('historico_btts', 'Nos últimos jogos, os dois marcaram', 'O histórico de ambos marcam não entrou como sinal a favor', 'preco', null, { lado: 'sim', motivo: 'histórico já está na odd' }),
  P('historico_seco', 'Jogos recentes sem os dois marcarem', 'O histórico de jogos secos não entrou como sinal a favor', 'preco', null, { lado: 'nao', motivo: 'histórico já está na odd' }),
];

/** Dupla chance. PENDENTE no doc: Score máximo simulado 39 contra régua de 40. */
const P_DC: Premissa[] = [
  P('lado_coberto_forte', 'O lado coberto é forte', 'A força do lado coberto não entrou como sinal a favor', 'decide', null),
  P('equilibrio_defensivo', 'Equilíbrio defensivo', 'O equilíbrio defensivo não entrou como sinal a favor', 'decide', null),
  P('adversario_limitado', 'Adversário com campanha fraca', 'A campanha do adversário não entrou como sinal a favor', 'decide', null),
  P('invicto_recente', 'Invicto nos últimos jogos', 'A sequência invicta não entrou como sinal a favor', 'preco', null, { motivo: 'histórico já está na odd' }),
];

/** Penalidades, por mercado. Peso negativo. */
const PEN: Record<string, Premissa[]> = {
  match_winner: [
    P('pick_empate', 'Empate é o resultado mais difícil de prever', 'Não é aposta no empate', 'decide', 0, { motivo: 'suspensa até ter amostra' }),
    P('desfalque_proprio', 'Time apostado com desfalque de titular importante', 'O próprio time não tem desfalque', 'decide', -15),
  ],
  goals_over_under: [P('linha_extrema', 'Linha muito longe do normal', 'A linha não está longe do normal', 'decide', -10)],
  asian_handicap: [P('handicap_alto', 'Handicap muito alto', 'O handicap não é alto', 'decide', 0, { motivo: 'efeito zero nos dois testes' })],
  btts: [],
  double_chance: [],
};

/**
 * Avisos que não pertencem a mercado nenhum: eles falam do PREÇO, então valem para
 * qualquer aposta.
 *
 * Não estavam neste catálogo porque a tela consome o array de avisos da RPC como
 * texto cru, e por isso a copy deles nunca passou por aqui. Consequência medida na
 * issue #272: os quatro nasceram com travessão, que a régua de copy do produto
 * proíbe, e ninguém viu porque não havia um lugar onde eles fossem lidos.
 *
 * A ordem é por severidade, que é a ordem em que devem ser oferecidos.
 */
const AVISOS_GLOBAIS: Premissa[] = [
  P('pen_odd_outlier', 'Só uma casa paga essa odd, pode ser linha furada', 'A odd não está fora da curva', 'decide', -30),
  P('pen_odd_longshot', 'Odd alta de zebra, entra com cautela', 'A odd não é de zebra', 'decide', -15),
  P('pen_poucas_casas', 'Poucas casas cotando esse mercado', 'O mercado tem casas suficientes', 'decide', -12),
  P('pen_odd_juice', 'Odd baixa, retorno pequeno pro risco', 'A odd não é baixa demais', 'decide', -10),
];

/**
 * Evidências que não pertencem a mercado nenhum: falam do PREÇO, então valem para
 * qualquer aposta e competem por peso com as premissas do mercado.
 *
 * Mesma história dos avisos globais: o SQL publicava esta como evidência e ela não
 * existia neste catálogo, então a tela e a DM nunca puderam concordar sobre ela.
 * O peso 8 é o da corroboração por linha sharp, e é ele que define onde ela entra
 * na fila de cada mercado.
 */
const EVIDENCIAS_GLOBAIS: Premissa[] = [
  // A corroboração são DOIS sinais e TRÊS frases: quando os dois acendem, a frase é
  // uma terceira, e as duas individuais somem. `corroboracao_ambos` é um slug
  // derivado, calculado no SQL antes da tradução, para que a precedência viva num
  // lugar só em vez de virar `case` repetido em três funções.
  P('corroboracao_ambos', 'As principais casas e o modelo da API apontam o mesmo lado', 'A corroboração não entrou como sinal a favor', 'preco', 8),
  P('linha_sharp_confirma', 'As principais casas vêm baixando a odd desse lado', 'O movimento das casas não entrou como sinal a favor', 'preco', 8),
  // Peso 0 porque a recalibragem tirou os +7 da API da nota (o modelo troca mando por
  // empate errando 14 pontos). Continua sendo mostrado, mas é o último da fila.
  P('modelo_api_concorda', 'Modelo da API concorda com esse lado', 'O modelo da API não entrou como sinal a favor', 'preco', 0),
];

export interface MercadoInfo {
  slug: string;
  label: string;
  /** Teto de premissa depois da recalibragem. `null` = mercado pendente. */
  teto: number | null;
  premissas: Premissa[];
  penalidades: Premissa[];
  /** Aviso de estado do mercado, quando houver. */
  aviso?: string;
}

export const MERCADOS: MercadoInfo[] = [
  { slug: 'goals_over_under', label: 'Gols (mais ou menos)', teto: 40, premissas: P_OU, penalidades: PEN.goals_over_under },
  { slug: 'match_winner', label: 'Resultado', teto: 30, premissas: P_1X2, penalidades: PEN.match_winner },
  { slug: 'asian_handicap', label: 'Handicap asiático', teto: 35, premissas: P_AH, penalidades: PEN.asian_handicap },
  {
    slug: 'btts',
    label: 'Ambos marcam',
    teto: null,
    premissas: P_BTTS,
    penalidades: PEN.btts,
    aviso: 'Mercado em revisão: hoje não gera aposta porque falta referência de preço.',
  },
  {
    slug: 'double_chance',
    label: 'Dupla chance',
    teto: null,
    premissas: P_DC,
    penalidades: PEN.double_chance,
    aviso: 'Mercado em revisão: hoje não gera aposta porque não alcança a régua.',
  },
];

const PREMISSA_POR_SLUG = new Map<string, Premissa>();
MERCADOS.forEach((m) =>
  [...m.premissas, ...m.penalidades].forEach((p) => {
    // Mesmo slug pode existir em dois mercados (defesas_vazaveis em Gols e BTTS)
    // com peso diferente. A chave é mercado+slug.
    PREMISSA_POR_SLUG.set(`${m.slug}:${p.slug}`, p);
  }),
);

/** Busca a premissa pelo par mercado+slug. Devolve null pra slug desconhecido. */
export function premissaDe(market: string, slug: string): Premissa | null {
  return PREMISSA_POR_SLUG.get(`${market}:${slug}`) ?? null;
}

export function mercadoDe(slug: string): MercadoInfo | null {
  return MERCADOS.find((m) => m.slug === slug) ?? null;
}

/** Número da linha em pt-BR: 1,5 e não 1.5. */
function fmtLinha(line: number): string {
  return String(line).replace('.', ',');
}

/** Rótulo da saída da aposta, na linguagem do apostador. */
export function outcomeLabel(s: Saida, home: string, away: string): string {
  const { market, outcome, line_value: line } = s;
  if (market === 'match_winner') {
    if (outcome === 'Home') return `Vitória do ${home}`;
    if (outcome === 'Away') return `Vitória do ${away}`;
    return 'Empate';
  }
  if (market === 'goals_over_under') {
    return `${outcome === 'Over' ? 'Mais' : 'Menos'} de ${line != null ? fmtLinha(line) : ''} gols`;
  }
  if (market === 'asian_handicap') {
    // `line` vem na ótica do mandante (mesma convenção do pickLabel e da liquidação):
    // o handicap do visitante é o oposto, senão o card do Vasco dizia "Vasco −1,5"
    // numa linha em que ele recebe +1,5.
    const daSaida = linhaDaSaida(s);
    const time = outcome === 'Home' ? home : away;
    return daSaida != null ? `${time} ${daSaida > 0 ? '+' : '−'}${fmtLinha(Math.abs(daSaida))}` : time;
  }
  // O nome da casa de apostas, igual ao `pickLabel` e à DM. O rótulo anterior
  // para o "não" — "Não marcam os dois" — além de destoar, descrevia OUTRA
  // aposta: aquilo é o 0 a 0, e BTTS No cobre também o 1 a 0.
  if (market === 'btts') return outcome === 'Yes' ? 'Ambos marcam: Sim' : 'Ambos marcam: Não';
  if (market === 'double_chance') {
    if (outcome === '1X') return `${home} ou empate`;
    if (outcome === 'X2') return `${away} ou empate`;
    return `${home} ou ${away}`;
  }
  return outcome;
}

/**
 * A porta nova de publicação: 2+ premissas acesas, contando SÓ as que sobreviveram
 * à recalibragem daquele mercado. O doc é explícito: contar as antigas deixaria a
 * porta aberta justamente pelas premissas cortadas por atrapalhar.
 */
export const PORTA_PREMISSAS = 2;

/**
 * O candidato que representa um mercado (a saída/linha com mais premissas que
 * valem). Vive aqui, e não no componente do mapa, porque o painel da agenda também
 * resume o jogo por ele.
 */
/**
 * A linha entra como candidata? Handicap zero nunca acende premissa (as 7 são de
 * favorito ou de azarão) e o doc manda excluir explicitamente em vez de deixar
 * sumir em silêncio.
 *
 * Mora aqui, e não dentro de `melhorCandidato`, porque o candidato de PREÇO precisa
 * do mesmo corte: aplicado só de um lado, um handicap zero cotado viraria o
 * representante do mercado e a folha abriria numa linha que a régua nem lista.
 */
export function linhaNegociavel(market: string, line: number | null): boolean {
  return !(market === 'asian_handicap' && line === 0);
}

export function melhorCandidato(
  rows: FutebolFixturePremissas[],
  market: string,
  /**
   * A saída que veio pelo link, quando houver.
   *
   * Ela já era respeitada entre as linhas COM preço, mas este caminho — o sem
   * preço — a ignorava. Resultado: vindo do painel de um jogo sem oportunidade,
   * o link carregava a leitura e a tela abria noutra (#346).
   */
  preferida?: Saida | null,
): FutebolFixturePremissas | null {
  const doMercado = rows
    .filter((r) => r.market === market)
    .filter((r) => linhaNegociavel(market, r.line_value));
  if (!doMercado.length) return null;

  if (preferida?.market === market) {
    const clicada = doMercado.find(
      (r) => r.outcome === preferida.outcome && mesmaLinha(r.line_value, preferida.line_value),
    );
    if (clicada) return clicada;
  }
  const nota = (r: FutebolFixturePremissas) => contaQueValem(r);
  const nPen = (r: FutebolFixturePremissas) => (r.penalidades ?? []).length;
  // Distância da linha padrão do mercado de gols. Desempata linhas empatadas em
  // premissas ("Over 0,5 / 0,75 / 1") em favor da linha que o mercado de fato
  // negocia. Premissa DEPENDE da linha aqui: no dev, Over 1,5 acende 5 e Over 3,5
  // acende 1 no mesmo jogo.
  const centro = (r: FutebolFixturePremissas) => (r.line_value == null ? 0 : Math.abs(r.line_value - 2.5));
  return [...doMercado].sort(
    (a, b) =>
      nota(b) - nota(a) ||
      // Candidato penalizado (linha extrema etc.) perde de um limpo empatado.
      nPen(a) - nPen(b) ||
      centro(a) - centro(b) ||
      b.pts_premissas - a.pts_premissas,
  )[0];
}

/** Uma saída junto das premissas que acenderam nela. É o que a porta de contexto lê. */
export type SaidaComAcesas = Saida & { acesas: readonly string[] };

/** A premissa entra na porta de contexto? Mercado pendente (peso null) entra: ali ainda não houve corte. */
const contaNaPorta = (p: Premissa) => p.peso == null || p.peso > 0;

/**
 * O par "n de N" da porta de contexto, das premissas do LADO da saída.
 *
 * As duas metades saem daqui juntas de propósito (#351). Enquanto o numerador
 * vivia em `contaQueValem` e cada tela derivava o seu denominador, eles mediam
 * universos diferentes: o numerador contava qualquer premissa acesa do mercado e
 * o denominador, em algumas telas, contava os DOIS lados. Dava "2 de 8" onde o
 * certo era "2 de 3", e um "3 de 6" que virava "3 de 7" ao arrastar a régua.
 *
 * O total é fixo por lado, porque o conjunto de premissas de um lado é fixo no
 * modelo: 6 de Over e 5 de Under no mercado de gols. Trocar de linha dentro do
 * mesmo lado não pode mexer nele.
 */
export function contagemDaPorta(s: SaidaComAcesas): { acesas: number; total: number } {
  const m = mercadoDe(s.market);
  if (m == null) return { acesas: 0, total: 0 };
  const doLado = premissasDaSaida(m, s).filter(contaNaPorta);
  const acesasSet = new Set(s.acesas);
  return {
    acesas: doLado.filter((p) => acesasSet.has(p.slug)).length,
    total: doLado.length,
  };
}

/** Quantas premissas do lado da saída acenderam e contam para a porta. */
export function contaQueValem(s: SaidaComAcesas): number {
  return contagemDaPorta(s).acesas;
}

// ── Vocabulário do Protótipo 1b (Claude Design) ─────────────────────────────
// O número do peso não vai à tela: vira palavra. E as premissas apagadas não são
// uma lista única — são três estados que nunca se misturam: não aconteceu neste
// jogo, não conta neste mercado (o preço já cobra), e não avaliada (mercado sem
// calibragem, caso do BTTS e da dupla chance).

/**
 * Peso da premissa em palavra, no lugar da cifra interna da fórmula.
 *
 * ⚠️ O selo do peso zero era "NÃO CONTA", e ele se contradizia com o lugar onde
 * aparece: a premissa está na lista **A FAVOR**, porque o modelo a acendeu, e o
 * selo ao lado dizia que ela não conta. O assinante lê as duas coisas juntas e
 * conclui que a tela está errada.
 *
 * "Não ajuda" é o que a recalibragem de fato mediu, e não se choca com o lugar:
 * a premissa é verdadeira sobre o jogo, e mesmo assim não melhora a previsão. Em
 * `ambos_vazam` porque o preço já cobra; em `historico_over` e `ritmo_alto`
 * porque elas atrapalharam nos dois testes. O `motivo` de cada uma, que a tela
 * mostra ao lado, é quem diz qual dos dois casos é.
 *
 * "Não conta" também era ambíguo com o grupo das apagadas, onde ele queria dizer
 * "não se aplica a este mercado" — outra coisa (#357).
 */
export function pesoPalavra(p: Premissa): string {
  if (p.peso == null) return 'Peso a calibrar';
  if (p.peso >= 10) return 'Pesa muito';
  if (p.peso >= 5) return 'Pesa';
  if (p.peso === 0) return 'Não ajuda';
  return 'Pesa pouco';
}

/** Premissa que de fato decide (peso calibrado e relevante). */
export function pesoForte(p: Premissa): boolean {
  return p.peso != null && p.peso >= 5;
}

/**
 * Selo de força da leitura, a partir das premissas ACESAS que valem.
 *
 * O nome era "contexto forte/parcial/fraco" e não comunicava: "contexto" é palavra
 * de quem fez a metodologia, não de quem aposta. "Leitura" é o termo que o resto do
 * produto já usa ("a leitura do jogo", "melhor leitura do jogo") e responde a
 * pergunta certa: o quanto o jogo sustenta esta aposta.
 */
export function contextoDoMercado(acesasFortes: number, semCalibragem: boolean): {
  label: string;
  tone: 'forte' | 'parcial' | 'fraco' | 'semcal';
} {
  if (semCalibragem) return { label: 'Mercado em revisão', tone: 'semcal' };
  if (acesasFortes >= 2) return { label: 'Leitura forte', tone: 'forte' };
  if (acesasFortes === 1) return { label: 'Leitura parcial', tone: 'parcial' };
  return { label: 'Leitura fraca', tone: 'fraco' };
}

/**
 * O lado do mercado a que uma saída pertence, quando o mercado tem dois lados.
 *
 * No handicap o `line_value` da RPC é o handicap do MANDANTE, e o visitante recebe o
 * oposto: quem dá gol de vantagem (handicap negativo) é o favorito. Conferido na
 * base: Home −1,5 acende premissa de favorito, Home +0,5 acende de azarão.
 */
export function ladoDaSaidaNoMercado({ market, outcome, line_value: line }: Saida): LadoPremissa | null {
  if (market === 'goals_over_under') return outcome === 'Over' ? 'over' : 'under';
  if (market === 'btts') return outcome === 'Yes' ? 'sim' : 'nao';
  if (market === 'asian_handicap') {
    if (line == null || line === 0) return null;
    const hcap = outcome === 'Home' ? line : -line;
    return hcap < 0 ? 'favorito' : 'azarao';
  }
  return null;
}

/**
 * As premissas que aquela saída pode acender. As do outro lado ficam fora: elas não
 * "deixaram de acontecer", elas contam para a aposta contrária.
 *
 * ⚠️ NÃO reintroduzir uma exceção para a premissa ACESA do outro lado (#351). Ela
 * existiu aqui como rede de segurança — "se o mart algum dia acender uma premissa
 * do lado errado, ela continua aparecendo em vez de sumir em silêncio" —, e o preço
 * foi alto em duas frentes:
 *
 *   · a lista se contradizia. Um Over aceso não sustenta um Under, e mostrá-lo
 *     embaixo de uma leitura de Under é a tela afirmando as duas coisas.
 *   · o DENOMINADOR se mexia. O total sai desta lista, então "3 de 6" virava
 *     "3 de 7" quando o assinante arrastava a régua até uma linha em que o mart
 *     acendeu do outro lado — um total que deveria ser fixo por lado passava a
 *     depender da linha.
 *
 * O conjunto de premissas de um lado é fixo e vem do modelo: no mercado de gols,
 * 6 de Over e 5 de Under. Acender do lado errado é dado a INVESTIGAR, não coisa a
 * exibir; quem quer ver isso lê o mart, não a tela do assinante.
 */
export function premissasDaSaida(m: MercadoInfo, s: Saida): Premissa[] {
  const lado = ladoDaSaidaNoMercado(s);
  return m.premissas.filter(
    (p) => !PREMISSAS_OCULTAS.has(p.slug) && (lado == null || p.lado == null || p.lado === lado),
  );
}

// As premissas do outro lado não viram lista: a tela mostra os dois lados como
// cards e o usuário troca de lado clicando. Listar os espelhos ("defesas frágeis"
// embaixo de uma análise de "defesas firmes") fazia a tela se contradizer, mesmo
// sem número, porque o rótulo já é a negação do que está sendo afirmado ao lado.

// ── A copy que a camada de serving publica ───────────────────────────────────
//
// Este bloco existe porque a copy da premissa vivia em DOIS lugares: aqui, que
// serve a tela, e o SQL das RPCs, que serve a DM do Telegram. Eles divergiram em
// 27 de 36 premissas, e ninguém viu, porque nada comparava os dois (issue #272).
//
// Agora este catálogo é a fonte única, e o SQL passa a ler de uma tabela de apoio
// semeada a partir do que `copyDeServing()` devolve. A guarda de paridade compara
// a semente com esta função e quebra no PR quando os dois se afastam.
//
// Três defeitos concretos que a ORDEM resolve, todos medidos:
//   · a DM mostra o primeiro item do array, e a ordem do SQL era a ordem em que
//     ele foi escrito. No azarão do handicap, 12.736 linhas mostravam a premissa
//     de 3 pontos tendo a de 10 disponível
//   · a `favorito_irregular` aparecia na DM em 4.268 linhas, sendo que a tela a
//     esconde de propósito (acende em 43% das linhas e vale zero)
//   · a `mando` do Resultado, que vale 8 pontos, não estava no array do SQL:
//     existia a coluna no banco e a entrada aqui, e a DM nunca a mostrava

/** O que a camada de serving publica: o motivo, o contra-motivo e o aviso. */
export type TipoCopy = 'evidencia' | 'contra' | 'aviso';

/**
 * O mando da aposta a que aquele texto pertence.
 *
 * `any` é o texto neutro e é o que vale quando o mando não muda a frase, ou quando a
 * saída não tem mando (empate, mais e menos gols). `home` e `away` só existem onde a
 * frase muda de verdade, e quem decide isso é `rotuloPremissa`, para a regra não ser
 * reescrita aqui.
 */
export type MandoCopy = 'any' | 'home' | 'away';

export interface LinhaCopy {
  tipo: TipoCopy;
  market: string;
  slug: string;
  mando: MandoCopy;
  /**
   * Posição dentro do seu tipo e mercado. 1 é o primeiro a ser oferecido.
   *
   * As variantes de mando do MESMO slug compartilham a posição: a ordem é do slug, o
   * mando só escolhe qual frase sai.
   */
  ordem: number;
  texto: string;
}

/**
 * Quais premissas produzem um contra quando NÃO acendem.
 *
 * É um subconjunto deliberado, e ele preserva exatamente o que o SQL já emitia:
 * mostrar o contra de toda premissa apagada encheria a tela de negativas. A chave
 * é mercado+slug porque o mesmo slug existe em dois mercados.
 */
const CONTRAS_ELEGIVEIS = new Set([
  'match_winner:forca_mismatch',
  'match_winner:mando',
  'match_winner:superioridade_tabela',
  'goals_over_under:ataque_combinado',
  'goals_over_under:ritmo_alto',
  'goals_over_under:xg_combinado_alto',
  'goals_over_under:defesas_firmes',
  'goals_over_under:clean_sheets_altos',
  'goals_over_under:xg_baixo_combinado',
  'asian_handicap:supremacia',
  'asian_handicap:tende_golear',
  'asian_handicap:raramente_perde_por_2',
  'asian_handicap:defesa_fora_solida',
  'btts:ambos_marcam',
  'btts:defesas_vazaveis',
  'btts:defesa_forte',
  'btts:ataque_trava',
  'double_chance:lado_coberto_forte',
  'double_chance:adversario_limitado',
]);

/**
 * Contras que só fazem sentido quando a aposta TEM mando.
 *
 * O SQL já fazia isso com um `and v.outcome <> 'Draw'` solto: dizer "o mando não pesa
 * a favor" numa aposta no empate é ruído, porque não há mando de que falar. Aqui a
 * regra vira a ausência do texto neutro, o que dispensa a exceção no SQL.
 */
const CONTRAS_SO_COM_MANDO = new Set(['match_winner:mando']);

/**
 * Peso para ordenar.
 *
 * `null` é mercado sem calibragem, e ele ordena ACIMA de qualquer peso numérico de
 * propósito. Não é para dar prioridade a quem não foi medido: é para os itens
 * GLOBAIS (que têm peso numérico) ficarem atrás das premissas do próprio mercado
 * quando aquele mercado não tem escala. Sem isso, uma aposta de Ambos Marcam saía
 * na DM justificada pelo movimento da odd em vez de pelo jogo.
 *
 * Nos mercados calibrados não há premissa com peso `null`, então isto não altera
 * nada lá, e entre os `null` o `sort` estável preserva a ordem declarada.
 */
const chaveDeOrdem = (p: Premissa) => (p.peso == null ? Number.POSITIVE_INFINITY : p.peso);

/** Numera 1..n preservando a ordem recebida. */
function numerar(tipo: TipoCopy, market: string, itens: Premissa[], negativo = false): LinhaCopy[] {
  const out: LinhaCopy[] = [];
  itens.forEach((p, i) => {
    const ordem = i + 1;
    const neutro = negativo ? p.negativo : p.label;
    const soComMando = tipo === 'contra' && CONTRAS_SO_COM_MANDO.has(`${market}:${p.slug}`);
    if (!soComMando) out.push({ tipo, market, slug: p.slug, mando: 'any', ordem, texto: neutro });
    // A variante só entra quando a frase muda mesmo. Emitir as três sempre triplicaria
    // a tabela para repetir o mesmo texto.
    for (const lado of ['home', 'away'] as const) {
      const texto = rotuloPremissa(p, lado, negativo);
      if (texto !== neutro) out.push({ tipo, market, slug: p.slug, mando: lado, ordem, texto });
    }
  });
  return out;
}

/**
 * As evidências de um mercado, na ordem em que devem ser oferecidas: peso
 * decrescente, e sem as ocultas.
 *
 * Premissa de peso zero CONTINUA entrando, no fim da fila. Ela não some porque
 * motivo fraco é melhor que motivo nenhum, e a ordem já garante que ela só apareça
 * quando não houver nada acima dela.
 */
export function evidenciasDoMercado(market: string): Premissa[] {
  const m = mercadoDe(market);
  if (!m) return [];
  return [...m.premissas, ...EVIDENCIAS_GLOBAIS]
    .filter((p) => !PREMISSAS_OCULTAS.has(p.slug))
    .sort((a, b) => chaveDeOrdem(b) - chaveDeOrdem(a));
}

/**
 * Os avisos de um mercado, do mais severo para o menos, com os globais dentro.
 *
 * Os globais entram em cada mercado em vez de virar um grupo à parte porque assim a
 * ordem de exibição é uma lista só, sem regra de "primeiro os globais" escrita em
 * dois lugares. O preço disso é repetir quatro linhas por mercado na tabela de
 * apoio, o que é barato.
 */
export function avisosDoMercado(market: string): Premissa[] {
  const m = mercadoDe(market);
  if (!m) return [];
  return [...AVISOS_GLOBAIS, ...m.penalidades].sort((a, b) => chaveDeOrdem(a) - chaveDeOrdem(b));
}

/**
 * Toda a copy que a camada de serving publica, achatada e já ordenada.
 *
 * É exatamente o conteúdo da tabela de apoio no banco. A migration semeia a partir
 * desta lista e a guarda de paridade a compara com a semente.
 */
export function copyDeServing(): LinhaCopy[] {
  const out: LinhaCopy[] = [];

  for (const m of MERCADOS) {
    const evidencias = evidenciasDoMercado(m.slug);
    out.push(...numerar('evidencia', m.slug, evidencias));
    out.push(...numerar('contra', m.slug, evidencias.filter((p) => CONTRAS_ELEGIVEIS.has(`${m.slug}:${p.slug}`)), true));
    out.push(...numerar('aviso', m.slug, avisosDoMercado(m.slug)));
  }

  return out;
}
