import type { ReactNode } from "react";

/**
 * Destaque de copy. O texto vem como string única no registry das variações,
 * então quem escreve marca dentro do próprio texto:
 *
 *   ==assim==  vira marca-texto âmbar (ou cor e peso, em fundo escuro)
 *   !!assim!!  vira vermelho de alerta (o "RED" da LP 3)
 *
 * Assim a copy continua editável por quem escreve, sem JSX no meio.
 */
export function Marcado({
  texto,
  tema = "claro",
}: {
  texto: string;
  tema?: "claro" | "escuro";
}): ReactNode {
  // O <mark> tem fundo amarelo por padrão no navegador, então todo caso
  // declara background explícito.
  const marcaTexto =
    tema === "escuro"
      ? "bg-transparent text-amber font-semibold"
      : "bg-amber/25 text-ink px-1 -mx-0.5 rounded-[3px] box-decoration-clone";
  const alerta =
    tema === "escuro"
      ? "bg-transparent font-bold text-[#ff8a70]"
      : "bg-transparent font-bold text-[var(--status-danger)]";

  const partes: ReactNode[] = [];
  const regex = /==(.+?)==|!!(.+?)!!/gs;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) partes.push(<span key={`t${i}`}>{texto.slice(ultimo, m.index)}</span>);
    if (m[1] !== undefined) {
      partes.push(
        <mark key={`m${i}`} className={marcaTexto}>
          {m[1]}
        </mark>
      );
    } else if (m[2] !== undefined) {
      partes.push(
        <mark key={`a${i}`} className={alerta}>
          {m[2]}
        </mark>
      );
    }
    ultimo = m.index + m[0].length;
    i += 1;
  }
  if (ultimo < texto.length) partes.push(<span key="fim">{texto.slice(ultimo)}</span>);

  return partes;
}
