import type { TipoDeGancho } from './crm-ficha';
import { type Etapa } from './crm-vocabulario';

// ============================================================================
// As mensagens prontas
// ============================================================================
// Os modelos vivem no repositório, e não no banco: mudar copy vira commit, com
// revisão e histórico, em vez de uma escrita em produção que ninguém revisou.
//
// A escolha é por PAR de gancho e etapa, com UM degrau de queda: o par exato, e
// depois o texto da etapa. Não há terceiro degrau, e não há texto neutro:
// `POR_ETAPA` cobre todas as etapas por tipo, então "nunca cair num vazio" é
// garantia do compilador, e não de um `??` no fim da linha. A primeira versão
// tinha um neutro declarado que nenhuma entrada alcançava — código morto com
// cara de rede de segurança.
//
// O gancho é o que faz isto valer a pena. Foi o caso que originou o CRM: um
// assinante do Essencial cujo olho brilhou no Betinho. Falar de futebol com ele
// erraria o alvo, e o modelo é onde essa leitura vira conversa.
//
// ⚠️ O gancho é PALPITE, e o texto não pode afirmar o que ele supõe. "Vi que
// você entrou nas análises de futebol" soa como fato e pode estar errado — o
// mesmo gancho nasce de quem só leu a explicação dos alertas.
// ============================================================================

/**
 * "Oi, Maria!" ou "Oi!".
 *
 * A saudação inteira muda, e não só a lacuna. Trocar a lacuna por vazio deixa
 * "Oi, !" — o defeito clássico do modelo com buraco.
 */
function saudacao(primeiroNome: string | null): string {
  return primeiroNome ? `Oi, ${primeiroNome}!` : 'Oi!';
}

const NAO_INSISTIR = 'Não quero insistir à toa — se agora não for o momento, tudo bem.';

/**
 * O texto de cada par de etapa e gancho.
 *
 * Aninhado e tipado, e não uma chave montada como "novo:betinho": com string
 * solta, um "novo:betnho" cai calado no texto da etapa e ninguém descobre. É o
 * mesmo cuidado que a tabela de planos já tinha em `crm-ficha.ts`.
 *
 * Só os pares em que a conversa muda de verdade. O resto cai no texto da etapa.
 */
const POR_PAR: Partial<Record<Etapa, Partial<Record<TipoDeGancho, string>>>> = {
  novo: {
    betinho:
      '{saudacao} Aqui é da Smart Betting. Vi que você começou a registrar suas apostas com o ' +
      'Betinho. Queria saber o que você achou até agora — e te mostrar o resumo semanal da ' +
      'banca, que é a parte que costuma surpreender quem usa.',
    futebol:
      '{saudacao} Aqui é da Smart Betting. Queria saber se as análises de futebol estão fazendo ' +
      'sentido pra você, e te contar como a gente escolhe as oportunidades que aparecem ali.',
    nba:
      '{saudacao} Aqui é da Smart Betting. Queria saber como está sendo usar as prop bets e a ' +
      'Análise 360 da NBA, e o que ainda falta pra ficar redondo pro seu uso.',
  },

  boletada: {
    betinho:
      '{saudacao} Te mandei um bilhete esses dias. Queria saber se você chegou a registrar ele no ' +
      'Betinho — é ali que dá pra acompanhar o resultado sem ter que anotar nada na mão.',
    futebol:
      '{saudacao} Te mandei um bilhete esses dias, que saiu da leitura de futebol daquele dia. ' +
      'Queria saber o que você achou do raciocínio por trás dele.',
  },

  contatado: {
    betinho:
      '{saudacao} Passando de novo pra saber se você chegou a ver o resumo semanal da banca no ' +
      'Betinho. Se quiser, eu te mostro num print como fica depois de umas semanas registrando.',
    futebol:
      '{saudacao} Passando de novo pra saber se você acompanhou as análises de futebol dos ' +
      'últimos dias. Posso te mandar as do dia pra você comparar com o que você já pensava.',
  },

  sem_resposta: {
    betinho:
      `{saudacao} ${NAO_INSISTIR} Deixo só uma coisa: o Betinho registra e liquida suas apostas ` +
      'sozinho, e o resumo semanal da banca costuma ser o que faz a pessoa voltar. Se quiser ' +
      'retomar, é só me chamar.',
    futebol:
      `{saudacao} ${NAO_INSISTIR} Deixo só uma coisa: as análises de futebol saem todo dia antes ` +
      'dos jogos, e o teste de sete dias não custa nada. Se quiser retomar, é só me chamar.',
  },
};

/**
 * O texto de cada etapa, quando o gancho não muda a conversa.
 *
 * `Record` total de propósito: é o tipo que garante que nenhum par fique sem
 * texto. Acrescentar uma sétima etapa em `crm-vocabulario.ts` quebra a
 * compilação aqui, que é exatamente onde alguém precisa lembrar de escrever.
 */
const POR_ETAPA: Record<Etapa, string> = {
  novo:
    '{saudacao} Aqui é da Smart Betting. Vi que você se cadastrou e queria entender o que te ' +
    'trouxe até aqui, pra te mostrar a parte da plataforma que mais faz sentido pro seu caso.',
  contatado:
    '{saudacao} Passando pra saber se você chegou a explorar a plataforma depois da nossa ' +
    'última conversa. Qualquer dúvida, pode me chamar por aqui.',
  nutrindo:
    '{saudacao} Separei uma coisa que acho que vale pra você: posso te mandar a leitura de ' +
    'hoje pra você ver como a gente monta a análise por trás de uma oportunidade.',
  boletada:
    '{saudacao} Te mandei um bilhete esses dias — queria saber se você chegou a acompanhar e ' +
    'o que achou da leitura por trás dele.',
  interesse:
    '{saudacao} Retomando nossa conversa: ficou alguma dúvida sobre o que a gente falou? Se ' +
    'quiser, eu te mostro na prática antes de você decidir qualquer coisa.',
  sem_resposta:
    `{saudacao} ${NAO_INSISTIR} Deixo a porta aberta: se quiser retomar em algum momento, é só ` +
    'me chamar por aqui.',
};

/**
 * A mensagem para abordar alguém.
 *
 * Dois degraus: o par exato de etapa e gancho, e o texto da etapa. O segundo
 * nunca falha porque `POR_ETAPA` é total sobre `Etapa`.
 */
export function mensagemPara(
  gancho: TipoDeGancho,
  etapa: Etapa,
  primeiroNome: string | null,
): string {
  const modelo = POR_PAR[etapa]?.[gancho] ?? POR_ETAPA[etapa];
  return modelo.replace('{saudacao}', saudacao(primeiroNome));
}

/**
 * Mínimo de dígitos para um número virar link.
 *
 * Doze: código do país, DDD e o número. Um telefone sem DDI monta um endereço
 * que leva a outra pessoa ou a lugar nenhum, e mandar mensagem para um estranho
 * é pior que não ter botão.
 */
const MINIMO_DE_DIGITOS = 12;

/**
 * O endereço que abre o WhatsApp com o texto dentro.
 *
 * Nulo quando não há número utilizável, e quem chama esconde o botão. Boa parte
 * da base antiga não tem WhatsApp, e um link quebrado abre uma aba em branco
 * sem o sócio entender por quê.
 */
export function linkDoWhatsApp(numero: string | null | undefined, texto: string): string | null {
  const digitos = (numero ?? '').replace(/\D/g, '');
  if (digitos.length < MINIMO_DE_DIGITOS) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
