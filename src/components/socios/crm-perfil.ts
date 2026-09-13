// ============================================================================
// Como uma pessoa aposta
// ============================================================================
// Serve para estudar os power users. Os números da base, quando isto foi
// escrito: 110 pessoas já apostaram na história toda, seis apostaram nos
// últimos trinta dias, e sete concentram 78% de todas as apostas. Levei ao
// Victor que um ROI por pessoa seria estatisticamente vazio para quase todos, e
// a resposta foi que é justamente por isso que vale — são os sete que
// interessam estudar.
//
// ⚠️ O ROI É DA PESSOA, e não nosso. Nas palavras dele: "o ROI é de cada
// usuário nosso, não temos culpa da performance dele, na verdade é até uma
// forma de a gente abordar o cara". Quem está perdendo é conversa, não
// problema: é a abertura para oferecer o produto que ajuda. A tela mostra o
// número sem adjetivo, e quem decide o que fazer com ele é quem vai falar.
//
// ⚠️ O N ANDA JUNTO DE TODO NÚMERO. "Aposta mais em Over/Under" é uma frase que
// mente quando a pessoa tem três apostas. Com o N, a tela diz "2 de 3" e quem
// lê decide se aquilo é perfil ou coincidência.
// ============================================================================

/** Um recorte como o banco devolve, dentro do `jsonb`. */
export interface RecorteDoBanco {
  nome: string;
  n: number;
  apostado: number | string;
  lucro: number | string;
  /** Só as faixas de odd trazem ordem: elas têm uma sequência natural. */
  ordem?: number;
}

/** A linha que `crm_perfil_de_aposta` devolve. */
export interface PerfilDoBanco {
  total: number;
  liquidadas: number;
  primeira: string | null;
  ultima: string | null;
  apostado: number | string;
  lucro: number | string;
  por_esporte: RecorteDoBanco[] | null;
  por_mercado: RecorteDoBanco[] | null;
  por_faixa_de_odd: RecorteDoBanco[] | null;
}

export interface Recorte {
  nome: string;
  /** Quantas apostas, liquidadas ou não. É o que dá tamanho ao número. */
  n: number;
  apostado: number;
  lucro: number;
  /** Nulo quando não há nada liquidado: dividir por zero não é zero por cento. */
  roi: number | null;
}

export interface Perfil {
  total: number;
  /** Quantas já terminaram. O resto está em aberto e não entra em conta de dinheiro. */
  liquidadas: number;
  primeira: string | null;
  ultima: string | null;
  apostado: number;
  lucro: number;
  roi: number | null;
  porEsporte: Recorte[];
  porMercado: Recorte[];
  porFaixaDeOdd: Recorte[];
}

/**
 * Lucro sobre o que foi apostado, em porcentagem.
 *
 * ⚠️ Nulo, e não zero, quando não há nada liquidado. Zero por cento é uma
 * afirmação — "apostou e empatou" — e quem tem só apostas em aberto não
 * afirmou nada ainda. Perto de 72% das apostas da base ficam em `pending` para
 * sempre, então este caso é a regra, não a exceção.
 */
export function roiDe(lucro: number, apostado: number): number | null {
  if (!apostado) return null;
  return (lucro / apostado) * 100;
}

function comoNumero(v: number | string | null | undefined): number {
  // `numeric` chega como texto no PostgREST, e somar texto concatena.
  return v === null || v === undefined ? 0 : Number(v);
}

function montarRecortes(linhas: RecorteDoBanco[] | null): Recorte[] {
  return (linhas ?? []).map((l) => {
    const apostado = comoNumero(l.apostado);
    const lucro = comoNumero(l.lucro);
    return { nome: l.nome, n: l.n, apostado, lucro, roi: roiDe(lucro, apostado) };
  });
}

/**
 * Do recorte com mais apostas para o com menos.
 *
 * ⚠️ A ordenação acontece AQUI, e não no SQL, de propósito. A função do banco
 * ordena os esportes por `x->>'lucro'`, que compara o número como TEXTO: "9"
 * vem depois de "100", e um prejuízo de "-50" vai para o topo. Ordenar na tela
 * é onde o teste é barato e onde a ordem é decisão de leitura, não de
 * armazenamento.
 */
function porTamanho(a: Recorte, b: Recorte): number {
  return a.n === b.n ? a.nome.localeCompare(b.nome, 'pt-BR') : b.n - a.n;
}

export function montarPerfil(linha: PerfilDoBanco): Perfil {
  const apostado = comoNumero(linha.apostado);
  const lucro = comoNumero(linha.lucro);

  return {
    total: linha.total,
    liquidadas: linha.liquidadas,
    primeira: linha.primeira,
    ultima: linha.ultima,
    apostado,
    lucro,
    roi: roiDe(lucro, apostado),
    porEsporte: montarRecortes(linha.por_esporte).sort(porTamanho),
    porMercado: montarRecortes(linha.por_mercado).sort(porTamanho),
    // As faixas têm sequência própria: de 1.50 para cima, e não da mais usada
    // para a menos. Fora de ordem, elas deixam de ser uma distribuição.
    porFaixaDeOdd: montarRecortes(linha.por_faixa_de_odd).sort(
      (a, b) => ordemDaFaixa(a.nome) - ordemDaFaixa(b.nome),
    ),
  };
}

/**
 * A sequência das faixas de odd, pelo nome.
 *
 * Elas vêm do banco com um campo `ordem`, mas ele chega dentro do `jsonb` e a
 * consulta ordena por ele como texto. O nome é o que sobra de estável, e as
 * seis faixas são fechadas: são as mesmas do painel do próprio usuário, em
 * `aggregateOddsDistribution`.
 */
const SEQUENCIA_DAS_FAIXAS = [
  'até 1.50',
  '1.50 a 1.99',
  '2.00 a 2.99',
  '3.00 a 4.99',
  '5.00 a 9.99',
  '10.00 ou mais',
];

function ordemDaFaixa(nome: string): number {
  const i = SEQUENCIA_DAS_FAIXAS.indexOf(nome);
  // Faixa desconhecida vai para o fim em vez de para o começo: se um dia o SQL
  // mudar os nomes, a tela fica estranha no rodapé e não mente no topo.
  return i < 0 ? SEQUENCIA_DAS_FAIXAS.length : i;
}

/**
 * Onde a pessoa mais aposta, ou nulo quando não há em que se apoiar.
 *
 * Por QUANTIDADE, e não por lucro: a pergunta é "como essa pessoa aposta", e
 * quem responde isso é onde ela vai mais vezes. O maior lucro costuma ser uma
 * aposta grande que deu certo.
 */
export function principal(recortes: Recorte[]): Recorte | null {
  return recortes.length > 0 ? recortes[0] : null;
}

/**
 * Quantas apostas bastam para um recorte descrever alguém.
 *
 * Cinco não tem ciência nenhuma por trás: é o ponto em que "aposta mais em
 * Over/Under" para de soar como coincidência para quem lê. Abaixo disso a tela
 * continua mostrando o número — ela só não o chama de perfil.
 */
export const MINIMO_PARA_PERFIL = 5;

export function ehPerfil(recorte: Recorte | null): boolean {
  return recorte !== null && recorte.n >= MINIMO_PARA_PERFIL;
}

/** `12.345` → `+12,3%`. O sinal é explícito: menos e mais mudam a conversa. */
export function emPorcento(roi: number): string {
  const sinal = roi > 0 ? '+' : '';
  return `${sinal}${roi.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/** `2 de 3`, e nunca `2` sozinho. */
export function comOTotal(n: number, total: number): string {
  return `${n} de ${total}`;
}
