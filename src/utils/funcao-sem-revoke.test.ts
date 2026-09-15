import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Nenhuma função SECURITY DEFINER NOVA fica aberta para PUBLIC
// ============================================================================
// Função nova em Postgres nasce EXECUTÁVEL POR PUBLIC, e PUBLIC inclui o
// `anon`. Quem escreve `security definer` está escrevendo código que roda com
// os privilégios do dono do banco, passando por cima de RLS — e se ela nasce
// aberta, qualquer visitante executa.
//
// As migrations do CRM tratam isso desde a 123, uma por uma, porque quem as
// escreveu lembrou. O resto do repositório não: 99 funções são `security
// definer` e NENHUMA migration as fecha. Apenas 12 no repositório inteiro têm
// revoke, e quase todas são do CRM.
//
// Duas delas eram vazamento de verdade, achadas em 2026-09-12 (issue #408):
// `get_weekly_recap_candidates` devolvia nome, chat do Telegram e lucro de toda
// a base, e `get_settlement_reminder_candidates` devolvia aposta a aposta com
// descrição e valor. A migration 135 fechou as duas.
//
// ⚠️ ESTE GUARDA É UMA CATRACA, e não um pente-fino. Ele aceita o passivo que
// existe e barra a centésima. Passar as 99 a limpo exige olhar quem chama cada uma,
// função por função, e travar isso num teste agora só faria alguém apagar o
// teste. O passivo vive em `supabase/migrations/PASSIVO-definidoras-abertas.txt`
// e só pode ENCOLHER.
// ============================================================================

const MIGRACOES = resolve(__dirname, '../../supabase/migrations');
const PASSIVO = resolve(MIGRACOES, 'PASSIVO-definidoras-abertas.txt');

/** Cada migration, sem comentários e sem `\r`. */
function migrations(): string[] {
  return readdirSync(MIGRACOES)
    .filter((f) => f.endsWith('.sql'))
    .map((f) =>
      readFileSync(resolve(MIGRACOES, f), 'utf8')
        .replace(/\r\n/g, '\n')
        // Os comentários saem: várias migrations do CRM escrevem a versão
        // ERRADA do código dentro de um comentário, para explicar por que ela
        // não serve — e o guarda acusaria o exemplo.
        .replace(/--.*$/gm, ''),
    );
}

/**
 * As funções `security definer` que NENHUMA migration fecha.
 *
 * Por nome, e "em algum lugar" em vez de "no mesmo arquivo": o que decide a
 * permissão real no banco é o conjunto das migrations aplicadas, e um revoke
 * numa migration posterior fecha de verdade. Foi assim que a 135 fechou as duas
 * da #408, que nasceram na 078 e na 086.
 *
 * O preço dessa regra é que ela não vê a JANELA: entre a migration que cria
 * aberta e a que fecha, a função fica exposta, e esse intervalo foi de meses
 * nas duas da #408. Fechar no mesmo arquivo continua sendo a recomendação, e
 * está na mensagem de falha — mas recomendação não é o que o teste mede.
 */
function abertas(): string[] {
  const arquivos = migrations();

  const fechadas = new Set<string>();
  for (const sql of arquivos) {
    for (const m of sql.matchAll(
      /revoke\s+execute\s+on\s+function\s+(?:public\.)?([a-z0-9_]+)/gi,
    )) {
      fechadas.add(m[1].toLowerCase());
    }
  }

  const achados = new Set<string>();
  for (const sql of arquivos) {
    const baixo = sql.toLowerCase();
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function[\s\S]{0,400}?\)/gi)) {
      const nome = m[0].match(/function\s+(?:public\.)?([a-z0-9_]+)\s*\(/i)?.[1];
      if (!nome) continue;
      // `security definer` aparece depois da assinatura, antes do corpo.
      if (!baixo.slice(m.index ?? 0, (m.index ?? 0) + 900).includes('security definer')) continue;
      if (fechadas.has(nome.toLowerCase())) continue;
      achados.add(nome.toLowerCase());
    }
  }

  return [...achados].sort();
}

/** O passivo aceito, do arquivo. Linhas de comentário e vazias saem. */
function passivoAceito(): string[] {
  return readFileSync(PASSIVO, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .sort();
}

describe('a catraca das funções security definer', () => {
  it('nenhuma função nova nasce aberta para PUBLIC', () => {
    const novas = abertas().filter((a) => !passivoAceito().includes(a));

    expect(
      novas,
      `Estas funções são SECURITY DEFINER e nenhuma migration as fecha:\n` +
        `  ${novas.join('\n  ')}\n\n` +
        'Acrescente no MESMO arquivo que a cria, depois do CREATE FUNCTION —\n' +
        'no mesmo arquivo porque entre criar aberta e fechar depois existe uma\n' +
        'janela, e nas duas funções da #408 essa janela foi de meses:\n' +
        '  revoke execute on function public.<nome>(<tipos>) from public;\n' +
        '  grant  execute on function public.<nome>(<tipos>) to <papel>;\n\n' +
        'Função nova nasce executável por PUBLIC, e PUBLIC inclui o anon: sem o\n' +
        'revoke, qualquer visitante chama uma função que roda com privilégio de\n' +
        'dono do banco e passa por cima de RLS.',
    ).toEqual([]);
  });

  it('o passivo só encolhe', () => {
    // Se alguém fechar uma das 99, este teste pede para a lista ser
    // atualizada. É o que impede o passivo de virar paisagem: ele tem de ser
    // mexido para encolher, e mexer é o momento de notar que encolheu.
    const aceito = passivoAceito();
    const aindaAbertas = abertas();
    const fechadas = aceito.filter((a) => !aindaAbertas.includes(a));

    expect(
      fechadas,
      `Estas funções foram fechadas e continuam listadas no passivo:\n  ${fechadas.join('\n  ')}\n\n` +
        `Tire essas linhas de ${PASSIVO} — o passivo diminuiu, e a lista tem de\n` +
        'contar isso.',
    ).toEqual([]);
  });

  it('as funções do CRM estão todas fechadas', () => {
    // O padrão que o resto do repositório precisa alcançar. Se uma função do
    // CRM entrar no passivo, é regressão no lugar que mais cuidou disso.
    expect(abertas().filter((a) => a.startsWith('crm_'))).toEqual([]);
  });

  it('as duas da #408 continuam fechadas', () => {
    // A 135 as fecha. Se alguém remover aquela migration, elas voltam a
    // aparecer como "novas" no primeiro teste — e é esse o ponto deste.
    const aindaAbertas = abertas();
    for (const funcao of ['get_weekly_recap_candidates', 'get_settlement_reminder_candidates']) {
      expect(aindaAbertas, funcao).not.toContain(funcao);
      expect(passivoAceito(), funcao).not.toContain(funcao);
    }
  });
});
