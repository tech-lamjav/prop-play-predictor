import { Link } from 'react-router-dom';
import { DIAS_PARA_ESTAR_PARADO, ROTULO_DA_POSICAO, type Lead } from './crm-painel';
import { NOME_DO_GANCHO } from './crm-ficha';
import { ROTA_DOS_SOCIOS } from './crm-vocabulario';

/**
 * A tabela de leads.
 *
 * Cada coluna existe para responder uma pergunta que o sócio faz antes de
 * abrir a ficha: quem é, em que pé está, o que atraiu a pessoa, e há quanto
 * tempo ninguém fala com ela. A última é a que transforma a lista em fila.
 */
export function TabelaDeLeads({ leads, vazio }: { leads: Lead[]; vazio: string }) {
  if (leads.length === 0) {
    return <p className="px-4 py-6 text-[14px] text-ink-2">{vazio}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">
            <th className="px-4 py-2 font-bold">Pessoa</th>
            <th className="px-4 py-2 font-bold">Etapa</th>
            <th className="px-4 py-2 font-bold">Gancho</th>
            <th className="px-4 py-2 text-right font-bold">Parado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-line-2 last:border-b-0 hover:bg-canvas">
              <td className="px-4 py-2.5">
                <Link
                  to={`${ROTA_DOS_SOCIOS}/${lead.id}`}
                  className="text-[14px] font-bold text-ink hover:text-forest"
                >
                  {lead.nome}
                </Link>
                <p className="truncate text-[12px] text-ink-2">
                  {lead.whatsapp ?? lead.email}
                </p>
              </td>
              <td className="px-4 py-2.5">
                <span className="rounded-full border border-line-2 px-2 py-0.5 text-[11px] font-bold text-ink-2">
                  {ROTULO_DA_POSICAO[lead.posicao]}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[13px] text-ink-2">
                {NOME_DO_GANCHO[lead.gancho.tipo]}
              </td>
              <td className="px-4 py-2.5 text-right text-[13px] tabular-nums">
                {/* Sem data nem toque não há conta a fazer, e um zero ali seria
                    resposta inventada. */}
                {lead.diasParado === null ? (
                  <span className="text-ink-2">—</span>
                ) : (
                  <span
                    className={lead.diasParado >= DIAS_PARA_ESTAR_PARADO ? 'font-bold text-ink' : 'text-ink-2'}
                  >
                    {lead.diasParado}d
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
