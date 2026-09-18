import type { FiltroDeWhatsApp as Valor } from './crm-painel';

/**
 * As três respostas possíveis, na ordem em que se usa.
 *
 * "Só quem tem" é o padrão porque é o trabalho: a tela abre pronta para
 * abordar, sem ninguém precisar ligar nada. "Só quem não tem" existe para
 * revisar a pilha — completar cadastro, ou decidir mandar e-mail.
 */
const OPCOES: { id: Valor; rotulo: string }[] = [
  { id: 'com', rotulo: 'Só quem tem WhatsApp' },
  { id: 'todos', rotulo: 'Com e sem WhatsApp' },
  { id: 'sem', rotulo: 'Só quem não tem WhatsApp' },
];

/**
 * O filtro de WhatsApp, no mesmo formato do de período.
 *
 * ⚠️ Um FILTRO, e não um recorte nem uma caixa de marcar. A primeira versão fez
 * disso duas peças — uma aba "Sem WhatsApp" na fileira dos recortes e uma caixa
 * "Esconder sem WhatsApp" ao lado de "Agrupar por dia" — e o Victor recusou:
 * "deveria ser um filtro mesmo, igual o desde sempre".
 *
 * Ele tinha razão, e a razão é de fundo: recorte responde "qual fatia do
 * trabalho", enquanto ter ou não número é característica do cadastro, como a
 * data em que a pessoa chegou — que já é filtro e mora do lado. Duas peças para
 * uma pergunta só ainda obrigavam a escolher entre ver a pilha e escondê-la,
 * quando a mesma peça faz as duas.
 */
export function FiltroDeWhatsApp({
  valor,
  semAsMarcas,
  suspensoPelaBusca,
  aoMudar,
}: {
  valor: Valor;
  /**
   * A consulta das marcas manuais falhou.
   *
   * O filtro continua valendo pelo número, que é a maior parte dos casos, e a
   * tela DIZ isso: calar faria a lista parecer completa quando ela não está.
   */
  semAsMarcas: boolean;
  /**
   * Tem termo de busca digitado, e por isso este filtro não está valendo.
   *
   * ⚠️ Dizer isso não é conforto: filtro ligado que silenciosamente não se
   * aplica é outra forma de a tela mentir. Quem vê "Só quem tem WhatsApp"
   * marcado e um resultado sem WhatsApp na lista precisa saber por quê.
   */
  suspensoPelaBusca: boolean;
  aoMudar: (valor: Valor) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value as Valor)}
        aria-label="Filtrar por WhatsApp"
        className="h-11 rounded-rebrand-sm border border-line-2 bg-white px-3 text-[14px] text-ink"
      >
        {OPCOES.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>

      {suspensoPelaBusca ? (
        <span className="text-[12px] text-ink-dim">a busca mostra todo mundo</span>
      ) : (
        semAsMarcas && (
          <span className="text-[12px] text-ink-dim">só pelo número — as marcas não carregaram</span>
        )
      )}
    </div>
  );
}
