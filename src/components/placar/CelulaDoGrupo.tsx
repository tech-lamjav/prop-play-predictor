/**
 * A primeira coluna de qualquer tabela do placar: o nome do grupo e o selo dele.
 *
 * As duas tabelas — a de um período e a comparada — desenhavam este bloco
 * idêntico, incluindo as classes do selo. Uma cópia só divergiria no dia em que
 * alguém mexesse numa delas.
 */
export function CelulaDoGrupo({ nome, selo }: { nome: string; selo: string | null }) {
  return (
    <td className="px-5 py-3 text-[14px] font-bold text-ink">
      {nome}
      {selo && (
        <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-forest">
          {selo}
        </span>
      )}
    </td>
  );
}
