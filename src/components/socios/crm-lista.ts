import { brtDayOf } from '@/utils/futebol-datas';

// ============================================================================
// A lista de cadastros, agrupada por dia
// ============================================================================
// Tudo aqui é função pura sobre linhas do banco. O que a tela faz é desenhar.
//
// As datas vêm de `utils/futebol-datas`, e o nome do arquivo mente sobre o
// alcance: `brtDayOf` e `addDays` não têm nada de futebol, são a conversão de
// carimbo do banco para dia de Brasília. Copiá-las para cá seria repetir
// exatamente o erro que aquele arquivo existe para ter consertado — ele nasceu
// porque duas telas tinham cópias que divergiam justamente em qual é "o dia".
// A separação está registrada na issue #398.
// ============================================================================

/**
 * Uma linha da tabela de usuários, contada pelo dia em que nasceu.
 *
 * Só os campos que a lista usa. Trazer a linha inteira do banco carregaria
 * token de sincronia e identificador do Stripe para dentro do navegador sem
 * nenhuma tela precisar deles.
 */
export interface Cadastro {
  id: string;
  name: string | null;
  email: string;
  whatsapp_number: string | null;
  created_at: string | null;
  betinho_subscription_status: string | null;
  futebol_subscription_status: string | null;
  analytics_subscription_status: string | null;
  // Os quatro abaixo existem para o GANCHO, que a lista agora também calcula.
  // Não são sensíveis e a consulta já vinha larga; o que eles evitam é chamar
  // a ficha de cada pessoa para descobrir o que atraiu ela.
  telegram_synced: boolean | null;
  subscription_product_type: string | null;
  futebol_trial_started_at: string | null;
  futebol_publication_alerts_ack_at: string | null;
}

export interface DiaDe<T> {
  /** `YYYY-MM-DD` em Brasília, ou `null` para o grupo dos sem data. */
  dia: string | null;
  itens: T[];
}

/**
 * Agrupa pelo dia de Brasília, do mais recente para o mais antigo.
 *
 * Ordenar aqui, e não confiar no `order by` da consulta, é o que impede que
 * mexer na consulta reordene a tela sem nenhum teste acender.
 *
 * Genérica no item, e recebendo o carimbo por função, porque o painel agrupa
 * DUAS coisas diferentes: cadastros crus e leads já montados. Uma segunda
 * implementação divergiria no ponto que mais importa — qual é "o dia" —, que é
 * exatamente o erro que `utils/futebol-datas` existe para ter consertado.
 *
 * Dias sem item não viram grupo: a lista é o registro do que aconteceu, e não
 * um calendário com buracos desenhados.
 *
 * Quem não tem data cai num grupo próprio, no fim. O carimbo é anulável no
 * banco, e descartar a linha esconderia uma pessoa real do painel — o pior
 * desfecho possível num CRM.
 */
export function agruparPorDia<T extends { id: string }>(
  itens: T[],
  carimbo: (item: T) => string | null,
): DiaDe<T>[] {
  // O desempate pelo identificador não é preciosismo: dois cadastros com o
  // mesmo carimbo não têm ordem garantida pelo Postgres, e a lista trocaria de
  // ordem entre dois carregamentos sem nada ter mudado.
  const maisRecentePrimeiro = (a: T, b: T) => {
    const ca = carimbo(a) ?? '';
    const cb = carimbo(b) ?? '';
    if (ca !== cb) return cb.localeCompare(ca);
    return a.id.localeCompare(b.id);
  };

  const porDia = new Map<string, T[]>();
  const semData: T[] = [];

  for (const item of [...itens].sort(maisRecentePrimeiro)) {
    const dia = brtDayOf(carimbo(item));
    if (!dia) {
      semData.push(item);
      continue;
    }
    const grupo = porDia.get(dia);
    if (grupo) grupo.push(item);
    else porDia.set(dia, [item]);
  }

  const dias = [...porDia.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dia, doDia]) => ({ dia, itens: doDia }));

  return semData.length ? [...dias, { dia: null, itens: semData }] : dias;
}

/** Minúsculas e sem acento — quem procura "joao" tem de achar "João". */
const achatar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Só os dígitos. O banco guarda o número cru; quem procura copia com máscara. */
const soDigitos = (texto: string) => texto.replace(/\D/g, '');

/**
 * Filtra por nome, e-mail ou telefone.
 *
 * Busca em branco devolve tudo, e não nada: o campo vazio é o estado normal da
 * tela, não um filtro que esconde a base.
 */
export function buscar(cadastros: Cadastro[], termo: string): Cadastro[] {
  const alvo = achatar(termo.trim());
  if (!alvo) return cadastros;

  const digitos = soDigitos(termo);

  return cadastros.filter((c) => {
    if (c.name && achatar(c.name).includes(alvo)) return true;
    if (achatar(c.email).includes(alvo)) return true;
    // Só compara telefone quando o termo tem dígito, senão uma busca por letra
    // casaria com todo mundo pelo lado do número vazio.
    if (digitos && c.whatsapp_number && soDigitos(c.whatsapp_number).includes(digitos)) return true;
    return false;
  });
}

/**
 * Assinante é quem tem qualquer um dos três acessos em premium.
 *
 * Os três, e não o nome do plano: o plano é cumulativo e cada degrau liga um
 * conjunto de acessos, então é o acesso que diz se a pessoa está pagando hoje.
 * Está tudo explicado em `shared/concessoes.ts`.
 */
export function ehAssinante(c: Cadastro): boolean {
  return (
    c.betinho_subscription_status === 'premium' ||
    c.futebol_subscription_status === 'premium' ||
    c.analytics_subscription_status === 'premium'
  );
}

/** `2026-09-10` → `10/09/2026`. */
export function formatarDia(dia: string): string {
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}
