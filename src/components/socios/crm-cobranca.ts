import { diasEntre } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { primeiroNome, saudacao as saudacaoPara } from './crm-ficha';

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
  const saudacao = saudacaoPara(primeiroNome(nome));
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

// ============================================================================
// Converter quem está no teste gratuito
// ============================================================================
// Conversa diferente da cobrança de assinatura manual, e por isso texto
// diferente. Lá a pessoa já decidiu pagar e o assunto é renovar; aqui ela está
// experimentando e o assunto é o que ela achou.
//
// O prazo muda o texto porque muda a conversa. Na véspera, o acesso ainda está
// de pé e a proposta é seguir sem interrupção. Depois de vencer, ela já perdeu
// o acesso, e insistir em "seu teste acaba amanhã" é a mensagem chegando tarde.
// ============================================================================

/**
 * A mensagem para converter quem está no teste do futebol.
 *
 * `diasRestantes` conta hoje: zero é "acaba hoje", um é "acaba amanhã",
 * negativo é "já acabou". Vem em número em vez de data porque é assim que a
 * pessoa pensa no próprio prazo.
 *
 * Não inventa preço nem link: quem sabe o que foi combinado é o sócio, e um
 * número errado numa proposta é pior que nenhum.
 */
export function mensagemDeConversao(nome: string | null, diasRestantes: number): string {
  const saudacao = saudacaoPara(primeiroNome(nome));

  if (diasRestantes < 0) {
    return (
      `${saudacao} Seu teste do futebol acabou. Quer que eu devolva seu acesso? Me diz que eu ` +
      'libero e te passo como seguir. E depois me conta o que você achou das análises, isso me ' +
      'ajuda a ajustar.'
    );
  }

  if (diasRestantes === 0) {
    return (
      `${saudacao} Hoje é o último dia do seu teste do futebol. Quer seguir com a gente? ` +
      'Me avisa que eu resolvo agora e amanhã você pega as análises normalmente.'
    );
  }

  const quando = diasRestantes === 1 ? 'amanhã' : `em ${diasRestantes} dias`;
  return (
    `${saudacao} Seu teste do futebol acaba ${quando}. Quer continuar? Me diz que eu já deixo ` +
    'acertado antes de vencer e você não fica um dia sem as análises.'
  );
}

// ============================================================================
// Depois do sim
// ============================================================================
// A lacuna que faltava no catálogo. Ele cobria abordar, converter e cobrar, e
// parava exatamente onde a venda acontece: a pessoa responde "quero" e o sócio
// improvisa valor, forma de pagamento e prazo na hora.
//
// Improvisar ali é onde a venda esfria. Quem acabou de dizer sim não precisa de
// mais argumento, precisa de um caminho curto: quanto é, como paga, e quando
// recebe o acesso.
// ============================================================================

/**
 * A mensagem para fechar com quem já disse sim.
 *
 * ⚠️ Ela TEM lacuna, ao contrário de todas as outras, e isso é deliberado: o
 * valor e a chave são do sócio, e inventar qualquer um dos dois é pior que
 * deixar em branco. Os colchetes são para serem vistos e substituídos — e são
 * colchetes, e não chaves, porque chave é o marcador de substituição automática
 * deste código e passaria por engano de template que não rodou.
 *
 * Não pede opinião, não reforça benefício e não pergunta de novo se a pessoa
 * quer. Responder um sim com mais venda é o jeito mais rápido de reabrir uma
 * decisão que já estava tomada.
 */
export function mensagemDeFechamento(nome: string | null): string {
  const saudacao = saudacaoPara(primeiroNome(nome));
  return (
    `${saudacao} Fechado! É [valor] por mês. Pix: [sua chave]. Me manda o comprovante que eu ` +
    'libero na hora e você já pega as análises de hoje.'
  );
}
