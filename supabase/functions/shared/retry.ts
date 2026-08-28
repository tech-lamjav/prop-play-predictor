// shared/retry.ts — repetição curta para LEITURAS idempotentes no PostgREST.
//
// Motivo concreto (26–27/08): ~7% das execuções do notify-settlement morreram
// com "JWT issued at future" na primeira consulta. É erro TRANSITÓRIO da
// plataforma — a chamada seguinte passa, e o projeto ainda usa a service_role
// legada (o painel já marca a chave como deprecated em favor das JWT Signing
// Keys). Sem repetição, um soluço de um segundo derruba o run inteiro e o
// healthcheck acusa a função de quebrada.
//
// Só para LEITURA: repetir um SELECT/RPC STABLE é seguro. Escrita não passa
// por aqui — quem grava tem guarda otimista própria (ver settleBet).
//
// Repete em QUALQUER erro de propósito: casar mensagem ("JWT issued at
// future", "timeout", …) é frágil e a plataforma inventa texto novo. Erro
// permanente (coluna que não existe) só custa as tentativas extras e chega
// igual ao chamador.
// run() devolve PromiseLike, não Promise: o builder do supabase-js é thenable
// (só ganha .catch/.finally depois do await), e exigir Promise aqui quebra a
// inferência de tipo de quem chama.
export async function readWithRetry<T extends { error: unknown }>(
  label: string,
  run: () => PromiseLike<T>,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 400;

  let last = await run();
  for (let i = 1; i < attempts && last.error; i++) {
    const msg = (last.error as { message?: string })?.message ?? String(last.error);
    console.warn(`readWithRetry(${label}): tentativa ${i}/${attempts} falhou (${msg}); repetindo`);
    await new Promise((r) => setTimeout(r, delayMs * i)); // 400ms, 800ms
    last = await run();
  }
  return last;
}
