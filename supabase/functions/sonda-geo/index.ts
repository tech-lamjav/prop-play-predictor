// ============================================================
// sonda-geo — DESCARTÁVEL. Apague depois de ler a resposta.
// ============================================================
// Existe para responder UMA pergunta que a documentação não responde:
//
//   quando o navegador fala direto com uma edge function do Supabase,
//   QUAIS cabeçalhos de origem chegam de verdade?
//
// Por que perguntar em vez de assumir:
//
//   • O `x-forwarded-for` é o único oficialmente suportado, e há relato de ele
//     chegar vazio em parte das vezes.
//   • O `cf-ipcountry` do Cloudflare NÃO é documentado do lado do Supabase.
//     Pode estar lá, pode não estar — ninguém escreveu.
//   • A plataforma já trocou de infraestrutura de borda mais de uma vez, então
//     "funcionava em 2023" não responde por hoje.
//
// A resposta decide o desenho da camada de país inteira. Se o país chega de
// graça no cabeçalho, ele é lido a custo zero no cadastro e na assinatura. Se
// não chega, alguém vai ter que consultar um serviço de geolocalização — e aí
// passa a existir uma ida à rede no caminho, que é exatamente o que a gente
// não quer.
//
// Publicada COM verificação de JWT (sem `--no-verify-jwt`), e só em staging.
// É de propósito: o caminho que interessa medir é o do navegador autenticado,
// que é de onde a evidência vai sair quando isso for pra valer.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { lerOrigem } from "./leitura.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const leitura = lerOrigem(req.headers);

  // Sai também no log da função, porque é lá que dá pra conferir depois sem
  // precisar chamar de novo.
  console.log("[sonda-geo] nomes:", leitura.todos_os_nomes.join(", "));
  console.log("[sonda-geo] origem:", JSON.stringify(leitura.valores_de_origem));

  return new Response(JSON.stringify({ quando: new Date().toISOString(), ...leitura }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
