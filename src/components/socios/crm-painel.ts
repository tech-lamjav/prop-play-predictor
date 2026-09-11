import { addDays, brtDayOf } from '@/utils/futebol-datas';
import { ehAssinante, type Cadastro } from './crm-lista';
import { ganchoDe, type Gancho } from './crm-ficha';
import { etapaDe, type EtapasGravadas } from './crm-funil';
import { ETAPAS, ETAPA_PADRAO, ROTULO_DA_ETAPA, type Etapa } from './crm-vocabulario';
import { temAcessoAoFutebol } from '@/utils/futebol-acesso';

// ============================================================================
// As contas do painel
// ============================================================================
// A diferença entre uma lista e um painel de trabalho está aqui. A lista
// responde "o que aconteceu"; estas funções respondem "com quem eu falo agora".
//
// Tudo puro, sobre o que já veio do banco: cadastro, etapa, último toque e
// contagem de apostas. Quem desenha não faz conta nenhuma.
// ============================================================================

/** Quando cada pessoa recebeu o último toque — mudança de etapa ou anotação. */
export type Toques = Record<string, string | undefined>;

/** Quantas apostas cada pessoa registrou. Ausente é zero. */
export type Apostas = Record<string, number | undefined>;

/**
 * Onde o lead aparece no funil.
 *
 * As seis primeiras são a etapa MANUAL, movida por um sócio. As duas últimas o
 * banco responde sozinho, e por isso não estão no vocabulário de etapas: etapa
 * manual para o que o banco sabe nasce desatualizada — alguém esquece de mover
 * quando a assinatura cai, e a tela passa a mentir.
 *
 * A ordem é a da progressão, com `sem_resposta` fechando do outro lado.
 */
/** As duas que o banco responde sozinho. */
const CALCULADAS = ['em_teste', 'assinante'] as const;

export type Posicao = Etapa | (typeof CALCULADAS)[number];

/**
 * As posições derivam das ETAPAS em vez de redigitá-las: com duas listas, somar
 * uma etapa exigiria lembrar da segunda, e esquecer não quebraria nada — o
 * degrau simplesmente não apareceria no funil.
 *
 * "Sem resposta" sai do meio e volta para o fim: as calculadas acontecem ANTES
 * de alguém desistir, e o funil desenha a ordem em que as coisas acontecem.
 */
export const POSICOES: readonly Posicao[] = [
  ...ETAPAS.filter((e) => e !== 'sem_resposta'),
  ...CALCULADAS,
  'sem_resposta',
];

export const ROTULO_DA_POSICAO: Record<Posicao, string> = {
  ...ROTULO_DA_ETAPA,
  em_teste: 'Em teste',
  assinante: 'Assinante',
};

/** As duas que o banco responde. A tela marca essas como calculadas. */
export const POSICOES_CALCULADAS: readonly Posicao[] = CALCULADAS;

/**
 * A cor do ponto de cada posição, na tabela e no kanban.
 *
 * Uma escala de floresta que escurece conforme a conversa avança, e não oito
 * cores diferentes: a identidade tem UM acento, o âmbar, e gastá-lo em oito
 * etiquetas apagaria justamente os números do topo, que é onde ele precisa
 * gritar. A escala diz "mais adiante" sem precisar de legenda.
 *
 * As exceções são as duas pontas, e são de propósito. "Assinante" é o único que
 * ganha âmbar, porque é a linha de chegada e a tela inteira existe para levar
 * gente até lá. "Sem resposta" fica cinza, fora da escala, porque não é um
 * degrau mais fundo do funil: é sair dele.
 */
export const TOM_DA_POSICAO: Record<Posicao, string> = {
  novo: 'bg-forest/20',
  contatado: 'bg-forest/40',
  nutrindo: 'bg-forest/55',
  boletada: 'bg-forest/70',
  interesse: 'bg-forest/85',
  em_teste: 'bg-forest',
  assinante: 'bg-amber-400',
  sem_resposta: 'bg-ink-dim',
};

export interface Lead {
  id: string;
  /** O nome, ou o e-mail quando não há nome. A linha precisa de alguém nela. */
  nome: string;
  email: string;
  whatsapp: string | null;
  cadastradoEm: string | null;
  etapa: Etapa;
  gancho: Gancho;
  /**
   * Onde ele aparece no funil.
   *
   * O estado calculado VENCE a etapa manual: quem já assina não está sentado em
   * "interesse", e mostrar ele lá faria o funil somar duas vezes a mesma
   * pessoa. A etapa manual continua guardada no banco, para quando a
   * assinatura cair e a conversa precisar ser retomada de onde parou.
   */
  posicao: Posicao;
  assinante: boolean;
  /** Último toque registrado, ou nulo para quem nunca recebeu nada. */
  ultimoToque: string | null;
  /**
   * Dias desde o último toque — ou desde o cadastro, para quem nunca foi
   * tocado. O relógio do lead começa a correr quando ele chega, e não no
   * primeiro contato que nunca houve.
   *
   * Nulo só quando não há nem toque nem data de cadastro: aí não há conta a
   * fazer, e zero seria uma resposta inventada.
   */
  diasParado: number | null;
}

/** Dias inteiros entre dois dias BRT. */
function diasEntre(de: string, ate: string): number {
  const ms = Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * O estado que o banco responde, se houver.
 *
 * Assinante ganha de em teste: quem virou premium durante o teste é assinante,
 * e continuar mostrando "em teste" seria a tela atrasada em relação ao caixa.
 */
function posicaoDe(c: Cadastro, etapa: Etapa, agora: number): Posicao {
  if (ehAssinante(c)) return 'assinante';
  if (temAcessoAoFutebol(c.futebol_subscription_status, c.futebol_trial_started_at, agora))
    return 'em_teste';
  return etapa;
}

export function montarLeads(
  cadastros: Cadastro[],
  etapas: EtapasGravadas,
  toques: Toques,
  /** Nulo quando a consulta de apostas falhou — e isso NÃO é o mesmo que zero. */
  apostas: Apostas | null,
  hoje: string,
): Lead[] {
  // O relógio do teste gratuito conta em horas, e o dia BRT não basta para
  // dizer se ele ainda está de pé.
  const agora = Date.parse(`${hoje}T23:59:59Z`);
  return cadastros.map((c) => {
    const ultimoToque = toques[c.id] ?? null;
    const referencia = brtDayOf(ultimoToque) ?? brtDayOf(c.created_at);

    return {
      id: c.id,
      nome: c.name?.trim() || c.email,
      email: c.email,
      whatsapp: c.whatsapp_number,
      cadastradoEm: c.created_at,
      etapa: etapaDe(etapas, c.id),
      posicao: posicaoDe(c, etapaDe(etapas, c.id), agora),
      // Mapa nulo é consulta que falhou, e o gancho precisa saber disso: sem
      // esta distinção, uma falha da RPC vira "conferi, não apostou" na tela.
      gancho: ganchoDe(c, apostas ? { total: apostas[c.id] ?? 0, ultima: null } : null),
      assinante: ehAssinante(c),
      ultimoToque,
      diasParado: referencia ? diasEntre(referencia, hoje) : null,
    };
  });
}

/**
 * Quantos leads em cada etapa.
 *
 * Todas as seis, inclusive as vazias: a faixa do funil desenha a FORMA do
 * funil, e um degrau que some faz o desenho mentir sobre onde está o gargalo.
 */
export function contarPorPosicao(leads: Lead[]): Record<Posicao, number> {
  const contagem = Object.fromEntries(POSICOES.map((p) => [p, 0])) as Record<Posicao, number>;
  for (const lead of leads) contagem[lead.posicao] += 1;
  return contagem;
}

export interface MetricasDeNegocio {
  cadastrosNoMes: number;
  assinantes: number;
  /** Fatia da base que assina, em pontos percentuais inteiros. */
  conversao: number;
  /** Fatia da base que já saiu de "novo", em pontos percentuais inteiros. */
  abordados: number;
}

const DIAS_DO_MES = 30;

/** Percentual inteiro, com base vazia valendo zero em vez de `NaN`. */
const fatia = (parte: number, todo: number) => (todo === 0 ? 0 : Math.round((parte / todo) * 100));

/**
 * Os números de acompanhamento, no topo.
 *
 * "Abordados" é métrica de ESFORÇO, e não de resultado: mede quanto da base a
 * gente conseguiu tocar. Na fase de MVP esse é o gargalo real, e ele não
 * aparece em nenhuma métrica de conversão.
 */
export function metricasDeNegocio(leads: Lead[], hoje: string): MetricasDeNegocio {
  const inicioDoMes = addDays(hoje, -(DIAS_DO_MES - 1));

  let cadastrosNoMes = 0;
  let assinantes = 0;
  let abordados = 0;

  for (const lead of leads) {
    const dia = brtDayOf(lead.cadastradoEm);
    if (dia && dia >= inicioDoMes && dia <= hoje) cadastrosNoMes += 1;
    if (lead.assinante) assinantes += 1;
    if (lead.etapa !== ETAPA_PADRAO) abordados += 1;
  }

  return {
    cadastrosNoMes,
    assinantes,
    conversao: fatia(assinantes, leads.length),
    abordados: fatia(abordados, leads.length),
  };
}

/** A partir de quantos dias sem toque um lead do meio do funil vira cobrança. */
export const DIAS_PARA_ESTAR_PARADO = 7;

/** As duas pontas do funil: caso fechado, não é pendência de ninguém. */
const FECHADAS: Posicao[] = ['assinante', 'sem_resposta'];

/**
 * Quem precisa de atenção agora, numa lista só.
 *
 * Duas situações entram: a conversa já começada que esfriou — sem toque há uma
 * semana — e quem nunca saiu de "novo". A primeira versão desenhava as duas em
 * TABELAS separadas, com medo de a segunda enterrar a primeira, que é sempre
 * muito maior. Era medo mal colocado: a coluna de etapa já separa as duas, e
 * duas tabelas para mostrar uma diferença que a tabela já mostra é o que fazia
 * a tela parecer cinco listas.
 *
 * A ordem é que resolve o enterro: conversa esfriando vem antes de lead novo,
 * porque ela já custou trabalho. Dentro de cada grupo, o mais parado primeiro.
 *
 * As pontas do funil ficam de fora: encher a fila de casos fechados é o jeito
 * mais rápido de fazer o sócio parar de olhar a fila.
 */
export function precisamDeAtencao(leads: Lead[]): Lead[] {
  const nuncaAbordado = (l: Lead) => l.posicao === ETAPA_PADRAO;

  const esfriando = (l: Lead) =>
    !nuncaAbordado(l) &&
    !FECHADAS.includes(l.posicao) &&
    (l.diasParado ?? 0) >= DIAS_PARA_ESTAR_PARADO;

  return leads
    .filter((l) => esfriando(l) || nuncaAbordado(l))
    .sort((a, b) => {
      // Esfriando antes de novo. `Number` sobre o booleano porque a ordenação
      // precisa de número, e `false` tem de vir depois de `true`.
      const prioridade = Number(esfriando(b)) - Number(esfriando(a));
      if (prioridade !== 0) return prioridade;
      return (b.diasParado ?? 0) - (a.diasParado ?? 0);
    });
}

export interface ColunaDoFunil {
  posicao: Posicao;
  leads: Lead[];
}

/**
 * Os leads em colunas, uma por posição do funil.
 *
 * Todas as oito, inclusive as vazias — pelo mesmo motivo da faixa: o kanban
 * desenha a FORMA do funil, e uma coluna que some esconde onde está o gargalo.
 *
 * A ordem dentro da coluna é a de quem chegou: a lista já vem ordenada de quem
 * chama, e reordenar aqui faria o kanban discordar da tabela com os mesmos
 * filtros ligados.
 */
export function agruparPorPosicao(leads: Lead[]): ColunaDoFunil[] {
  const porPosicao = new Map<Posicao, Lead[]>(POSICOES.map((p) => [p, []]));
  for (const lead of leads) porPosicao.get(lead.posicao)?.push(lead);
  return POSICOES.map((posicao) => ({ posicao, leads: porPosicao.get(posicao) ?? [] }));
}
