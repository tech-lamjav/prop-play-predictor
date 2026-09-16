import { addDays, brtDayOf, diasEntre } from '@/utils/futebol-datas';
import { ehAssinante, type Cadastro } from './crm-lista';
import { ganchoDe, type Gancho } from './crm-ficha';
import { etapaDe, type EtapasGravadas } from './crm-funil';
import { ETAPAS, ETAPA_PADRAO, ROTULO_DA_ETAPA, type Etapa } from './crm-vocabulario';
import {
  diasDeTesteRestantes,
  etiquetaDe,
  ETIQUETAS,
  ultimoDiaDoTeste,
  type Etiqueta,
} from './crm-etiquetas';
import { temWhatsApp } from './crm-mensagens';

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
 * As seis são a etapa MANUAL, movida por um sócio, e `assinante` é o DESTINO,
 * que o banco responde sozinho. A escada é esta:
 *
 *   Novo → Primeiro contato → Nutrindo → Boletada → Interesse → Assinante
 *                                                            ↘ Sem resposta
 *
 * "Assinante" não é etapa manual porque ninguém arrasta alguém para lá: a
 * pessoa chega pagando. Etapa manual para o que o banco sabe nasce
 * desatualizada — alguém esquece de mover quando a assinatura cai, e a tela
 * passa a mentir.
 *
 * ⚠️ "Em teste" SAIU daqui, e virou etiqueta em `crm-etiquetas.ts`. Ele nunca
 * foi etapa de conversa: estar em teste é fato do produto e não diz nada sobre
 * até onde a conversa chegou. Enquanto era posição, ele VENCIA a etapa manual
 * na tela, então quem estava em teste aparecia como "Em teste" e a etapa ficava
 * invisível — e quem está em teste é o lead mais quente que existe. Era
 * justamente ali que a conversa se perdia.
 */
/** A única que o banco responde sozinho, e é o fim da escada. */
const CALCULADAS = ['assinante'] as const;

export type Posicao = Etapa | (typeof CALCULADAS)[number];

/**
 * As posições derivam das ETAPAS em vez de redigitá-las: com duas listas, somar
 * uma etapa exigiria lembrar da segunda, e esquecer não quebraria nada — a
 * posição simplesmente não apareceria no funil.
 *
 * "Sem resposta" sai do meio e volta para o fim: assinar acontece ANTES de
 * alguém desistir, e o funil desenha a ordem em que as coisas acontecem.
 */
export const POSICOES: readonly Posicao[] = [
  ...ETAPAS.filter((e) => e !== 'sem_resposta'),
  ...CALCULADAS,
  'sem_resposta',
];

export const ROTULO_DA_POSICAO: Record<Posicao, string> = {
  ...ROTULO_DA_ETAPA,
  assinante: 'Assinante',
};

/** A que o banco responde. A tela marca essa como calculada. */
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
 * gente até lá. "Sem resposta" fica cinza, fora da escala, porque não é uma
 * posição mais funda do funil: é sair dele.
 */
export const TOM_DA_POSICAO: Record<Posicao, string> = {
  novo: 'bg-forest/20',
  primeiro_contato: 'bg-forest/40',
  nutrindo: 'bg-forest/55',
  boletada: 'bg-forest/70',
  interesse: 'bg-forest/85',
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
   * Onde ele aparece no funil: a etapa, ou `assinante` se já chegou lá.
   *
   * Assinar VENCE a etapa manual: quem já paga não está sentado em "interesse",
   * e mostrá-lo nos dois faria o funil somar duas vezes a mesma pessoa. A etapa
   * continua guardada no banco, para quando a assinatura cair e a conversa
   * precisar ser retomada de onde parou.
   *
   * Estar em teste NÃO vence nada: é etiqueta, e a etapa de quem está em teste
   * é justamente a que mais importa.
   */
  posicao: Posicao;
  /**
   * O que o produto diz sobre a pessoa, num eixo SEPARADO da etapa.
   *
   * Nula para quem nunca testou, que é a maior parte da base. As duas valem ao
   * mesmo tempo de propósito: alguém pode estar em teste E em nutrição, e essas
   * são duas informações diferentes sobre a mesma pessoa. Enquanto "em teste"
   * era posição do funil, ele vencia a etapa e a escondia.
   */
  etiqueta: Etiqueta | null;
  /**
   * O último dia em que a pessoa ainda entra pelo teste, e quantos dias faltam
   * contando hoje. Nulos para quem nunca testou.
   *
   * Vêm montados no lead, e não calculados na tela, porque a linha da tabela, o
   * cartão do kanban e a ficha mostram o mesmo prazo: três contas do mesmo dia
   * divergiriam na virada da meia-noite, que é justamente quando ele importa.
   */
  fimDoTeste: string | null;
  diasDeTeste: number | null;
  /**
   * Não dá para abordar esta pessoa por WhatsApp.
   *
   * ⚠️ É a UNIÃO de dois caminhos, e não só o campo do cadastro:
   *
   *   · o número não abre conversa — vazio, curto, ou sem código do país, que é
   *     exatamente a regra do botão da ficha, em `temWhatsApp`;
   *   · o sócio marcou na mão — o número está lá, bem formado, e não leva à
   *     pessoa. É o caso que o cadastro não tem como enxergar sozinho.
   *
   * Fato do cadastro, num eixo separado da etapa: quem está sem número continua
   * tendo a etapa que tem. Como posição do funil, ele engoliria a etapa de todo
   * mundo que está sem número — o mesmo erro que já escondeu 59 leads quando
   * "em teste" era etapa.
   */
  semWhatsApp: boolean;
  /**
   * A marca veio da mão do sócio, e não do número.
   *
   * Separado do de cima porque as duas origens pedem reações diferentes: um
   * cadastro a completar não é a mesma coisa que uma decisão que alguém tomou e
   * que dá para desfazer.
   */
  marcadoSemWhatsApp: boolean;
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

/**
 * O destino, se a pessoa já chegou nele; senão, a etapa da conversa.
 *
 * Só assinante ganha da etapa manual, e ele ganha porque é o fim da escada:
 * quem paga não está mais sendo convencido. O teste gratuito NÃO entra nesta
 * conta — ele é etiqueta, e quem está em teste continua tendo a etapa que tem,
 * porque a conversa com essa pessoa é a mais importante de todas.
 */
function posicaoDe(c: Cadastro, etapa: Etapa): Posicao {
  return ehAssinante(c) ? 'assinante' : etapa;
}

/** Os ids que o sócio marcou na mão. Vazio é "ninguém", e não "não sei". */
export type MarcadosSemWhatsApp = ReadonlySet<string>;

const NINGUEM: MarcadosSemWhatsApp = new Set<string>();

export function montarLeads(
  cadastros: Cadastro[],
  etapas: EtapasGravadas,
  toques: Toques,
  /** Nulo quando a consulta de apostas falhou — e isso NÃO é o mesmo que zero. */
  apostas: Apostas | null,
  hoje: string,
  /**
   * Quem o sócio marcou na mão. Opcional porque a marca é acréscimo: sem ela, o
   * lead ainda sabe dizer que está sem WhatsApp pelo próprio número.
   */
  marcados: MarcadosSemWhatsApp = NINGUEM,
): Lead[] {
  return cadastros.map((c) => {
    const ultimoToque = toques[c.id] ?? null;
    const referencia = brtDayOf(ultimoToque) ?? brtDayOf(c.created_at);
    const marcado = marcados.has(c.id);

    return {
      id: c.id,
      nome: c.name?.trim() || c.email,
      email: c.email,
      whatsapp: c.whatsapp_number,
      cadastradoEm: c.created_at,
      etapa: etapaDe(etapas, c.id),
      posicao: posicaoDe(c, etapaDe(etapas, c.id)),
      // Mapa nulo é consulta que falhou, e o gancho precisa saber disso: sem
      // esta distinção, uma falha da RPC vira "conferi, não apostou" na tela.
      gancho: ganchoDe(c, apostas ? { total: apostas[c.id] ?? 0, ultima: null } : null),
      etiqueta: etiquetaDe(c, hoje),
      fimDoTeste: ultimoDiaDoTeste(c.futebol_trial_ends_at),
      diasDeTeste: diasDeTesteRestantes(c, hoje),
      semWhatsApp: marcado || !temWhatsApp(c.whatsapp_number),
      marcadoSemWhatsApp: marcado,
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
 * funil, e uma posição que some faz o desenho mentir sobre onde está o gargalo.
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

export interface GrupoDaPosicao {
  posicao: Posicao;
  leads: Lead[];
}

/**
 * Os leads agrupados, um grupo por posição do funil.
 *
 * Todas as oito, inclusive as vazias — pelo mesmo motivo da faixa: o kanban
 * desenha a FORMA do funil, e uma posição que some esconde onde está o gargalo.
 *
 * A ordem dentro do grupo é a de quem chegou: a lista já vem ordenada de quem
 * chama, e reordenar aqui faria o kanban discordar da tabela com os mesmos
 * filtros ligados.
 */
export function agruparPorPosicao(leads: Lead[]): GrupoDaPosicao[] {
  const porPosicao = new Map<Posicao, Lead[]>(POSICOES.map((p) => [p, []]));
  for (const lead of leads) porPosicao.get(lead.posicao)?.push(lead);
  return POSICOES.map((posicao) => ({ posicao, leads: porPosicao.get(posicao) ?? [] }));
}

/**
 * Um recorte de datas de cadastro, em dias de Brasília.
 *
 * As duas pontas são opcionais e INCLUSIVAS. Nulo dos dois lados é "tudo", e
 * não "nada": o filtro nasce desligado, e um estado que esconde a base inteira
 * pareceria uma tela quebrada.
 */
export interface Periodo {
  /** `YYYY-MM-DD`, ou nulo para sem começo. */
  de: string | null;
  /** `YYYY-MM-DD`, ou nulo para sem fim. */
  ate: string | null;
}

/**
 * "Os últimos N dias", contados de hoje para trás.
 *
 * N dias INCLUINDO hoje, e é por isso que o recuo é `n - 1`: "os últimos 7
 * dias" com `addDays(hoje, -7)` devolveria oito dias. O erro não aparece na
 * tela — a lista só fica um pouco maior do que deveria.
 */
export function periodoDosUltimos(dias: number, hoje: string): Periodo {
  return { de: addDays(hoje, -(dias - 1)), ate: hoje };
}

/**
 * Os leads cadastrados dentro do período.
 *
 * Quem não tem data de cadastro SOME quando há período, e fica quando não há.
 * Ele não é recente nem antigo: é desconhecido, e deixá-lo passar faria "quem
 * chegou esta semana" incluir gente sem data nenhuma.
 *
 * A comparação é entre dias de Brasília, e não entre carimbos: um cadastro das
 * duas da manhã em Greenwich é do dia anterior aqui, e comparar o carimbo cru
 * o jogaria para o dia seguinte — sumindo do filtro de hoje.
 */
export function filtrarPorPeriodo(leads: Lead[], periodo: Periodo): Lead[] {
  if (!periodo.de && !periodo.ate) return leads;

  return leads.filter((lead) => {
    const dia = brtDayOf(lead.cadastradoEm);
    if (!dia) return false;
    if (periodo.de && dia < periodo.de) return false;
    if (periodo.ate && dia > periodo.ate) return false;
    return true;
  });
}

/**
 * Quantos leads em cada etiqueta.
 *
 * Quem não tem etiqueta não entra em nenhuma contagem, e não existe contagem de
 * "sem etiqueta": ela seria a maior de todas e não diria nada. O que a faixa de
 * etiquetas responde é quantos estão em cada situação de teste, e o silêncio é
 * o normal da base.
 */
export function contarPorEtiqueta(leads: Lead[]): Record<Etiqueta, number> {
  const contagem = Object.fromEntries(ETIQUETAS.map((e) => [e, 0])) as Record<Etiqueta, number>;
  for (const lead of leads) if (lead.etiqueta) contagem[lead.etiqueta] += 1;
  return contagem;
}

/**
 * Os leads de uma etiqueta.
 *
 * Nulo devolve todos, e não nenhum: o filtro nasce desligado, e desligado tem
 * de ser "tudo". A mesma regra do filtro de período.
 */
export function filtrarPorEtiqueta(leads: Lead[], etiqueta: Etiqueta | null): Lead[] {
  return etiqueta ? leads.filter((l) => l.etiqueta === etiqueta) : leads;
}

/**
 * Quem a gente não consegue abordar por WhatsApp.
 *
 * ⚠️ Não é "campo vazio". A regra é a mesma que decide se o botão de WhatsApp
 * aparece na ficha, em `temWhatsApp`: um telefone sem código do país está
 * preenchido e não abre conversa nenhuma. Duas definições fariam a lista
 * prometer gente que a ficha não consegue abrir.
 *
 * É recorte da lista, e NÃO posição do funil. Não ter número é fato do
 * cadastro, e a pessoa continua tendo a etapa que tem — é a mesma separação que
 * tirou "em teste" do funil. Como posição, ela engoliria a etapa de todo mundo
 * que está sem número.
 */
export function semWhatsApp(leads: Lead[]): Lead[] {
  return leads.filter((l) => l.semWhatsApp);
}

/**
 * A lista sem quem não dá para abordar.
 *
 * O contrário de `semWhatsApp`, e é este que o dia a dia usa: o pedido foi
 * "esses eu não consigo fazer nada, quero que saiam da lista quando eu estou
 * trabalhando". Mostrar a pilha é a exceção; escondê-la é o uso.
 */
export function escondeSemWhatsApp(leads: Lead[]): Lead[] {
  return leads.filter((l) => !l.semWhatsApp);
}
