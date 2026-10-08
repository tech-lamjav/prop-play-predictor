import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// Toda tela pública tem como trocar de idioma (#536)
// ============================================================================
// ⚠️ ESTA GUARDA NASCEU DE UM DEFEITO ENTREGUE.
//
// O seletor foi posto em dois lugares: no menu da conta e no cabeçalho
// deslogado. Parecia coberto, e o PR afirmava que estava. Duas coisas estavam
// erradas ao mesmo tempo:
//
//   1. o cabeçalho que recebeu o seletor deslogado (`MainNav`) é usado SÓ pelo
//      layout autenticado — o ramo deslogado dele nunca renderiza
//   2. seis telas públicas têm cabeçalho PRÓPRIO, e nenhuma delas tinha seletor
//
// Entre essas seis estava a rota `/`, que é a porta de entrada mais comum do
// produto. Um visitante peruano caía na home e não tinha como trocar de idioma
// — o que mata a razão de o trabalho existir, e nada no CI apontava.
//
// A causa estrutural é que este produto não tem UM cabeçalho: tem o
// `AnalyticsNav`, o `MainNav` e um punhado de navs escritos dentro da própria
// tela. Enquanto for assim, cobertura de seletor é coisa que só um teste
// sustenta.
//
// Mesma espécie das guardas de paridade do repositório: arquivo contra arquivo,
// sem montar tela, sem banco.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const fonte = (caminho: string) => readFileSync(resolve(RAIZ, caminho), 'utf8').replace(/\r\n/g, '\n');

const APP = fonte('src/App.tsx');

/**
 * As rotas públicas, lidas do roteador e não de uma lista escrita à mão.
 *
 * "Pública" = `<Route>` cujo `element` não passa por `ProtectedRoute` nem por
 * `PortaoDoSocio`. Ler do roteador é o que faz esta guarda continuar valendo
 * quando alguém abrir uma rota nova.
 */
function telasPublicas(): Array<{ rota: string; componente: string }> {
  const achadas: Array<{ rota: string; componente: string }> = [];
  // Cada `<Route ...>` até o `/>` ou `</Route>` que o fecha.
  for (const bloco of APP.split('<Route ').slice(1)) {
    const rota = /path=(?:"([^"]*)"|\{([^}]*)\})/.exec(bloco);
    if (!rota) continue;
    // Só o pedaço até o próximo `<Route`, para não herdar o vizinho.
    const corpo = bloco.split('<Route')[0];
    if (/ProtectedRoute|PortaoDoSocio/.test(corpo)) continue;
    const comp = /element=\{<([A-Z][A-Za-z0-9_]*)/.exec(corpo);
    if (!comp) continue;
    achadas.push({ rota: rota[1] ?? rota[2], componente: comp[1] });
  }
  return achadas;
}

/**
 * Telas públicas que não têm seletor, com o motivo de cada uma.
 *
 * ⚠️ Acrescentar nome aqui é decisão de produto, não conserto de teste. Cada
 * linha diz por que aquela tela pode não oferecer a troca de idioma.
 */
const SEM_SELETOR: Record<string, string> = {
  // Redirecionamentos e telas sem interface própria.
  AuthCallback: 'só processa o retorno do OAuth e redireciona; não tem interface',
  NotFound: 'tela de erro, sem cabeçalho e sem navegação',
  // Telas que herdam o cabeçalho de outro componente já coberto.
  BolaoLayout: 'moldura do bolão; as telas de dentro é que desenham cabeçalho',
  // Conteúdo estático e jurídico, que não é porta de entrada comercial.
  Privacidade: 'texto legal, sem cabeçalho; não é porta de entrada',
  // Páginas de destino geradas, cuja moldura vem do conteúdo.
  LpVariant: 'landing gerada por slug; a moldura vem do conteúdo, não da tela',
  SharePage: 'aposta compartilhada por link; sem área na matriz de idiomas ainda',
};

/** Componentes de cabeçalho que já carregam o seletor. */
const CABECALHOS_COM_SELETOR = ['AnalyticsNav', 'MainNav'];

describe('toda tela pública oferece a troca de idioma', () => {
  const publicas = telasPublicas();

  it('o roteador foi lido de verdade', () => {
    // Se a leitura quebrar, os testes abaixo passariam por vacuidade.
    expect(publicas.length, 'nenhuma rota pública encontrada — o parser quebrou').toBeGreaterThan(
      10,
    );
  });

  it('nenhuma tela pública fica sem o seletor', () => {
    const semJeitoDeTrocar: string[] = [];

    for (const { rota, componente } of publicas) {
      if (componente in SEM_SELETOR) continue;

      let codigo: string;
      try {
        codigo = fonte(`src/pages/${componente}.tsx`);
      } catch {
        // Componente que não é uma página (moldura, redirecionamento).
        continue;
      }

      const temProprio = /SeletorDeIdioma/.test(codigo);
      const herdaDeCabecalho = CABECALHOS_COM_SELETOR.some((c) =>
        new RegExp(`<${c}\\b`).test(codigo),
      );

      if (!temProprio && !herdaDeCabecalho) {
        semJeitoDeTrocar.push(`${rota} (${componente})`);
      }
    }

    expect(
      semJeitoDeTrocar,
      `telas públicas sem como trocar de idioma:\n${semJeitoDeTrocar.join('\n')}\n\n` +
        'Ou ponha o seletor na tela, ou declare o motivo em SEM_SELETOR.',
    ).toEqual([]);
  });

  it('a home está coberta, e ela tem nome porque foi a que escapou', () => {
    // A rota `/` é a porta de entrada mais comum e foi exatamente a que ficou
    // sem seletor na primeira entrega. Vale um teste com nome próprio.
    const home = publicas.find((p) => p.rota === '/');
    expect(home, 'a rota / não foi encontrada no roteador').toBeDefined();
    expect(/SeletorDeIdioma/.test(fonte(`src/pages/${home!.componente}.tsx`))).toBe(true);
  });
});
