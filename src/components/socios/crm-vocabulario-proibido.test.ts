import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// As palavras que o glossário proíbe não voltam
// ============================================================================
// `CONTEXT.md` lista, em cada verbete, as palavras a EVITAR. Elas não são
// capricho: cada uma foi o nome que alguém usou antes e que fazia a conversa
// virar outra coisa. "Coluna" faz a posição do funil parecer coisa de banco;
// "cortesia" faz a assinatura manual parecer brinde, e ela é uma venda que
// alguém vai cobrar.
//
// Este guarda NÃO varre as palavras todas, e é de propósito: várias têm uso
// legítimo em outro assunto dentro do mesmo arquivo. "Coluna" é coluna de
// tabela no SQL; "degrau" é degrau da escada de PLANOS, que é outro conceito;
// "filtro" é o do funil e o da busca, e o próprio glossário abre essa exceção.
// Um guarda que proibisse a palavra solta ficaria vermelho com código correto, e
// o primeiro reflexo de quem tropeçasse nele seria apagar o guarda.
//
// Então ele vigia só o que JÁ aconteceu e foi corrigido: os nomes exatos que
// estavam errados, e a única palavra da lista que não tem uso legítimo nenhum
// aqui dentro.
// ============================================================================

const PASTA = __dirname;

const arquivos = readdirSync(PASTA).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

/** Nome de arquivo → conteúdo, menos os próprios guardas e o glossário. */
const codigo = arquivos
  .filter((f) => f !== 'crm-vocabulario-proibido.test.ts')
  .map((f) => [f, readFileSync(resolve(PASTA, f), 'utf8')] as const);

describe('o glossário manda', () => {
  it('"cortesia" não aparece em lugar nenhum', () => {
    // Único caso da lista sem uso legítimo aqui dentro. O termo é ASSINATURA
    // MANUAL, e a diferença importa: cortesia soa como brinde, e o que existe
    // é uma venda combinada que alguém vai cobrar quando vencer.
    const culpados = codigo.filter(([, texto]) => /cortesia/i.test(texto)).map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });

  it('a posição do funil não se chama "coluna"', () => {
    // O tipo já se chamou `ColunaDoFunil`, e o kanban tinha `TETO_DA_COLUNA`.
    // Nomes exatos, e não a palavra solta: `select` de coluna de tabela é uso
    // legítimo e mora nos mesmos arquivos.
    const culpados = codigo
      .filter(([, texto]) => /ColunaDoFunil|TETO_DA_COLUNA|daColuna/.test(texto))
      .map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });

  it('a posição do funil não se chama "degrau"', () => {
    // A exceção é a escada de PLANOS, que é outro conceito e tem degraus de
    // verdade. Por isso o guarda olha só onde o assunto é funil.
    const doFunil = ['FaixaDoFunil.tsx', 'crm-painel.ts', 'KanbanDeLeads.tsx'];
    const culpados = codigo
      .filter(([nome, texto]) => doFunil.includes(nome) && /degrau|degraus/i.test(texto))
      .map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });

  it('o recorte da lista não se chama "aba"', () => {
    const culpados = codigo
      .filter(([nome, texto]) => nome.startsWith('PainelCrm') && /\babas?\b/i.test(texto))
      .map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });

  it('"admin" não voltou, nem como caminho de arquivo', () => {
    // A pasta se chamou `admin/` antes, e o verbete "Sócio" proíbe a palavra.
    // Um ponteiro para `components/admin/CONTEXT.md` sobreviveu numa migration
    // depois da renomeação, apontando para um caminho que não existe mais.
    const culpados = codigo
      .filter(([, texto]) => /components\/admin|AdminCrm/.test(texto))
      .map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });
});
