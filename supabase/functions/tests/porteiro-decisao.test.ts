import { assertEquals } from "./_assert.ts";
import { decidir, deveRevogarASessao, type EstadoDoPorteiro } from "../porteiro/decisao.ts";
import { ipDaRequisicao } from "../shared/origem-da-requisicao.ts";

/**
 * O que este arquivo protege: quem entra, quem não entra, e o que fica escrito.
 *
 * Os dois erros custam coisas diferentes. Barrar um estrangeiro tira um cliente
 * pagante e ele reclama no mesmo dia. Deixar um brasileiro entrar não gera
 * reclamação de ninguém — gera uma linha de evidência dizendo que ele estava
 * fora do país. O segundo erro é o silencioso, e é o que estes testes cobram
 * com mais insistência.
 */

const base: EstadoDoPorteiro = { origem: "nao", bloqueioLigado: true, ehSocio: false };
const com = (mudanca: Partial<EstadoDoPorteiro>): EstadoDoPorteiro => ({ ...base, ...mudanca });

Deno.test("brasileiro é barrado quando a chave está ligada", () => {
  assertEquals(decidir(com({ origem: "sim" })), { origem: "brasil", veredito: "barrado" });
});

Deno.test("estrangeiro entra", () => {
  assertEquals(decidir(com({ origem: "nao" })), { origem: "fora", veredito: "entrou" });
});

Deno.test("com a chave desligada ninguém é barrado", () => {
  assertEquals(decidir(com({ origem: "sim", bloqueioLigado: false })), {
    // ⚠️ A origem continua sendo registrada como 'brasil'. É o ponto de haver
    // duas colunas: enquanto a chave estiver desligada, todo veredito é
    // 'entrou', e um registro só de vereditos não provaria nada sobre esse
    // período inteiro.
    origem: "brasil",
    veredito: "entrou",
  });
});

Deno.test("sócio atravessa mesmo brasileiro e com a chave ligada", () => {
  assertEquals(decidir(com({ origem: "sim", ehSocio: true })), {
    origem: "brasil",
    veredito: "entrou",
  });
});

Deno.test("origem desconhecida deixa entrar, e fica registrada como desconhecida", () => {
  // O fail-open é a escolha. O que o torna seguro é isto não virar 'fora': se
  // o defeito aparecesse como estrangeiro, ele viraria prova falsa em vez de
  // alarme.
  assertEquals(decidir(com({ origem: "nao_sei" })), { origem: "nao_sei", veredito: "entrou" });
  assertEquals(decidir(com({ origem: "nao_sei", bloqueioLigado: false })), {
    origem: "nao_sei",
    veredito: "entrou",
  });
});

Deno.test("barrar exige as três condições ao mesmo tempo", () => {
  // Cada linha tira exatamente uma das três e confirma que basta isso para
  // entrar. É a tabela-verdade inteira do que barra.
  assertEquals(decidir(com({ origem: "sim" })).veredito, "barrado");
  assertEquals(decidir(com({ origem: "nao" })).veredito, "entrou");
  assertEquals(decidir(com({ origem: "sim", bloqueioLigado: false })).veredito, "entrou");
  assertEquals(decidir(com({ origem: "sim", ehSocio: true })).veredito, "entrou");
});

// ── Derrubar a sessão ───────────────────────────────────────────────────────

Deno.test("a sessão cai quando a pessoa logada é barrada", () => {
  const barrado = decidir(com({ origem: "sim" }));
  assertEquals(deveRevogarASessao(barrado, true), true);
});

Deno.test("quem entrou não perde a sessão", () => {
  assertEquals(deveRevogarASessao(decidir(com({ origem: "nao" })), true), false);
  assertEquals(deveRevogarASessao(decidir(com({ origem: "nao_sei" })), true), false);
  assertEquals(deveRevogarASessao(decidir(com({ origem: "sim", ehSocio: true })), true), false);
  assertEquals(
    deveRevogarASessao(decidir(com({ origem: "sim", bloqueioLigado: false })), true),
    false,
  );
});

Deno.test("visitante deslogado não tem sessão para derrubar", () => {
  // Sem esta condição, toda visita anônima do Brasil chamaria a API de
  // administração à toa — e a página pública é justamente a mais visitada.
  const barrado = decidir(com({ origem: "sim" }));
  assertEquals(deveRevogarASessao(barrado, false), false);
});

// ── De onde sai o endereço ──────────────────────────────────────────────────

Deno.test("o endereço sai do cabeçalho que a borda escreve", () => {
  const headers = new Headers({ "cf-connecting-ip": "200.162.199.115" });
  assertEquals(ipDaRequisicao(headers), "200.162.199.115");
});

Deno.test("o x-forwarded-for é ignorado, mesmo estando presente", () => {
  // Este é o caso exato medido pela sonda em staging (#543): o endereço do
  // cliente repetido e um endereço da AWS no fim. Se algum dia alguém decidir
  // "aproveitar" este cabeçalho como reserva, este teste falha — e é para
  // falhar. Qualquer cliente pode escrever o próprio x-forwarded-for, e a borda
  // acrescenta em vez de substituir: um brasileiro que mandasse um endereço
  // estrangeiro apareceria em primeiro lugar na lista.
  const headers = new Headers({
    "x-forwarded-for": "200.162.199.115,200.162.199.115, 13.248.114.171",
  });
  assertEquals(ipDaRequisicao(headers), null);
});

Deno.test("sem o cabeçalho da borda, a resposta é não saber", () => {
  assertEquals(ipDaRequisicao(new Headers({})), null);
  assertEquals(ipDaRequisicao(new Headers({ "cf-connecting-ip": "" })), null);
  assertEquals(ipDaRequisicao(new Headers({ "cf-connecting-ip": "   " })), null);
});

Deno.test("o nome do cabeçalho não depende de maiúscula", () => {
  assertEquals(ipDaRequisicao(new Headers({ "CF-Connecting-IP": "1.2.3.4" })), "1.2.3.4");
});
