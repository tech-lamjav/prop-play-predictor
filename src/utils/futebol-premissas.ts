import type { FutebolFixturePremissas } from '@/services/futebol-data.service';

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
   * O mesmo rótulo escrito no negativo, para quando a premissa NÃO acendeu.
   *
   * Existe porque "Os dois somam muitos gols" com um "não aconteceu" embaixo é lido
   * como afirmação: o olho pega o título e passa. Escrito "Os dois não somam muitos
   * gols", a linha diz o que é sem depender do rodapé.
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
  P('forma', 'Em boa fase, vem ganhando', 'Não vem em boa fase', 'decide', 10),
  P('mando', 'Manda bem em casa', 'Não manda bem em casa', 'decide', 8, {
    labelFora: 'Vai bem fora de casa',
    negativoFora: 'Não vai bem fora de casa',
  }),
  P('superioridade_tabela', 'Bem à frente na tabela', 'Não está bem à frente na tabela', 'decide', 8),
  P('forca_mismatch', 'Ataque forte contra defesa frágil', 'O ataque não pega uma defesa frágil', 'decide', 4, {
    motivo: 'entende o jogo, mas o preço já cobra quase tudo',
  }),
  P('superioridade_xg', 'Cria mais chances de gol que o adversário', 'Não cria mais chances de gol que o adversário', 'preco', 0, {
    motivo: 'chance de gol prevê gols, não quem ganha',
  }),
  P('h2h_favoravel', 'Leva vantagem no histórico do confronto', 'Não leva vantagem no histórico do confronto', 'preco', 0, {
    motivo: 'todo mundo olha, então já está na odd',
  }),
  P('desfalque_adversario', 'Adversário desfalcado', 'Adversário sem desfalque conhecido', 'preco', 0, {
    motivo: 'sem dado em 99,5% dos jogos futuros',
  }),
];

/** Gols (Over/Under). Teto do Over 56 → 34, do Under 52 → 40. De 13 ativas para 8. */
const P_OU: Premissa[] = [
  P('defesas_firmes', 'Defesas firmes dos dois lados', 'As defesas não são firmes', 'decide', 14, { lado: 'under' }),
  P('defesas_vazaveis', 'Defesas frágeis dos dois lados', 'As defesas não são frágeis', 'decide', 12, { lado: 'over' }),
  P('ataque_combinado', 'Os dois somam muitos gols', 'Os dois não somam muitos gols', 'decide', 12, { lado: 'over' }),
  P('xg_baixo_combinado', 'Os dois criam pouca chance de gol', 'Os dois criam bastante chance de gol', 'decide', 10, { lado: 'under' }),
  P('xg_combinado_alto', 'Os dois criam muita chance de gol', 'Os dois não criam muita chance de gol', 'decide', 10, { lado: 'over' }),
  P('clean_sheets_altos', 'Os dois seguram muito jogo sem sofrer gol', 'Os dois sofrem gol na maioria dos jogos', 'decide', 10, { lado: 'under' }),
  P('ataques_fracos', 'Ataques fracos dos dois lados', 'Os ataques não são fracos', 'decide', 3, { lado: 'under', motivo: 'o preço já cobra' }),
  P('historico_under', 'Histórico de jogo com poucos gols', 'O histórico não é de jogo com poucos gols', 'preco', 3, { lado: 'under', motivo: 'sinal fraco' }),
  P('ambos_vazam', 'Os dois sofrem gol quase todo jogo', 'Os dois não sofrem gol quase todo jogo', 'preco', 0, {
    lado: 'over',
    motivo: 'o preço cobra mais do que ela vale',
  }),
  P('ritmo_alto', 'Jogo de ritmo alto', 'O jogo não é de ritmo alto', 'preco', 0, { lado: 'over', motivo: 'atrapalha nos dois testes' }),
  P('historico_over', 'Histórico de jogo com muitos gols', 'O histórico não é de jogo com muitos gols', 'preco', 0, { lado: 'over', motivo: 'atrapalha nos dois testes' }),
  P('linha_subindo', 'Mercado puxando a linha pra cima', 'O mercado não está puxando a linha pra cima', 'preco', 0, { lado: 'over', motivo: 'atrapalha nos dois testes' }),
  P('linha_descendo', 'Mercado puxando a linha pra baixo', 'O mercado não está puxando a linha pra baixo', 'preco', 0, {
    lado: 'under',
    motivo: 'atrapalha nos dois testes',
  }),
];

/** Handicap asiático. Teto equilibrado em 35 nos dois lados (azarão era 13). */
const P_AH: Premissa[] = [
  P('tende_golear', 'Costuma ganhar por muitos gols', 'Não costuma ganhar por muitos gols', 'decide', 16, { lado: 'favorito' }),
  P('supremacia', 'Muito superior ao adversário', 'Não é muito superior ao adversário', 'decide', 12, { lado: 'favorito' }),
  P('defesa_fora_solida', 'Defesa sólida jogando fora', 'A defesa não é sólida jogando fora', 'decide', 10, {
    lado: 'azarao',
    labelCasa: 'Defesa sólida em casa',
    negativoCasa: 'A defesa não é sólida em casa',
  }),
  P('sem_rodizio', 'Não deve poupar jogadores', 'Pode poupar jogadores', 'decide', 3, { lado: 'favorito' }),
  P('raramente_perde_por_2', 'Raramente perde por dois ou mais', 'Perde por dois ou mais com frequência', 'decide', 3, {
    lado: 'azarao',
    motivo: 'sinal quase nulo, mas é o que abre a porta do azarão',
  }),
  P('adversario_fragil_fora', 'Adversário fraco fora de casa', 'O adversário não é fraco fora de casa', 'preco', 2, {
    lado: 'favorito',
    motivo: 'o preço já cobra tudo',
    labelFora: 'Adversário fraco em casa',
    negativoFora: 'O adversário não é fraco em casa',
  }),
  P('mando_forte', 'Manda muito bem em casa', 'Não manda tão bem em casa', 'preco', 2, {
    lado: 'favorito',
    motivo: 'o preço já cobra tudo',
    labelFora: 'Vai muito bem fora de casa',
    negativoFora: 'Não vai tão bem fora de casa',
  }),
];

/** Ambos marcam. PENDENTE no doc: hoje nunca publica (a Pinnacle não cota o mercado). */
const P_BTTS: Premissa[] = [
  P('ambos_marcam', 'Os dois costumam marcar', 'Os dois não costumam marcar', 'decide', null, { lado: 'sim' }),
  P('ataque_dos_dois', 'Os dois atacam bem', 'Os dois não atacam bem', 'decide', null, { lado: 'sim' }),
  P('defesas_vazaveis', 'Defesas frágeis dos dois lados', 'As defesas não são frágeis', 'decide', null, { lado: 'sim' }),
  P('defesa_forte', 'Defesa forte de um dos lados', 'Nenhum dos lados tem defesa forte', 'decide', null, { lado: 'nao' }),
  P('ataque_trava', 'Ataque que trava', 'Nenhum dos ataques trava', 'decide', null, { lado: 'nao' }),
  P('historico_btts', 'Histórico dos dois marcando', 'O histórico não é dos dois marcando', 'preco', null, { lado: 'sim', motivo: 'histórico já está na odd' }),
  P('historico_seco', 'Histórico de jogo seco', 'O histórico não é de jogo seco', 'preco', null, { lado: 'nao', motivo: 'histórico já está na odd' }),
];

/** Dupla chance. PENDENTE no doc: Score máximo simulado 39 contra régua de 40. */
const P_DC: Premissa[] = [
  P('lado_coberto_forte', 'O lado coberto é forte', 'O lado coberto não é forte', 'decide', null),
  P('equilibrio_defensivo', 'Equilíbrio defensivo', 'Sem equilíbrio defensivo', 'decide', null),
  P('adversario_limitado', 'Adversário limitado', 'O adversário não é limitado', 'decide', null),
  P('invicto_recente', 'Invicto nos últimos jogos', 'Não está invicto nos últimos jogos', 'preco', null, { motivo: 'histórico já está na odd' }),
];

/** Penalidades, por mercado. Peso negativo. */
const PEN: Record<string, Premissa[]> = {
  match_winner: [
    P('pick_empate', 'Aposta no empate', 'Não é aposta no empate', 'decide', 0, { motivo: 'suspensa até ter amostra' }),
    P('desfalque_proprio', 'O próprio time está desfalcado', 'O próprio time não tem desfalque', 'decide', -15),
  ],
  goals_over_under: [P('linha_extrema', 'Linha muito longe do normal', 'A linha não está longe do normal', 'decide', -10)],
  asian_handicap: [P('handicap_alto', 'Handicap muito alto', 'O handicap não é alto', 'decide', 0, { motivo: 'efeito zero nos dois testes' })],
  btts: [],
  double_chance: [],
};

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
export function outcomeLabel(market: string, outcome: string, home: string, away: string, line: number | null): string {
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
    const daSaida = line != null ? (outcome === 'Away' ? -line : line) : null;
    const time = outcome === 'Home' ? home : away;
    return daSaida != null ? `${time} ${daSaida > 0 ? '+' : '−'}${fmtLinha(Math.abs(daSaida))}` : time;
  }
  if (market === 'btts') return outcome === 'Yes' ? 'Os dois marcam' : 'Não marcam os dois';
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
export function melhorCandidato(
  rows: FutebolFixturePremissas[],
  market: string,
): FutebolFixturePremissas | null {
  const doMercado = rows
    .filter((r) => r.market === market)
    // Handicap zero nunca acende premissa (as 7 são de favorito ou de azarão) e o doc
    // manda excluir explicitamente em vez de deixar sumir em silêncio.
    .filter((r) => !(market === 'asian_handicap' && r.line_value === 0));
  if (!doMercado.length) return null;
  const nota = (r: FutebolFixturePremissas) => contaQueValem(market, r.acesas);
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

export function contaQueValem(market: string, acesas: string[]): number {
  return acesas.filter((s) => {
    const p = premissaDe(market, s);
    // Mercado pendente (peso null) conta, porque ali ainda não houve corte.
    return p != null && (p.peso == null || p.peso > 0);
  }).length;
}

// ── Vocabulário do Protótipo 1b (Claude Design) ─────────────────────────────
// O número do peso não vai à tela: vira palavra. E as premissas apagadas não são
// uma lista única — são três estados que nunca se misturam: não aconteceu neste
// jogo, não conta neste mercado (o preço já cobra), e não avaliada (mercado sem
// calibragem, caso do BTTS e da dupla chance).

/** Peso da premissa em palavra, no lugar da cifra interna da fórmula. */
export function pesoPalavra(p: Premissa): string {
  if (p.peso == null) return 'Peso a calibrar';
  if (p.peso >= 10) return 'Pesa muito';
  if (p.peso >= 5) return 'Pesa';
  // Peso zero é o corte da recalibragem: aconteceu, mas não soma. Chamar de "pesa
  // pouco" contradizia o grupo das apagadas, que diz "não conta neste mercado".
  if (p.peso === 0) return 'Não conta';
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
export function ladoDaSaidaNoMercado(market: string, outcome: string, line: number | null): LadoPremissa | null {
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
 * `acesas` entra como rede de segurança: se o mart algum dia acender uma premissa do
 * outro lado, ela continua aparecendo em vez de sumir da tela em silêncio.
 */
export function premissasDaSaida(
  m: MercadoInfo,
  outcome: string,
  line: number | null,
  acesas: string[] = [],
): Premissa[] {
  const lado = ladoDaSaidaNoMercado(m.slug, outcome, line);
  const acesasSet = new Set(acesas);
  return m.premissas.filter(
    (p) =>
      !PREMISSAS_OCULTAS.has(p.slug) &&
      (lado == null || p.lado == null || p.lado === lado || acesasSet.has(p.slug)),
  );
}

// As premissas do outro lado não viram lista: a tela mostra os dois lados como
// cards e o usuário troca de lado clicando. Listar os espelhos ("defesas frágeis"
// embaixo de uma análise de "defesas firmes") fazia a tela se contradizer, mesmo
// sem número, porque o rótulo já é a negação do que está sendo afirmado ao lado.
