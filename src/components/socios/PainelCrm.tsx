/**
 * Quantos cadastros a base tem, ou por que ainda não dá para dizer.
 *
 * Três estados num tipo só, e não dois campos soltos. Com `total` e
 * `carregando` separados existia a combinação "sem total e sem carregar", que
 * não quer dizer nada e caía num galho que desenhava vazio — o tipo de buraco
 * que só aparece quando a consulta falha em produção.
 */
export type Contagem =
  | { estado: 'contando' }
  | { estado: 'pronta'; total: number }
  | { estado: 'erro' };

/**
 * A casca do painel dos sócios.
 *
 * Por enquanto ela prova uma coisa só, e é a coisa que importa nesta primeira
 * volta: a política de linha do banco está de pé e um sócio enxerga a base
 * inteira. O número é a prova — sem a política ele viria 1, a própria linha de
 * quem perguntou.
 *
 * A lista por dia, a busca e os contadores entram na issue seguinte.
 */
export function PainelCrm({ contagem }: { contagem: Contagem }) {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-forest">
          Uso interno
        </p>
        <h1 className="mt-2 font-display text-4xl font-black text-ink">CRM</h1>

        <div className="mt-8 rounded-rebrand-md border border-line-2 bg-white p-6">
          {contagem.estado === 'contando' && (
            <p className="text-[15px] text-ink-2">Contando os cadastros…</p>
          )}
          {contagem.estado === 'erro' && (
            <p className="text-[15px] text-ink-2">Não deu para contar os cadastros agora.</p>
          )}
          {contagem.estado === 'pronta' &&
            (contagem.total === 0 ? (
              <p className="text-[15px] text-ink-2">Nenhum cadastro na base.</p>
            ) : (
              <>
                <p className="font-display text-5xl font-black tabular-nums text-ink">
                  {contagem.total}
                </p>
                <p className="mt-1 text-[13px] text-ink-2">cadastros na base</p>
              </>
            ))}
        </div>
      </div>
    </div>
  );
}
