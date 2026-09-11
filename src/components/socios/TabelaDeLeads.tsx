import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { DIAS_PARA_ESTAR_PARADO, ROTULO_DA_POSICAO, TOM_DA_POSICAO, type Lead } from './crm-painel';
import { NOME_DO_GANCHO } from './crm-ficha';
import { ROTA_DOS_SOCIOS } from './crm-vocabulario';

/**
 * As iniciais de quem está na linha.
 *
 * Duas letras no máximo. Servem de âncora para o olho descer a lista: sem elas
 * cada linha começa com um texto de tamanho diferente e não há coluna nenhuma
 * para o olho seguir. Quando o "nome" é um e-mail, a primeira letra já basta.
 */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 1).toUpperCase();
  return (partes[0].slice(0, 1) + partes[partes.length - 1].slice(0, 1)).toUpperCase();
}

/**
 * A tabela de leads.
 *
 * Cada coluna existe para responder uma pergunta que o sócio faz antes de
 * abrir a ficha: quem é, em que pé está, o que atraiu a pessoa, e há quanto
 * tempo ninguém fala com ela. A última é a que transforma a lista em fila.
 *
 * A inicial à esquerda é âncora para o olho: sem ela cada linha começa com um
 * texto de largura diferente, e não há coluna nenhuma para o olho seguir ao
 * descer a lista.
 */
export function TabelaDeLeads({ leads, vazio }: { leads: Lead[]; vazio: string }) {
  if (leads.length === 0) {
    return <p className="px-5 py-8 text-[14px] text-ink-2">{vazio}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
            <th className="px-5 py-2.5 font-bold">Pessoa</th>
            <th className="px-5 py-2.5 font-bold">Etapa</th>
            <th className="px-5 py-2.5 font-bold">Gancho</th>
            <th className="px-5 py-2.5 text-right font-bold">Parado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const parado = lead.diasParado !== null && lead.diasParado >= DIAS_PARA_ESTAR_PARADO;

            return (
              <tr
                key={lead.id}
                className="group border-b border-line-2 transition-colors last:border-b-0 hover:bg-forest/[0.04]"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/10 font-display text-[13px] font-black text-forest"
                    >
                      {iniciais(lead.nome)}
                    </span>
                    <div className="min-w-0">
                      {/* O contato fica FORA do link de propósito: dentro, o
                          nome acessível do link vira "Maria Silva 5511…", e
                          quem navega por leitor de tela ouve o telefone inteiro
                          a cada linha da lista. */}
                      <Link
                        to={`${ROTA_DOS_SOCIOS}/${lead.id}`}
                        className="block truncate text-[14px] font-bold text-ink group-hover:text-forest"
                      >
                        {lead.nome}
                      </Link>
                      <p className="truncate text-[12px] text-ink-2">
                        {lead.whatsapp ?? lead.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-white py-1 pl-2 pr-2.5 text-[11px] font-bold text-ink-2">
                    {/* O ponto diz a que altura do funil a pessoa está sem
                        obrigar a ler o rótulo: a escala escurece conforme a
                        conversa avança. */}
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${TOM_DA_POSICAO[lead.posicao]}`}
                    />
                    {ROTULO_DA_POSICAO[lead.posicao]}
                  </span>
                </td>
                <td className="px-5 py-3 text-[13px] text-ink-2">
                  {NOME_DO_GANCHO[lead.gancho.tipo]}
                </td>
                <td className="px-5 py-3 text-right text-[13px] tabular-nums">
                  {/* Sem data nem toque não há conta a fazer, e um zero ali seria
                      resposta inventada. */}
                  {lead.diasParado === null ? (
                    <span className="text-ink-dim">sem data</span>
                  ) : parado ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2 py-1 font-bold text-ink">
                      <Clock aria-hidden className="h-3 w-3" />
                      {lead.diasParado}d
                    </span>
                  ) : (
                    <span className="pr-2 text-ink-2">{lead.diasParado}d</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
