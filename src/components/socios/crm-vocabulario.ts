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
 * As seis descrevem a CONVERSA, e vieram do funil que o Victor já tinha no CRM
 * antigo. `nutrindo` é mandar conteúdo sem pedir nada; `boletada` é ter mandado
 * um bilhete para o lead — é a mais específica do processo daqui.
 *
 * `sem_resposta` é o fim da linha do outro lado. A ordem aqui é de progressão.
 *
 * ⚠️ "Assinante" e "em teste" NÃO estão nesta lista de propósito: o banco
 * responde as duas, e etapa manual para o que o banco sabe nasce desatualizada.
 */
export const ETAPAS = [
  'novo',
  'contatado',
  'nutrindo',
  'boletada',
  'interesse',
  'sem_resposta',
] as const;

export type Etapa = (typeof ETAPAS)[number];

/** Como cada etapa se chama na tela. */
export const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  nutrindo: 'Nutrindo',
  boletada: 'Boletada',
  interesse: 'Interesse',
  sem_resposta: 'Sem resposta',
};

/**
 * Os três tipos de registro da linha do tempo.
 *
 * `feedback` é um TIPO de anotação, e não uma tela à parte: um feedback quase
 * sempre nasce dentro de uma conversa e perde o sentido separado dela.
 */
export const TIPOS_DE_ANOTACAO = ['anotacao', 'feedback', 'objecao'] as const;

export type TipoDeAnotacao = (typeof TIPOS_DE_ANOTACAO)[number];

/**
 * Tudo que PODE aparecer na linha do tempo, escrito à mão ou não.
 *
 * Lista separada dos três acima de propósito. `acesso` é escrito pelas funções
 * da migration 129 quando um sócio libera um produto na mão, e ninguém digita
 * um: somar ele à lista de cima o colocaria no seletor do formulário, e um
 * sócio poderia escrever "Betinho: liberou" sem ter liberado nada — um registro
 * de auditoria que qualquer um forja não é registro de auditoria.
 */
export const TIPOS_NA_LINHA_DO_TEMPO = [...TIPOS_DE_ANOTACAO, 'acesso'] as const;

export type TipoNaLinhaDoTempo = (typeof TIPOS_NA_LINHA_DO_TEMPO)[number];

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

/**
 * A etapa de quem nunca foi tocado.
 *
 * Um lead novo NÃO tem linha na tabela de etapa. É de propósito: exigir uma
 * escrita no banco para um lead aparecer significaria que todo cadastro novo
 * nasce dependendo de um gatilho — e um gatilho que falha esconde o lead em vez
 * de mostrá-lo errado. A mesma regra está na função `crm_mudar_etapa`.
 */
export const ETAPA_PADRAO: Etapa = 'novo';

/** Como cada tipo de registro se chama na tela. */
export const ROTULO_DO_TIPO: Record<TipoNaLinhaDoTempo, string> = {
  anotacao: 'Anotação',
  feedback: 'Feedback',
  objecao: 'Objeção',
  acesso: 'Acesso',
};
