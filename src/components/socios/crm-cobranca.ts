import { diasEntre } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { primeiroNome } from './crm-ficha';

// ============================================================================
// Cobrar quem está com assinatura dada na mão
// ============================================================================
// Uma assinatura manual não renova sozinha: ela vence e alguém precisa falar
// com a pessoa antes disso. Este módulo é o texto dessa conversa.
//
// Os modelos vivem aqui, e não no banco, pela mesma razão dos de abordagem:
// mudar copy vira commit, com revisão e histórico. E, como lá, nenhum deles usa
// travessão — a mensagem é colada no WhatsApp, e ninguém escreve assim lá.
// ============================================================================

/**
 * Em que pé está o prazo de uma assinatura manual.
 *
 * Três estados, e não um número com sinal. "Vence em 0 dias" é frase de
 * máquina, e o dia do vencimento é uma conversa diferente das outras duas: é o
 * último dia de acesso, nem futuro nem passado.
 */
export type Prazo =
  { tipo: 'a_vencer'; dias: number } | { tipo: 'hoje' } | { tipo: 'vencida'; dias: number };

export function prazoDe(vence: string, hoje: string): Prazo {
  const dias = diasEntre(hoje, vence);
  if (dias === 0) return { tipo: 'hoje' };
  if (dias > 0) return { tipo: 'a_vencer', dias };
  return { tipo: 'vencida', dias: -dias };
}

const diasEmPalavras = (dias: number) => `${dias} ${dias === 1 ? 'dia' : 'dias'}`;

/**
 * A mensagem para cobrar alguém, pronta para copiar.
 *
 * O texto muda com o prazo porque a conversa muda. Mandar "vai até o dia 20"
 * para quem perdeu o acesso na semana passada é a mensagem chegando depois do
 * fato, e quem lê percebe que ninguém olhou antes de escrever.
 *
 * Ela NÃO inventa link de pagamento nem valor: quem sabe o preço combinado é o
 * sócio, e um número errado numa cobrança é pior que nenhum.
 */
export function mensagemDeCobranca(
  nome: string | null,
  plano: string,
  vence: string,
  prazo: Prazo,
): string {
  const primeiro = primeiroNome(nome);
  const saudacao = primeiro ? `Oi, ${primeiro}!` : 'Oi!';
  const dia = formatarDia(vence);

  if (prazo.tipo === 'vencida') {
    return (
      `${saudacao} Seu acesso ao ${plano} encerrou em ${dia}, faz ${diasEmPalavras(prazo.dias)}. ` +
      'Quer retomar? Eu já deixo tudo de volta no ar e te passo como seguir.'
    );
  }

  if (prazo.tipo === 'hoje') {
    return (
      `${saudacao} Hoje é o último dia do seu acesso ao ${plano}. Quer seguir com a gente? ` +
      'Me avisa que eu te passo como renovar e você não fica sem nada.'
    );
  }

  return (
    `${saudacao} Seu acesso ao ${plano} vai até ${dia}, daqui a ${diasEmPalavras(prazo.dias)}. ` +
    'Queria saber se você quer seguir com a gente pra eu já deixar tudo acertado antes de vencer.'
  );
}
