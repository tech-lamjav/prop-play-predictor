import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { configuracaoDoIdioma } from './init';
import { AREAS, IDIOMA_DE_REFERENCIA } from './idiomas';

// ============================================================================
// Só o idioma em uso desce pelo cabo (#536)
// ============================================================================
// É o critério que o usuário pediu antes de qualquer outro — "para o nosso site
// não perder performance de carregamento" — e era o ÚNICO critério do #536 sem
// nenhum teste. A guarda de paridade prova que o catálogo está certo, não que
// só um deles é baixado.
//
// ⚠️ O QUE ESTE TESTE ACHOU, E POR QUE ELE PRECISOU SER ESCRITO ASSIM
//
// Com `fallbackLng: 'pt'`, o i18next resolve `es` como a hierarquia
// `['es', 'pt']` e PRÉ-CARREGA as duas. Um visitante peruano pagava o catálogo
// português inteiro junto com o dele: 100% a mais de texto, em silêncio, com o
// build verde e a tela correta. Nada no produto apontava para isso.
//
// E ele não pode usar a inicialização global: `src/test/setup.ts` liga o
// i18next com os catálogos EM MEMÓRIA, então um teste que chamasse
// `iniciarIdioma` não veria pedido nenhum e passaria com a falha de pé. Foi o
// que aconteceu na primeira tentativa. Por isso a configuração é exportada
// separada e medida numa instância própria, com o carregador espionado.
// ============================================================================

/** Uma instância isolada, com o carregador trocado por um espião. */
async function pedidosAoAbrirEm(idioma: 'pt' | 'es') {
  const pedidos: Array<[string, string]> = [];

  const espiao = {
    type: 'backend' as const,
    init: () => {},
    read(
      lng: string,
      ns: string,
      pronto: (erro: unknown, dados?: Record<string, unknown>) => void,
    ) {
      pedidos.push([lng, ns]);
      pronto(null, {});
    },
  };

  const instancia = i18next.createInstance();
  await instancia.use(espiao).init({
    ...configuracaoDoIdioma(idioma),
    // Todas as áreas de uma vez: o que está sob medição é QUAIS IDIOMAS o
    // i18next pede, e não quantas áreas a tela usa.
    ns: [...AREAS],
  });

  return pedidos;
}

describe('o cabo carrega um idioma, não dois', () => {
  it('abrindo em espanhol, o português NÃO é baixado', async () => {
    const pedidos = await pedidosAoAbrirEm('es');
    const idiomas = [...new Set(pedidos.map(([lng]) => lng))];

    expect(pedidos.length, 'nada foi pedido — o espião não está no caminho').toBeGreaterThan(0);
    expect(
      idiomas,
      `pediu ${JSON.stringify(idiomas)}: um visitante em espanhol não pode pagar o catálogo português junto`,
    ).toEqual(['es']);
  });

  it('abrindo em português, só o português', async () => {
    const idiomas = [...new Set((await pedidosAoAbrirEm(IDIOMA_DE_REFERENCIA)).map(([l]) => l))];
    expect(idiomas).toEqual([IDIOMA_DE_REFERENCIA]);
  });

  it('pede cada área UMA vez, e não uma por tela', async () => {
    const pedidos = await pedidosAoAbrirEm('es');
    const repetidos = pedidos.filter(
      (p, i) => pedidos.findIndex(([l, n]) => l === p[0] && n === p[1]) !== i,
    );
    expect(repetidos, `áreas pedidas mais de uma vez: ${JSON.stringify(repetidos)}`).toEqual([]);
  });
});
