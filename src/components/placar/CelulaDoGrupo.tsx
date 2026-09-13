/**
 * A primeira coluna de qualquer tabela do placar: o nome do grupo e o selo dele.
 *
 * As duas tabelas — a de um período e a comparada — desenhavam este bloco
 * idêntico, incluindo as classes do selo. Uma cópia só divergiria no dia em que
 * alguém mexesse numa delas.
 *
 * Ela não rola junto no celular: a tabela é mais larga que a tela, e sem a
 * identidade presa a pessoa arrasta para o lado e perde de quem é a linha. O
 * fundo opaco é o que faz o resto passar por baixo.
 */
export function CelulaDoGrupo({ nome, selo }: { nome: string; selo: string | null }) {
  return (
    <td className="sticky left-0 z-10 border-r border-line-2 bg-white px-4 py-3 text-[14px] font-bold text-ink sm:border-r-0 sm:px-5">
      {nome}
      {selo && (
        <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-forest">
          {selo}
        </span>
      )}
    </td>
  );
}
