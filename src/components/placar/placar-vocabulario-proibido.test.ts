import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// As palavras que o glossário proíbe não voltam (versão do placar)
// ============================================================================
// Irmão de `crm-vocabulario-proibido.test.ts`, e ele existe pelo mesmo motivo:
// o `CONTEXT.md` da raiz lista, em cada verbete do placar, as palavras a
// EVITAR, e cada uma foi um nome que fazia a conversa virar outra coisa.
//
// Ele nasceu por code review: a pasta chegou com uma constante chamada
// DIA_DO_SNAPSHOT_INICIAL, e "snapshot" está no _Avoid_ de **foto de
// nascimento** justamente porque é a palavra que faz o registro parecer detalhe
// de pipeline em vez do estado com que a oportunidade foi publicada.
//
// Como no do CRM, ele vigia só o que não tem uso legítimo aqui dentro. "Painel"
// é o caso mais sutil: ele é palavra proibida para o BOARD, mas legítimo em
// "painel dos sócios", que é o nome da área. Então o guarda olha os nomes
// exatos, e não a palavra solta.
// ============================================================================

const PASTA = __dirname;

const codigo = readdirSync(PASTA)
  .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && f !== 'placar-vocabulario-proibido.test.ts')
  .map((f) => [f, readFileSync(resolve(PASTA, f), 'utf8')] as const);

describe('o glossário manda, no placar também', () => {
  it('"snapshot" não nomeia nada', () => {
    // O termo é FOTO DE NASCIMENTO. A palavra pode aparecer numa frase que
    // explique o dado do mart, mas não como nome de constante, tipo ou função.
    const culpados = codigo
      .filter(([, texto]) => /(?:const|let|function|type|interface)\s+\w*[Ss]napshot\w*/.test(texto))
      .map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });

  it('o agrupamento da tabela não se chama "corte"', () => {
    // CORTE é o limiar contra o qual um insumo é comparado, e a palavra está
    // ocupada desde o glossário do futebol. O agrupamento é QUEBRA.
    //
    // ⚠️ O guarda olha as formas que significariam AGRUPAMENTO, e não a palavra
    // solta: CORTES_DE_VALOR é limiar de preço, que é o sentido legítimo do
    // termo, e a primeira versão deste teste reprovava justamente ele. Guarda
    // que reprova código correto é guarda que alguém apaga.
    const culpados = codigo
      .filter(([, texto]) =>
        /\b(corteDaTabela|CORTE_DA_TABELA|corteDaQuebra|cortesDaTela|corteDeGrupo)\b/.test(texto),
      )
      .map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });

  it('o que o placar mede não se chama "performance semanal"', () => {
    // Aquela é do caderno de apostas do assinante, e existe no produto com esse
    // nome. Confundir as duas é confundir o julgamento do método com o
    // resultado de quem apostou.
    const culpados = codigo
      .filter(([, texto]) => /performance\s+semanal/i.test(texto))
      .map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });

  it('a unidade de aposta não se chama "stake"', () => {
    // O verbete **unidade** proíbe: stake carrega tamanho variável, e o placar
    // mede com unidade fixa de propósito.
    const culpados = codigo.filter(([, texto]) => /\bstake\b/i.test(texto)).map(([nome]) => nome);
    expect(culpados).toEqual([]);
  });
});
