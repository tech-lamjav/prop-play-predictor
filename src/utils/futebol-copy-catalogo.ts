import { COMPETITION_LABELS, SEM_COMPETICAO } from '@/utils/futebol-competitions';
import { COPY_DA_AJUDA } from '@/utils/futebol-ajuda-copy';
import { COPY_DO_SUFIXO_DE_LEITURA, CHAVE_DO_SUFIXO_DE_LEITURA } from '@/utils/futebol-leitura';
import { COPY_DO_ROTULO_DA_EXPLICACAO } from '@/utils/futebol-motivos';
import {
  COPY_DA_LEITURA,
  COPY_DA_SAIDA,
  COPY_DO_PESO,
  MERCADOS,
  chaveDaPremissa,
  chaveDoMotivoDaPremissa,
  rotuloPremissa,
  type Premissa,
} from '@/utils/futebol-premissas';
import {
  COPY_DA_FAIXA,
  COPY_DO_MERCADO_CURTO,
  COPY_DO_MERCADO_LONGO,
  COPY_DO_PICK,
  COPY_DO_ROTULO_DA_FAIXA,
} from '@/utils/futebol-score';
import { COPY_DO_SELO_DE_RESULTADO, type BetResult } from '@/utils/futebol-settlement';

// ============================================================================
// futebol-copy-catalogo.ts — o catálogo em português, montado DA FUNÇÃO
// ============================================================================
// Este módulo é o gerador do `src/i18n/locales/pt/premissas.json`, e existe por
// uma razão só: o valor em português de cada chave tem de ser IDÊNTICO ao que a
// função de copy devolve hoje, e copiar 200 frases à mão é o jeito mais seguro
// de introduzir uma divergência invisível.
//
// Ele é a mesma ideia da semente de `futebol_premissa_copy` no SQL: uma fonte,
// duas saídas, e uma guarda comparando as duas
// (`futebol-copy-idioma-paridade.test.ts`) para que ninguém precise ler as duas
// no mesmo dia.
//
// ⚠️ NÃO É CÓDIGO DE PRODUÇÃO. Nenhuma tela o importa — quem ele serve é o
// script `scripts/gen-i18n-premissas.mjs` e a guarda. As telas pedem a frase
// pela chave, pelo i18next, e nunca por aqui.
// ============================================================================

/** As frases de uma premissa, endereçadas por mercado, slug, polaridade e mando. */
function premissaNoCatalogo(market: string, p: Premissa): Array<[string, string]> {
  const linhas: Array<[string, string]> = [];

  for (const negativo of [false, true]) {
    const neutro = negativo ? p.negativo : p.label;
    linhas.push([chaveDaPremissa(market, p, null, negativo), neutro]);
    // A variante só entra quando a frase MUDA de verdade — a mesma régua de
    // `numerar`, que é quem semeia a tabela de apoio no banco. Emitir as três
    // sempre triplicaria o catálogo para repetir o mesmo texto, e o tradutor
    // teria de traduzir a mesma frase três vezes sem saber por quê.
    for (const lado of ['home', 'away'] as const) {
      const texto = rotuloPremissa(p, lado, negativo);
      if (texto !== neutro) linhas.push([chaveDaPremissa(market, p, lado, negativo), texto]);
    }
  }

  const chaveDoMotivo = chaveDoMotivoDaPremissa(market, p);
  if (chaveDoMotivo != null) linhas.push([chaveDoMotivo, p.motivo!]);

  return linhas;
}

/**
 * Todo o catálogo de copy do futebol em português, achatado em chaves pontuadas.
 *
 * As premissas entram por `[mercado, slug]`, que é o par que a tela tem em mão —
 * `premissaDe` e `premissasDaSaida` só devolvem premissa de mercado, e as
 * globais (aviso de odd, corroboração, movimento de linha) nunca chegam à tela
 * como objeto: elas chegam como TEXTO da RPC, e esse texto é servido pelo banco.
 */
export function catalogoDaCopyEmPortugues(): Record<string, string> {
  const fora: Array<[string, string]> = [];

  for (const m of MERCADOS) {
    fora.push([`mercado.catalogo.${m.slug}`, m.label]);
    for (const p of [...m.premissas, ...m.penalidades]) {
      fora.push(...premissaNoCatalogo(m.slug, p));
    }
  }

  for (const [slug, texto] of Object.entries(COPY_DO_MERCADO_LONGO)) {
    fora.push([`mercado.longo.${slug}`, texto]);
  }
  for (const [slug, texto] of Object.entries(COPY_DO_MERCADO_CURTO)) {
    fora.push([`mercado.curto.${slug}`, texto]);
  }
  for (const [id, texto] of Object.entries(COPY_DA_SAIDA)) {
    fora.push([`saida.${id}`, texto]);
  }
  for (const [id, texto] of Object.entries(COPY_DO_PICK)) {
    fora.push([`pick.${id}`, texto]);
  }
  for (const [id, texto] of Object.entries(COPY_DO_PESO)) {
    fora.push([`peso.${id}`, texto]);
  }
  for (const [id, texto] of Object.entries(COPY_DA_LEITURA)) {
    fora.push([`leitura.${id}`, texto]);
  }
  for (const [id, texto] of Object.entries(COPY_DA_FAIXA)) {
    fora.push([`faixa.palavra.${id}`, texto]);
  }
  for (const [id, texto] of Object.entries(COPY_DO_ROTULO_DA_FAIXA)) {
    fora.push([`faixa.rotulo.${id}`, texto]);
  }
  for (const [id, texto] of Object.entries(COPY_DO_SELO_DE_RESULTADO)) {
    fora.push([`liquidacao.${id as BetResult}`, texto]);
  }
  for (const [slug, texto] of Object.entries(COMPETITION_LABELS)) {
    fora.push([`competicao.${slug}`, texto]);
  }
  fora.push(['competicao.nenhuma', SEM_COMPETICAO]);
  fora.push([CHAVE_DO_SUFIXO_DE_LEITURA, COPY_DO_SUFIXO_DE_LEITURA]);
  for (const [id, texto] of Object.entries(COPY_DA_AJUDA)) {
    fora.push([`ajuda.${id}`, texto]);
  }
  for (const [id, texto] of Object.entries(COPY_DO_ROTULO_DA_EXPLICACAO)) {
    fora.push([`explicacao.${id}`, texto]);
  }

  const duplicadas = fora.map(([k]) => k).filter((k, i, todas) => todas.indexOf(k) !== i);
  if (duplicadas.length) {
    // Alto e claro: chave repetida é a última entrada ganhando em silêncio, e o
    // texto perdido seria o de uma tela que ninguém abriu hoje.
    throw new Error(`chave repetida no catálogo de copy: ${[...new Set(duplicadas)].join(', ')}`);
  }

  return Object.fromEntries(fora);
}

/** O mesmo catálogo aninhado, que é a forma com que o i18next lê o arquivo. */
export function catalogoAninhado(plano: Record<string, string>): Record<string, unknown> {
  const raiz: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(plano)) {
    const partes = chave.split('.');
    let atual = raiz;
    for (const parte of partes.slice(0, -1)) {
      atual[parte] ??= {};
      atual = atual[parte] as Record<string, unknown>;
    }
    atual[partes[partes.length - 1]] = valor;
  }
  return raiz;
}
