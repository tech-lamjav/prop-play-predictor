import { assert, assertEquals } from "./_assert.ts";
import { lerOrigem } from "../sonda-geo/leitura.ts";

/**
 * O que este arquivo protege: a sonda não pode devolver credencial.
 *
 * Ela existe para olhar os cabeçalhos de uma requisição, e `authorization` e
 * `apikey` viajam no mesmo mapa que o país e o IP. Devolver o mapa inteiro
 * seria trocar uma pergunta de infraestrutura por um vazamento — e num
 * endpoint que, por ser descartável, ninguém vai revisar de novo.
 *
 * Por isso o teste cobra as duas metades da regra: o valor do que está na
 * lista sai, e o valor de todo o resto não sai de jeito nenhum.
 */

function headers(mapa: Record<string, string>): Headers {
  return new Headers(mapa);
}

Deno.test("devolve o valor dos cabeçalhos de origem", () => {
  const leitura = lerOrigem(headers({ "cf-ipcountry": "BR", "x-forwarded-for": "200.1.2.3" }));

  assertEquals(leitura.valores_de_origem["cf-ipcountry"], "BR");
  assertEquals(leitura.valores_de_origem["x-forwarded-for"], "200.1.2.3");
});

Deno.test("NUNCA devolve o valor de credencial", () => {
  const leitura = lerOrigem(
    headers({
      authorization: "Bearer segredo-que-nao-pode-sair",
      apikey: "chave-que-nao-pode-sair",
      cookie: "sessao=nao-pode-sair",
      "cf-ipcountry": "PE",
    }),
  );

  // O nome aparece — é isso que conta o que existe na requisição.
  assert(leitura.todos_os_nomes.includes("authorization"), "o nome precisa aparecer");
  assert(leitura.todos_os_nomes.includes("apikey"), "o nome precisa aparecer");

  // O valor, não.
  assertEquals(leitura.valores_de_origem["authorization"], undefined);
  assertEquals(leitura.valores_de_origem["apikey"], undefined);
  assertEquals(leitura.valores_de_origem["cookie"], undefined);

  // E não pode escapar por dentro de outro campo.
  assert(
    !JSON.stringify(leitura).includes("nao-pode-sair"),
    "nenhum valor de credencial pode aparecer na resposta",
  );
});

Deno.test("acusa o país quando ele chega, e só quando chega", () => {
  assertEquals(lerOrigem(headers({ "cf-ipcountry": "MX" })).pais_chegou_de_graca, true);
  assertEquals(lerOrigem(headers({ "x-forwarded-for": "200.1.2.3" })).pais_chegou_de_graca, false);
  assertEquals(lerOrigem(headers({})).pais_chegou_de_graca, false);
});

Deno.test("os nomes vêm em minúsculo e ordenados", () => {
  const leitura = lerOrigem(headers({ "X-Real-IP": "1.2.3.4", "CF-IPCountry": "AR" }));

  assertEquals(leitura.todos_os_nomes, ["cf-ipcountry", "x-real-ip"]);
  // E a comparação da lista liberada é em minúsculo, então o valor sai mesmo
  // com o cabeçalho escrito em maiúsculas.
  assertEquals(leitura.valores_de_origem["cf-ipcountry"], "AR");
});
