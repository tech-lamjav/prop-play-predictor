import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogoAninhado, catalogoDaCopyEmPortugues } from './futebol-copy-catalogo';
import {
  MERCADOS,
  chaveDaPremissa,
  chaveDoMotivoDaPremissa,
  rotuloPremissa,
} from './futebol-premissas';

// ============================================================================
// A guarda que impede o catálogo de idioma de divergir da função (#544)
// ============================================================================
// O desenho do #544 tem uma promessa que só um teste sustenta: **em português,
// nada muda**. As funções de copy continuam devolvendo o que devolviam — é
// contrato com o banco, e a guarda de paridade da copy já cobra isso contra o
// SQL — e a tela em espanhol pede a mesma frase por IDENTIFICADOR.
//
// O elo frágil é o catálogo em português: se ele for escrito à mão, ele começa
// idêntico e envelhece diferente. Uma premissa reescrita no TypeScript passaria
// na guarda do SQL (que é regerada junto) e a tela em PORTUGUÊS continuaria
// mostrando a frase velha, porque a tela lê o catálogo e não a função.
//
// Por isso o arquivo é GERADO (`scripts/gen-i18n-premissas.mjs`) e esta guarda
// compara o disco com a função. Mesma espécie das outras paridades deste
// repositório: duas fontes, arquivo contra arquivo, sem banco, no mesmo
// executor.
//
// ⚠️ Quando ela reprovar, o conserto é rodar o gerador e LER O DIFF — não editar
// o JSON à mão. Se a mudança em português foi deliberada, o diff mostra qual; se
// não foi, o diff acusa o acidente antes de ele chegar na tela.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const CAMINHO_PT = resolve(RAIZ, 'src/i18n/locales/pt/premissas.json');
const CAMINHO_ES = resolve(RAIZ, 'src/i18n/locales/es/premissas.json');

const plano = catalogoDaCopyEmPortugues();
const doDisco = JSON.parse(readFileSync(CAMINHO_PT, 'utf8')) as Record<string, unknown>;

/** Achata `{a:{b:'x'}}` em `{'a.b':'x'}`, que é como o i18next endereça. */
function achatar(obj: unknown, prefixo = ''): Array<[string, string]> {
  if (typeof obj !== 'object' || obj === null) return [[prefixo, String(obj)]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    achatar(v, prefixo ? `${prefixo}.${k}` : k),
  );
}

const espanhol = Object.fromEntries(
  achatar(JSON.parse(readFileSync(CAMINHO_ES, 'utf8')) as Record<string, unknown>),
);

describe('o catálogo em português é a própria função', () => {
  it('o arquivo no disco é exatamente o que o gerador produz', () => {
    // Comparar o objeto inteiro de uma vez faz o vitest mostrar o diff completo,
    // que é o que torna o conserto óbvio sem investigação.
    expect(doDisco).toEqual(catalogoAninhado(plano));
  });

  it('não está vazio, para o teste acima não passar por vacuidade', () => {
    expect(Object.keys(plano).length).toBeGreaterThan(150);
  });
});

describe('toda frase que a tela pode pedir tem chave', () => {
  it('as premissas de todo mercado, nos três mandos e nas duas polaridades', () => {
    // O universo é o que a TELA alcança: `premissaDe` e `premissasDaSaida` só
    // devolvem premissa de mercado. As globais (aviso de odd, corroboração,
    // movimento de linha) não entram porque nunca chegam à tela como objeto —
    // elas chegam como texto da RPC, servido pelo banco.
    const semChave: string[] = [];
    for (const m of MERCADOS) {
      for (const p of [...m.premissas, ...m.penalidades]) {
        for (const negativo of [false, true]) {
          for (const lado of [null, 'home', 'away'] as const) {
            const chave = chaveDaPremissa(m.slug, p, lado, negativo);
            if (!(chave in plano)) semChave.push(chave);
          }
        }
        const motivo = chaveDoMotivoDaPremissa(m.slug, p);
        if (motivo != null && !(motivo in plano)) semChave.push(motivo);
      }
    }
    expect([...new Set(semChave)]).toEqual([]);
  });

  it('a chave do mando devolve a MESMA frase que a função, e não a neutra', () => {
    // É o que prova que `mandoDaCopy` não afrouxou para `any` onde a frase muda:
    // afrouxar seria a tela em espanhol dizer "o mando pesa neste jogo" onde o
    // português diz "manda bem em casa" — e nenhuma paridade de chave pegaria.
    const divergentes: string[] = [];
    for (const m of MERCADOS) {
      for (const p of [...m.premissas, ...m.penalidades]) {
        for (const negativo of [false, true]) {
          for (const lado of [null, 'home', 'away'] as const) {
            const daFuncao = rotuloPremissa(p, lado, negativo);
            const doCatalogo = plano[chaveDaPremissa(m.slug, p, lado, negativo)];
            if (daFuncao !== doCatalogo) {
              divergentes.push(`${m.slug}/${p.slug}/${lado ?? 'any'} :: ${daFuncao} != ${doCatalogo}`);
            }
          }
        }
      }
    }
    expect(divergentes).toEqual([]);
  });
});

describe('a régua de copy vale no catálogo, nos dois idiomas', () => {
  // A mesma régua que a guarda da copy cobra na semente do banco. Ela vale aqui
  // porque é régua de COPY do produto, e não do transporte: a frase é a mesma.
  //
  // ⚠️ Vale para o espanhol também, e isso é decisão. As frases em espanhol NÃO
  // vão para o banco — a tabela de apoio e a DM do Telegram continuam só em
  // português —, então nenhuma guarda de SQL as alcança. Deixá-las fora da régua
  // faria o produto ter duas réguas de copy, uma por idioma.
  for (const [idioma, catalogo] of [
    ['pt', plano],
    ['es', espanhol],
  ] as const) {
    it(`nenhuma frase de premissa usa travessão em ${idioma}`, () => {
      const comTravessao = Object.entries(catalogo)
        .filter(([chave]) => chave.startsWith('premissa.'))
        .filter(([, texto]) => texto.includes('—') || texto.includes('–'))
        .map(([chave, texto]) => `${chave} :: ${texto}`);
      expect(comTravessao).toEqual([]);
    });
  }

  it('o espanhol tem as mesmas chaves, para o teste acima não passar vazio', () => {
    // A paridade de chaves é cobrada por `src/i18n/catalogo-paridade.test.ts`;
    // aqui só se garante que este arquivo leu MESMO o catálogo em espanhol.
    expect(Object.keys(espanhol).length).toBe(Object.keys(plano).length);
  });
});
