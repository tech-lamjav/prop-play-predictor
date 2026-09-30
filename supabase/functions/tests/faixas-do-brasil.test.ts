import { assert, assertEquals } from "./_assert.ts";
import { ehDoBrasil } from "../shared/faixas-do-brasil.ts";
import { FAIXAS_V4, FAIXAS_V6 } from "../shared/faixas-do-brasil.dados.ts";

/**
 * O que este arquivo protege: a porta de entrada da operação inteira.
 *
 * Os dois erros possíveis não custam a mesma coisa. Dizer que um estrangeiro é
 * brasileiro barra um cliente pagante, e ele reclama — alguém descobre no mesmo
 * dia. Dizer que um brasileiro é estrangeiro deixa entrar quem deveria estar
 * fora E grava uma linha de evidência afirmando que ele estava no exterior.
 * Esse segundo erro ninguém descobre, porque ele não gera reclamação: ele gera
 * uma prova falsa, que só aparece numa fiscalização.
 *
 * Por isso a função tem três respostas e não duas, e por isso "não sei" nunca
 * vira "não é do Brasil".
 */

Deno.test("o IP medido na sonda é reconhecido como brasileiro", () => {
  // Este endereço veio do `cf-connecting-ip` numa chamada real a staging,
  // idêntico em cinco tentativas (#543). É o único caso aqui cuja resposta
  // certa foi observada no mundo, e não derivada do arquivo.
  assertEquals(ehDoBrasil("200.162.199.115"), "sim");
});

Deno.test("endereços de fora não são do Brasil", () => {
  assertEquals(ehDoBrasil("8.8.8.8"), "nao");
  assertEquals(ehDoBrasil("1.1.1.1"), "nao");
  assertEquals(ehDoBrasil("2001:db8::1"), "nao");
});

Deno.test("um IPv4 vestido de IPv6 é procurado na lista de IPv4", () => {
  // Algumas bordas entregam quem chegou por IPv4 nesta forma. Procurar na
  // lista errada faria todo brasileiro nessa situação passar como estrangeiro.
  assertEquals(ehDoBrasil("::ffff:200.162.199.115"), "sim");
  assertEquals(ehDoBrasil("::ffff:8.8.8.8"), "nao");
});

Deno.test("os extremos de uma faixa estão dentro, e os vizinhos fora", () => {
  // As faixas IPv4 são fundidas quando encostam, então o vizinho imediato de
  // um extremo está necessariamente fora de TODAS elas. Sem a fusão esta
  // afirmação seria falsa, e o teste também vigia isso.
  const paraNumero = (ip: string) =>
    ip.split(".").reduce((total, parte) => total * 256 + Number(parte), 0);
  const paraTexto = (n: number) =>
    [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");

  for (const faixa of [FAIXAS_V4[0], FAIXAS_V4[FAIXAS_V4.length - 1]]) {
    const [inicio, fim] = faixa.split("-");
    assertEquals(ehDoBrasil(inicio), "sim", `início de ${faixa}`);
    assertEquals(ehDoBrasil(fim), "sim", `fim de ${faixa}`);
    assertEquals(ehDoBrasil(paraTexto(paraNumero(inicio) - 1)), "nao", `antes de ${faixa}`);
    assertEquals(ehDoBrasil(paraTexto(paraNumero(fim) + 1)), "nao", `depois de ${faixa}`);
  }
});

Deno.test("o começo de cada bloco IPv6 é reconhecido", () => {
  for (const cidr of [FAIXAS_V6[0], FAIXAS_V6[FAIXAS_V6.length - 1]]) {
    assertEquals(ehDoBrasil(cidr.split("/")[0]), "sim", cidr);
  }
});

Deno.test("endereço que não dá para ler devolve 'não sei', e nunca 'não'", () => {
  for (
    const ruim of [
      "",
      "   ",
      "abc",
      "1.2.3",
      "1.2.3.4.5",
      "1.2.3.999",
      "1.2. 3.4",
      "1.2.3.-1",
      "::ffff:1.2.3",
      "2001:db8::1::2",
      "gggg::1",
    ]
  ) {
    assertEquals(ehDoBrasil(ruim), "nao_sei", JSON.stringify(ruim));
  }
  assertEquals(ehDoBrasil(null), "nao_sei");
  assertEquals(ehDoBrasil(undefined), "nao_sei");
});

Deno.test("espaço nas pontas é aparado, mas no meio não", () => {
  assertEquals(ehDoBrasil("  200.162.199.115  "), "sim");
  assertEquals(ehDoBrasil("200.162. 199.115"), "nao_sei");
});

Deno.test("zero à esquerda é lido como decimal", () => {
  // Comportamento documentado, não acidente. O endereço vem do cabeçalho da
  // nossa própria borda e não de entrada de usuário, então não há evasão a
  // temer — e recusar faria um brasileiro virar "não sei", que deixa entrar.
  assertEquals(ehDoBrasil("008.008.008.008"), ehDoBrasil("8.8.8.8"));
});

Deno.test("o arquivo gerado não está vazio nem truncado", () => {
  // Uma regeração que dá errado em silêncio desliga o bloqueio inteiro sem
  // levantar suspeita: a lista fica curta, todo mundo vira estrangeiro, e o
  // produto continua funcionando normalmente para quem deveria estar barrado.
  // Os pisos são folgados de propósito — eles pegam catástrofe, não flutuação.
  assert(FAIXAS_V4.length > 1500, `poucas faixas IPv4: ${FAIXAS_V4.length}`);
  assert(FAIXAS_V6.length > 5000, `poucos blocos IPv6: ${FAIXAS_V6.length}`);
});

Deno.test("as duas famílias estão presentes e no formato de cada uma", () => {
  // O IPv6 é o que se esquece, e esquecê-lo deixa passar o brasileiro no
  // celular — que é a maior parte deles.
  assert(FAIXAS_V6.length > 0, "sem nenhuma faixa IPv6");
  for (const faixa of FAIXAS_V4) assert(faixa.includes("-"), `IPv4 fora do formato: ${faixa}`);
  for (const bloco of FAIXAS_V6) assert(bloco.includes("/"), `IPv6 fora do formato: ${bloco}`);
});

Deno.test("as faixas IPv4 estão em ordem e não se sobrepõem", () => {
  // A busca é binária: fora de ordem ela devolve resposta errada em silêncio,
  // e sobreposição é sinal de que a fusão não rodou.
  const paraNumero = (ip: string) =>
    ip.split(".").reduce((total, parte) => total * 256 + Number(parte), 0);

  let anterior = -1;
  for (const faixa of FAIXAS_V4) {
    const [inicio, fim] = faixa.split("-");
    const a = paraNumero(inicio);
    const b = paraNumero(fim);
    assert(a <= b, `faixa invertida: ${faixa}`);
    assert(a > anterior + 1, `faixa fora de ordem ou encostada: ${faixa}`);
    anterior = b;
  }
});
