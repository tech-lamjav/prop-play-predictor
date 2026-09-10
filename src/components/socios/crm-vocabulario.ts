// ============================================================================
// O vocabulário do CRM, num lugar só
// ============================================================================
// Estas listas são a MESMA coisa que as restrições `check` da migration 123, e
// um teste compara as duas. A duplicação é inevitável — o banco não consegue
// importar TypeScript e o navegador não consegue ler o catálogo do Postgres —
// então o que dá para fazer é impedir que ela se separe sem ninguém ver.
//
// O glossário de todos estes termos está em `CONTEXT.md`, ao lado.
// ============================================================================

/**
 * As seis etapas do funil, na ordem em que aparecem na tela.
 *
 * `sem_resposta` é o FIM DA LINHA, e não um degrau anterior a `assinou`: ele
 * fecha o caso do outro lado. A ordem aqui é de exibição, não de progressão.
 */
export const ETAPAS = [
  'novo',
  'contatado',
  'conversando',
  'proposta',
  'assinou',
  'sem_resposta',
] as const;

export type Etapa = (typeof ETAPAS)[number];

/**
 * Os três tipos de registro da linha do tempo.
 *
 * `feedback` é um TIPO de anotação, e não uma tela à parte: um feedback quase
 * sempre nasce dentro de uma conversa e perde o sentido separado dela.
 */
export const TIPOS_DE_ANOTACAO = ['anotacao', 'feedback', 'objecao'] as const;

export type TipoDeAnotacao = (typeof TIPOS_DE_ANOTACAO)[number];

/**
 * O endereço do painel.
 *
 * O App importa daqui em vez de escrever a string na tabela de rotas, e não é
 * capricho: três testes perguntam por este mesmo valor — o que não pode
 * aparecer no sitemap, o que não pode aparecer no robots.txt, e o que precisa
 * nascer embrulhado no portão. Com a string solta lá, mudar a rota deixaria os
 * três verdes guardando um endereço que não existe mais.
 */
export const ROTA_DOS_SOCIOS = '/socios';
