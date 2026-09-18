import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// A guarda do árbitro de `on conflict` (issue #473)
// ============================================================================
// Um `upsert(..., { onConflict: 'coluna' })` do PostgREST vira `on conflict
// (coluna) do update` no Postgres. Para o Postgres aceitar isso, precisa existir
// um índice único NÃO PARCIAL naquelas colunas: se o índice tem `where`, ele só
// serve de árbitro quando a cláusula repete o predicado — e o PostgREST não tem
// como mandá-lo.
//
// O que acontece quando falta: erro 42P10, que numa edge function cai num
// `console.error` e segue. O webhook responde 200, o Stripe considera entregue,
// e a linha simplesmente não foi gravada. Aconteceu duas vezes neste
// repositório, nas duas tabelas onde o dinheiro entra:
//
//   · `crm_pagamento.stripe_invoice_id` — pego na revisão do spec #450, antes de
//     subir; a 151 criou o índice sem predicado.
//   · `bolao_subscriptions.stripe_session_id` — o da 042, que ficou aberto desde
//     então. A 154 troca o índice.
//
// ⚠️ ESTE TESTE LÊ TEXTO. Ele não sobe banco: cruza os `onConflict` das edge
// functions com os índices que as migrations criam e não derrubam depois. Pega o
// caso comum, que é criar o índice parcial "por precaução" e só descobrir em
// produção, no silêncio.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const MIGRACOES = resolve(RAIZ, 'supabase/migrations');
const FUNCOES = resolve(RAIZ, 'supabase/functions');

/** `a, b` e `a,b` são a mesma lista de colunas. */
const normaliza = (cols: string) =>
  cols.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean).join(',');

type Indice = { nome: string; tabela: string; colunas: string; parcial: boolean; arquivo: string };

/**
 * Os índices únicos VIVOS no fim das migrations.
 *
 * Vivos importa: a 042 cria o parcial e a 154 o derruba, e um teste que olhasse
 * só os `create` acusaria para sempre um índice que não existe mais.
 */
function indicesVivos(): Map<string, Indice> {
  const vivos = new Map<string, Indice>();
  const arquivos = readdirSync(MIGRACOES).filter((f) => f.endsWith('.sql')).sort();
  for (const arquivo of arquivos) {
    const sql = readFileSync(resolve(MIGRACOES, arquivo), 'utf8');
    const semComentario = sql
      .split(/\r?\n/)
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n');
    const criacao =
      /create\s+unique\s+index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z0-9_]+)\s+on\s+(?:public\.)?([a-z0-9_]+)\s*\(([^)]*)\)([^;]*);/gi;
    for (const m of semComentario.matchAll(criacao)) {
      vivos.set(m[1].toLowerCase(), {
        nome: m[1],
        tabela: m[2].toLowerCase(),
        colunas: normaliza(m[3]),
        parcial: /\bwhere\b/i.test(m[4]),
        arquivo,
      });
    }
    const queda = /drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi;
    for (const m of semComentario.matchAll(queda)) vivos.delete(m[1].toLowerCase());
  }
  return vivos;
}

/** Cada `onConflict` que alguma edge function manda, com o arquivo de origem. */
function arbitrosPedidos(): { colunas: string; arquivo: string }[] {
  const achados: { colunas: string; arquivo: string }[] = [];
  const visitar = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = resolve(dir, entrada.name);
      if (entrada.isDirectory()) { visitar(caminho); continue; }
      if (!entrada.name.endsWith('.ts')) continue;
      const src = readFileSync(caminho, 'utf8');
      for (const m of src.matchAll(/onConflict:\s*['"]([^'"]+)['"]/g)) {
        achados.push({ colunas: normaliza(m[1]), arquivo: entrada.name });
      }
    }
  };
  visitar(FUNCOES);
  return achados;
}

describe('o árbitro de on conflict', () => {
  it('nenhum upsert aponta para um índice único PARCIAL', () => {
    const vivos = [...indicesVivos().values()];
    const culpados = arbitrosPedidos()
      .map((pedido) => {
        const casados = vivos.filter((i) => i.colunas === pedido.colunas);
        // Só acusa quando TODOS os índices daquelas colunas são parciais: se
        // existe um não parcial, o Postgres usa esse e o upsert grava.
        const soParcial = casados.length > 0 && casados.every((i) => i.parcial);
        return soParcial ? { pedido, casados } : null;
      })
      .filter(Boolean) as { pedido: { colunas: string; arquivo: string }; casados: Indice[] }[];

    expect(
      culpados.map((c) => `${c.pedido.arquivo}: onConflict '${c.pedido.colunas}' → ${c.casados.map((i) => `${i.nome} (${i.arquivo})`).join(', ')}`),
    ).toEqual([]);
  });

  it('e a sessão do bolão tem índice sem predicado', () => {
    // O caso concreto da #473, cravado: o upsert do webhook depende dele, e um
    // `create ... where` de volta aqui reabre o buraco sem barulho nenhum.
    const indice = indicesVivos().get('bolao_subscriptions_sessao_unica');
    expect(indice).toBeDefined();
    expect(indice!.tabela).toBe('bolao_subscriptions');
    expect(indice!.colunas).toBe('stripe_session_id');
    expect(indice!.parcial).toBe(false);
    // E o parcial da 042 não pode ter sobrevivido: dois índices únicos na mesma
    // coluna é o dobro da escrita, sem nenhuma garantia a mais.
    expect(indicesVivos().has('bolao_subscriptions_stripe_session_id_unique')).toBe(false);
  });
});
