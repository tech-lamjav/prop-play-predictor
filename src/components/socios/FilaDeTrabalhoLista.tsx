import { DIAS_PARA_ESTAR_PARADO, type FilaDeTrabalho } from './crm-painel';
import { TabelaDeLeads } from './TabelaDeLeads';

/**
 * O que fazer agora, em duas filas que não se cruzam.
 *
 * Separadas de propósito: a fila de primeiro contato é sempre muito maior que
 * a de retomada, e numa lista só a segunda sumiria embaixo da primeira — que é
 * exatamente a que dói, porque são conversas já começadas esfriando.
 */
export function FilaDeTrabalhoLista({ fila }: { fila: FilaDeTrabalho }) {
  return (
    <div>
      <section role="region" aria-label="Conversas esfriando">
        <div className="flex items-baseline justify-between gap-3 border-b border-line-2 px-4 py-3">
          <h3 className="text-[14px] font-bold text-ink">Conversas esfriando</h3>
          <p className="text-[12px] text-ink-2">
            começadas e sem toque há {DIAS_PARA_ESTAR_PARADO} dias ou mais
          </p>
        </div>
        <TabelaDeLeads
          leads={fila.parados}
          vazio="Nenhuma conversa parada. Toda conversa começada teve toque na última semana."
        />
      </section>

      <section role="region" aria-label="Nunca abordados" className="mt-6">
        <div className="flex items-baseline justify-between gap-3 border-b border-line-2 px-4 py-3">
          <h3 className="text-[14px] font-bold text-ink">Nunca abordados</h3>
          <p className="text-[12px] text-ink-2">o mais antigo primeiro</p>
        </div>
        <TabelaDeLeads leads={fila.novosSemContato} vazio="Todo mundo da base já foi abordado." />
      </section>
    </div>
  );
}
