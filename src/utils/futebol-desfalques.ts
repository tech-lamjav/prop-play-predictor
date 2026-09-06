// ============================================================
// futebol-desfalques.ts — como a tela nomeia quem está fora
// ============================================================
// A fonte manda o motivo em inglês, e a tela mostrava cru: "Muscle Injury",
// "Knee Injury", "Red Card". Existia um tradutor dentro da página do jogo, mas
// ele não era usado por lugar nenhum — foi escrito para isso e nunca ligado.
//
// A tabela abaixo sai da base, e não de palpite. Contados nos jogos de hoje e
// nos últimos de cada time: Injury 11, Muscle Injury 11, Knee Injury 11, Yellow
// Cards 9, Inactive 5, Ankle 3, Thigh 3, Calf 2, e um cada de Red Card, Broken
// Leg, Lower Back, Hamstring, Health problems e Illness.
//
// O tradutor antigo colapsava toda lesão num "Lesão" só, com um `/injury/i`.
// Aqui a parte do corpo fica: quem lê pesa diferente uma panturrilha e um
// joelho, e essa é justamente a leitura que o desfalque serve.
// ============================================================

const MOTIVO_PT: Record<string, string> = {
  // Lesões, com a parte do corpo preservada.
  Injury: 'Lesão',
  'Muscle Injury': 'Lesão muscular',
  'Knee Injury': 'Lesão no joelho',
  'Ankle Injury': 'Lesão no tornozelo',
  'Thigh Injury': 'Lesão na coxa',
  'Calf Injury': 'Lesão na panturrilha',
  'Hamstring Injury': 'Lesão na posterior da coxa',
  'Lower Back Injury': 'Lesão lombar',
  'Groin Injury': 'Lesão na virilha',
  'Shoulder Injury': 'Lesão no ombro',
  'Foot Injury': 'Lesão no pé',
  'Broken Leg': 'Perna quebrada',

  // Fora por saúde, sem ser lesão de jogo.
  Illness: 'Doença',
  'Health problems': 'Problema de saúde',

  // Fora por decisão ou regra. Cartão vira SUSPENSO, que é o que muda para quem
  // aposta — "cartões amarelos" descreve a causa, e não o efeito.
  'Yellow Cards': 'Suspenso',
  'Red Card': 'Suspenso',
  Suspended: 'Suspenso',
  Inactive: 'Inativo',
  Rest: 'Poupado',
  "Coach's decision": 'Decisão técnica',
  'Loan agreement': 'Empréstimo',
  'National selection': 'Seleção',
  'Personal problems': 'Motivo pessoal',
};

/**
 * O motivo em português, ou null quando não veio motivo nenhum.
 *
 * Motivo desconhecido sai CRU, e não sumido nem traduzido por adivinhação: assim
 * ele aparece na tela, alguém repara, e a tabela cresce. Some, e ninguém fica
 * sabendo que faltou.
 */
export function motivoDoDesfalque(motivo: string | null | undefined): string | null {
  if (!motivo) return null;
  if (MOTIVO_PT[motivo]) return MOTIVO_PT[motivo];
  // Rede para a parte do corpo que a fonte inventar amanhã: pelo menos diz que
  // é lesão, em vez de mostrar inglês.
  if (/injur/i.test(motivo)) return 'Lesão';
  return motivo;
}

/**
 * O jogador é dúvida, ou está fora?
 *
 * Os dois únicos valores na base são 'Questionable' e 'Missing Fixture'. O que
 * não conhecemos cai em FORA de propósito: anunciar dúvida sobre quem está fora
 * é o erro que custa aposta, e não o contrário.
 */
export function estaEmDuvida(tipo: string | null | undefined): boolean {
  return tipo === 'Questionable';
}
