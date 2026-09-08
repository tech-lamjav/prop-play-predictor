// ============================================================
// settings-secoes.ts — as quatro seções das Configurações
// ============================================================
// A tela era uma pilha: quatro cartões empilhados numa coluna de 672px, e para
// chegar no último se rolava por cima dos outros três. Nada ali é sequencial —
// mexer no telefone não tem relação com rever o tour —, então a pilha só cobrava
// rolagem sem dar contexto.
//
// Aqui elas viram seções irmãs, uma de cada vez, com navegação ao lado.
//
// O catálogo mora num util, e não no JSX, por dois motivos: o id vai para a URL
// e vira contrato de link, e a escolha da seção aberta é regra que dá para errar
// em silêncio — um id que ninguém reconhece renderizaria uma tela em branco.
// ============================================================

export const SECOES = [
  {
    id: 'perfil',
    rotulo: 'Perfil',
    resumo: 'Nome, e-mail e Telegram',
  },
  {
    id: 'alertas',
    rotulo: 'Alertas',
    resumo: 'Oportunidades no Telegram',
  },
  {
    id: 'assinatura',
    rotulo: 'Assinatura',
    resumo: 'Planos e pagamentos',
  },
  {
    id: 'tour',
    rotulo: 'Tour guiado',
    resumo: 'Rever a apresentação',
  },
] as const;

export type SecaoId = (typeof SECOES)[number]['id'];

/** A primeira da lista, e a que responde por qualquer id que não exista. */
const PADRAO: SecaoId = SECOES[0].id;

/**
 * A seção aberta, a partir do que veio na URL.
 *
 * Id desconhecido cai no padrão em vez de não renderizar nada: link antigo, erro
 * de digitação e seção renomeada são todos casos reais, e em qualquer um deles
 * uma tela em branco sem explicação é o pior desfecho possível.
 */
export function secaoAtiva(param: string | null | undefined): SecaoId {
  const achou = SECOES.find((s) => s.id === param);
  return achou ? achou.id : PADRAO;
}
