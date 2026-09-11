import type { ReactNode } from 'react';

/**
 * Um cartão com título, do jeito que a ficha desenha todos eles.
 *
 * Sem margem própria: quem espaça é a coluna que o contém, com `space-y`. Com
 * margem aqui, o primeiro bloco de cada coluna nascia deslocado.
 *
 * Vive em arquivo próprio porque a mensagem pronta repetia a mesma `section`,
 * o mesmo `h2` e a mesma lista de classes — inclusive o `role` e o `aria-label`
 * que os testes usam para achar cada bloco. Duas cópias divergiriam no primeiro
 * ajuste de espaçamento.
 */
export function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section
      role="region"
      aria-label={titulo}
      className="rounded-rebrand-md border border-line-2 bg-white p-5"
    >
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-2">
        {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
