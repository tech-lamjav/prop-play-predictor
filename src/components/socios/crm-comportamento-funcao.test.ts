import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// A ponte para o PostHog não pode virar porta aberta
// ============================================================================
// Esta função é o único lugar do produto que tem a chave de consulta do
// PostHog. Com ela, quem chamar lê o comportamento de QUALQUER pessoa da base —
// então o portão dela é tão importante quanto o das funções do banco.
//
// Os testes leem o arquivo como texto, porque a função roda em Deno e a suíte
// roda em Node. É guarda de texto, com a fragilidade que isso tem; o que está
// do outro lado é o comportamento de toda a base vazando por um endpoint.
// ============================================================================

const FONTE = readFileSync(
  resolve(__dirname, '../../../supabase/functions/crm-comportamento/index.ts'),
  'utf8',
).replace(/\r\n/g, '\n');

describe('crm-comportamento', () => {
  it('confere que quem chamou é sócio', () => {
    expect(FONTE).toMatch(/rpc\('eh_socio'\)/);
    expect(FONTE).toMatch(/ehSocio !== true/);
  });

  it('usa o token de quem chamou, e não a chave de serviço', () => {
    // Com a service role, a função vira um caminho paralelo ao portão do
    // painel: no dia em que a regra de quem é sócio mudar, ela fica com a
    // cópia antiga e ninguém percebe.
    expect(FONTE).toMatch(/Authorization: autorizacao/);
    expect(FONTE).not.toMatch(/SERVICE_ROLE/);
  });

  it('recusa chamada sem token antes de qualquer consulta', () => {
    const antesDoPortao = FONTE.slice(0, FONTE.indexOf("rpc('eh_socio')"));
    expect(antesDoPortao).toMatch(/sem_token/);
  });

  it('o VALOR da chave só é interpolado no cabeçalho de autorização', () => {
    // O erro do PostHog volta inteiro para facilitar a depuração, e é
    // exatamente aí que uma chave vaza se alguém a interpolar na mensagem.
    //
    // O guarda olha a interpolação, e não a menção: a resposta de "sem chave"
    // cita o NOME da variável de propósito, para quem for configurar saber qual
    // é. Nome não vaza nada; valor vaza.
    const interpolacoes = FONTE.match(/\$\{POSTHOG_QUERY_KEY\}/g) ?? [];
    expect(interpolacoes).toHaveLength(1);
    expect(FONTE).toMatch(/Authorization: `Bearer \$\{POSTHOG_QUERY_KEY\}`/);
  });

  it('sem chave configurada, diz isso em vez de devolver vazio', () => {
    // Vazio na tela vira "essa pessoa não tem comportamento", que é uma
    // afirmação sobre a pessoa — e o problema era de configuração.
    expect(FONTE).toMatch(/sem_chave/);
  });

  it('o identificador vai por parâmetro, e não interpolado na consulta', () => {
    // Ele vem da rota. Interpolado, viraria injeção na linguagem de consulta
    // do PostHog.
    expect(FONTE).toMatch(/\{distinct_id\}/);
    expect(FONTE).not.toMatch(/distinct_id = '\$\{/);
  });

  it('lê a chave nova, e não a que já existe para escrever evento', () => {
    // `POSTHOG_API_KEY` guarda a chave PÚBLICA do projeto, usada pelas funções
    // de mensagem para capturar evento. Ela não consulta nada, e reaproveitar o
    // nome quebraria aquelas funções.
    expect(FONTE).toMatch(/POSTHOG_QUERY_KEY/);
    expect(FONTE).not.toMatch(/Deno\.env\.get\('POSTHOG_API_KEY'\)/);
  });

  it('devolve quando começa a história, e não só o total', () => {
    // Se o plano do PostHog descarta evento antigo, o total é de um recorte, e
    // não de sempre. A data do primeiro evento é o que deixa a tela dizer isso.
    expect(FONTE).toMatch(/primeiroEvento/);
  });
});
