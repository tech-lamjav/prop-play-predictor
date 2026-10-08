import { describe, expect, it } from 'vitest';
import { carregarArea, catalogosDisponiveis, chaveDoCatalogo } from './carregar';
import { AREAS, IDIOMAS, IDIOMA_DE_REFERENCIA } from './idiomas';

// ============================================================================
// A guarda que impede o catálogo de divergir (#536)
// ============================================================================
// Mesma espécie das guardas de paridade que este repositório já tem (a da copy
// da premissa, a do acesso): duas fontes que divergem em silêncio porque
// ninguém lê as duas no mesmo dia. Aqui são N fontes, uma por idioma, e a
// divergência aparece como tela em branco ou código de chave no lugar da
// frase — para o usuário, não para quem escreveu.
//
// Ela cobra QUATRO coisas, e a quarta é a razão de o carregador ter o desenho
// que tem:
//
//   1. TRADUÇÃO FALTANDO -> chave que existe na referência e não no outro
//   2. CHAVE ÓRFÃ        -> chave que sobrou de um texto que saiu da tela
//   3. VALOR VAZIO       -> chave presente com string vazia, que é pior que
//                           faltar, porque o recuo para o português não
//                           dispara e a tela mostra nada
//   4. CATÁLOGO AUSENTE  -> a falha calada do empacotador
//
// ⚠️ Sobre a quarta, e é o ponto que quase passou batido: o empacotador aceita
// caminho montado na hora, gera ZERO pedaço, não emite erro nem aviso, e
// quebra só no navegador do usuário. Um teste que montasse o caminho do mesmo
// jeito NÃO pegaria isso, porque no ambiente de teste aquele caminho resolve.
// O que torna a falha visível aqui é o carregador expor o MAPA de catálogos
// que o empacotador montou: o mapa é literal, existe igual nos dois ambientes,
// e fica vazio nos dois quando o padrão está errado. Ver `carregar.ts`.
// ============================================================================

/** Achata `{a:{b:'x'}}` em `['a.b']`, que é como o i18next endereça. */
function chaves(obj: unknown, prefixo = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefixo];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    chaves(v, prefixo ? `${prefixo}.${k}` : k),
  );
}

function valores(obj: unknown, prefixo = ''): Array<[string, unknown]> {
  if (obj === null || typeof obj !== 'object') return [[prefixo, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    valores(v, prefixo ? `${prefixo}.${k}` : k),
  );
}

describe('o empacotador enxerga todos os catálogos', () => {
  it('tem um catálogo para cada idioma e cada área da matriz', () => {
    // Esta é a asserção que pega a falha calada. Se ela quebrar com a lista
    // de disponíveis VAZIA, o padrão do carregador parou de casar e nenhum
    // texto chegaria ao navegador — mesmo com o build verde.
    const disponiveis = catalogosDisponiveis();
    expect(disponiveis.length).toBeGreaterThan(0);

    const esperados = IDIOMAS.flatMap((i) => AREAS.map((a) => chaveDoCatalogo(i, a)));
    for (const chave of esperados) {
      expect(disponiveis, `catálogo ausente: ${chave}`).toContain(chave);
    }
  });

  it('não tem catálogo sobrando fora da matriz', () => {
    // Arquivo de idioma que saiu da matriz e ficou no disco vira peso morto no
    // pacote, e pior: sugere que o produto fala uma língua que ele não fala.
    const esperados = new Set(IDIOMAS.flatMap((i) => AREAS.map((a) => chaveDoCatalogo(i, a))));
    for (const chave of catalogosDisponiveis()) {
      expect(esperados, `catálogo fora da matriz: ${chave}`).toContain(chave);
    }
  });
});

describe('todo idioma tem exatamente as chaves da referência', () => {
  for (const area of AREAS) {
    it(`área "${area}"`, async () => {
      const referencia = chaves(await carregarArea(IDIOMA_DE_REFERENCIA, area)).sort();

      for (const idioma of IDIOMAS) {
        if (idioma === IDIOMA_DE_REFERENCIA) continue;
        const outras = chaves(await carregarArea(idioma, area)).sort();

        const faltando = referencia.filter((k) => !outras.includes(k));
        const sobrando = outras.filter((k) => !referencia.includes(k));

        expect(faltando, `${idioma}/${area}: tradução faltando`).toEqual([]);
        expect(sobrando, `${idioma}/${area}: chave órfã`).toEqual([]);
      }
    });
  }
});

describe('nenhuma chave tem valor vazio', () => {
  // Vazio é pior que ausente: ausente aparece como o CÓDIGO da chave — o recuo
  // para o português está desligado em `init.ts`, porque ligado fazia quem lê
  // em espanhol baixar os dois catálogos —, e vazio não mostra nada. É por isso
  // que a guarda de paridade acima existe: com o recuo desligado, é ela que
  // impede uma chave de faltar.
  for (const idioma of IDIOMAS) {
    it(`idioma "${idioma}"`, async () => {
      for (const area of AREAS) {
        for (const [chave, valor] of valores(await carregarArea(idioma, area))) {
          expect(typeof valor, `${idioma}/${area} · ${chave}: não é texto`).toBe('string');
          expect(String(valor).trim(), `${idioma}/${area} · ${chave}: vazio`).not.toBe('');
        }
      }
    });
  }
});
