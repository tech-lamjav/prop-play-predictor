/**
 * Espaço reservado de prova social, nos pontos onde o documento de copy marca
 * [PROVA SOCIAL] e a gente ainda não tem material.
 *
 * Fica proposital e visivelmente marcado como reservado: valida o roteiro sem
 * colocar no ar depoimento que não existe. Depoimento inventado está na lista
 * do que a gente nunca faz (ver "o que você nunca vai ver aqui" na
 * /futebol/comecar), e em página de aposta isso é problema de consumidor.
 *
 * `escuro` para usar dentro do bloco verde.
 */
export function LpProvaSocialSlot({
  nota,
  escuro = false,
}: {
  nota: string;
  escuro?: boolean;
}) {
  const caixa = escuro
    ? "border-white/25 bg-white/[0.05]"
    : "border-line-2 bg-canvas-2/60";
  const selo = escuro
    ? "text-white/50 bg-white/[0.06] border-white/20"
    : "text-ink-3 bg-canvas border-line";
  const titulo = escuro ? "text-white/85" : "text-ink-2";
  const corpo = escuro ? "text-white/55" : "text-ink-3";

  return (
    <div className={`rounded-rebrand-md border border-dashed px-4 py-3 flex items-start gap-3 ${caixa}`}>
      <span
        className={`font-mono text-[9px] font-bold uppercase tracking-[0.16em] border rounded px-1.5 py-1 shrink-0 ${selo}`}
      >
        reservado
      </span>
      <p className={`text-[12.5px] leading-snug ${corpo}`}>
        <span className={`font-semibold ${titulo}`}>Prova social entra aqui. </span>
        {nota}
      </p>
    </div>
  );
}
