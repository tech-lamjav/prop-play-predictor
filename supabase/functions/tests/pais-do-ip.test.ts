import { assert, assertEquals } from "./_assert.ts";
import { paisDoIp } from "../shared/pais-do-ip.ts";
import { ehDoBrasil } from "../shared/faixas-do-brasil.ts";
import { FAIXAS_PAIS_V4, FAIXAS_PAIS_V6 } from "../shared/faixas-por-pais.dados.ts";

/**
 * O que este arquivo protege: a frase que o relatório precisa sustentar.
 *
 * "No dia tal, tantas pessoas ativas, e de quais países." Errar o país aqui não
 * barra ninguém e não quebra tela nenhuma — só põe um número errado num
 * relatório que vai ser lido uma vez, meses depois, por quem não tem como
 * conferir. É o tipo de erro que não tem quem reclame.
 */

Deno.test("reconhece o país dos quatro mercados da operação", () => {
  // Endereços tirados das próprias faixas do arquivo, um de cada país.
  assertEquals(paisDoIp("24.152.57.10"), "AR");
  assertEquals(paisDoIp("2.152.246.10"), "PE");
  assertEquals(paisDoIp("45.5.52.10"), "MX");
  assertEquals(paisDoIp("2.152.8.10"), "CO");
});

Deno.test("reconhece o Brasil, e concorda com o porteiro", () => {
  // O mesmo endereço medido pela sonda (#543). As duas listas saem do mesmo
  // download e da mesma leitura, então elas discordarem seria sinal de que o
  // gerador se perdeu entre uma saída e a outra.
  assertEquals(paisDoIp("200.162.199.115"), "BR");
  assertEquals(ehDoBrasil("200.162.199.115"), "sim");
});

Deno.test("reconhece IPv6", () => {
  assertEquals(paisDoIp("2001:1300::1"), "PE");
});

Deno.test("um IPv4 vestido de IPv6 é procurado na lista certa", () => {
  assertEquals(paisDoIp("::ffff:24.152.57.10"), "AR");
});

Deno.test("endereço de fora da região volta sem país", () => {
  // Não é erro: é o limite declarado da fonte. O LACNIC cobre América Latina e
  // Caribe, e um endereço dos Estados Unidos continua provando que a pessoa
  // não estava no Brasil — só não diz onde ela estava.
  assertEquals(paisDoIp("8.8.8.8"), null);
  assertEquals(paisDoIp("1.1.1.1"), null);
});

Deno.test("endereço que não dá para ler volta sem país", () => {
  for (const ruim of ["", "   ", "abc", "1.2.3", "1.2.3.999", "gggg::1"]) {
    assertEquals(paisDoIp(ruim), null, JSON.stringify(ruim));
  }
  assertEquals(paisDoIp(null), null);
  assertEquals(paisDoIp(undefined), null);
});

Deno.test("o arquivo por país não está vazio nem truncado", () => {
  // Uma regeração que dá errado em silêncio faria o relatório inteiro sair sem
  // país, e o sintoma seria lido como "os usuários não estão em lugar nenhum".
  assert(FAIXAS_PAIS_V4.length > 4000, `poucas faixas: ${FAIXAS_PAIS_V4.length}`);
  assert(FAIXAS_PAIS_V6.length > 8000, `poucos blocos: ${FAIXAS_PAIS_V6.length}`);
});

Deno.test("toda linha carrega um código de país de duas letras", () => {
  // Sem o código, a faixa existe e não serve para nada — e o defeito só
  // apareceria no relatório.
  for (const linha of [...FAIXAS_PAIS_V4, ...FAIXAS_PAIS_V6]) {
    const barra = linha.lastIndexOf("|");
    assert(barra !== -1, `linha sem país: ${linha}`);
    assert(/^[A-Z]{2}$/.test(linha.slice(barra + 1)), `país estranho: ${linha}`);
  }
});

Deno.test("os quatro mercados da operação estão representados", () => {
  // Se o gerador um dia passar a filtrar demais, é aqui que aparece — e o
  // sintoma seria assinante legítimo saindo do relatório sem país.
  const paises = new Set(FAIXAS_PAIS_V4.map((l) => l.slice(l.lastIndexOf("|") + 1)));
  for (const pais of ["BR", "AR", "PE", "MX", "CO"]) {
    assert(paises.has(pais), `faltou ${pais}`);
  }
});
