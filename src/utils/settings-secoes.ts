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

/**
 * As seções, com CHAVE de tradução no lugar do texto.
 *
 * Mesmo arranjo do menu da conta (`src/config/menu-da-conta.ts`): a tabela de
 * dados guarda a chave, e quem resolve o texto é a pintura. Assim o catálogo
 * continua sendo dado puro — o teste desta tabela não precisa de i18next de pé
 * — e o id, que vai para a URL e é contrato de link, não vira texto traduzido.
 *
 * ⚠️ `rotulo` e `resumo` são chaves sob a área `conta`, e NÃO a frase. Trocar
 * uma delas pela frase traduzida faria a tela mostrar português em espanhol sem
 * nenhum teste reclamar, porque em teste a interface roda em português.
 */
export const SECOES = [
  {
    id: 'perfil',
    rotulo: 'configuracoes.secoes.perfil.rotulo',
    resumo: 'configuracoes.secoes.perfil.resumo',
  },
  {
    id: 'alertas',
    rotulo: 'configuracoes.secoes.alertas.rotulo',
    resumo: 'configuracoes.secoes.alertas.resumo',
  },
  {
    id: 'assinatura',
    rotulo: 'configuracoes.secoes.assinatura.rotulo',
    resumo: 'configuracoes.secoes.assinatura.resumo',
  },
  {
    id: 'tour',
    rotulo: 'configuracoes.secoes.tour.rotulo',
    resumo: 'configuracoes.secoes.tour.resumo',
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
