import { Link } from 'react-router-dom';
import {
  agruparPorPosicao,
  DIAS_PARA_ESTAR_PARADO,
  POSICOES_CALCULADAS,
  TOM_DA_POSICAO,
  ROTULO_DA_POSICAO,
  type Lead,
} from './crm-painel';
import { NOME_DO_GANCHO } from './crm-ficha';
import { ROTA_DO_CRM } from './crm-vocabulario';
import { EtiquetaDoLead } from './EtiquetaDoLead';
import { SeloSemWhatsApp } from './SeloSemWhatsApp';

/**
 * Quantos cartões uma coluna desenha antes de dizer quantos sobraram.
 *
 * O teto não é performance, é honestidade. A base tem mais de oitenta por cento
 * em "Novo", então essa coluna tem centenas de cartões — e rolar por eles não é
 * trabalho que alguém faça. O número do que sobrou diz o tamanho do problema
 * sem fingir que a coluna é navegável.
 */
const TETO_POR_POSICAO = 25;

function Cartao({ lead }: { lead: Lead }) {
  const parado = lead.diasParado;
  const atencao = parado !== null && parado >= DIAS_PARA_ESTAR_PARADO;

  return (
    <Link
      to={`${ROTA_DO_CRM}/${lead.id}`}
      className="block rounded-rebrand-sm border border-line-2 bg-white p-2.5 hover:border-forest"
    >
      <p className="truncate text-[13px] font-bold text-ink">{lead.nome}</p>
      {/* Dentro do cartão, porque o cartão inteiro é o link. O nome acessível
          ganha a etiqueta junto, e aqui isso ajuda: quem ouve a coluna sabe
          quem está com o teste vencendo sem abrir a ficha. */}
      {/* Os dois selos dividem a mesma faixa, e cada um aparece por conta
          própria: estar em teste e não ter WhatsApp são fatos independentes, e
          alguém pode ter os dois ao mesmo tempo. */}
      {lead.etiqueta || lead.semWhatsApp ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <EtiquetaDoLead
            etiqueta={lead.etiqueta}
            fimDoTeste={lead.fimDoTeste}
            diasDeTeste={lead.diasDeTeste}
          />
          {lead.semWhatsApp ? <SeloSemWhatsApp marcado={lead.marcadoSemWhatsApp} /> : null}
        </div>
      ) : null}
      <p className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate text-ink-2">{NOME_DO_GANCHO[lead.gancho.tipo]}</span>
        {parado !== null && (
          <span
            className={`shrink-0 tabular-nums ${atencao ? 'font-bold text-ink' : 'text-ink-2'}`}
          >
            {parado}d
          </span>
        )}
      </p>
    </Link>
  );
}

/**
 * O funil em colunas.
 *
 * Vive ao lado da tabela, e não no lugar dela: os dois formatos respondem
 * perguntas diferentes. A tabela é para trabalhar a fila — quem está esperando,
 * em que ordem. O kanban é para ver a FORMA do funil, onde a base empilha.
 *
 * Os dois desenham exatamente o mesmo recorte: a busca e o filtro do funil
 * valem para os dois, senão trocar de vista mudaria o conteúdo e não só a
 * disposição.
 */
export function KanbanDeLeads({ leads }: { leads: Lead[] }) {
  const grupos = agruparPorPosicao(leads);

  return (
    <div className="flex gap-3 overflow-x-auto p-4">
      {grupos.map(({ posicao, leads: daPosicao }) => {
        const visiveis = daPosicao.slice(0, TETO_POR_POSICAO);
        const sobram = daPosicao.length - visiveis.length;
        const calculada = POSICOES_CALCULADAS.includes(posicao);

        return (
          <section
            key={posicao}
            aria-label={ROTULO_DA_POSICAO[posicao]}
            className="w-[210px] shrink-0"
          >
            {/* A régua no topo da coluna é a mesma escala do ponto da tabela:
                o olho reconhece a altura do funil antes de ler o rótulo. */}
            <div
              aria-hidden
              className={`mb-2 h-1 w-full rounded-full ${TOM_DA_POSICAO[posicao]}`}
            />

            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] font-bold text-ink">
                {ROTULO_DA_POSICAO[posicao]}
              </p>
              <span className="shrink-0 font-display text-[15px] font-black tabular-nums text-ink">
                {daPosicao.length}
              </span>
            </div>

            {/* As duas últimas colunas o banco responde: ninguém arrasta para
                elas, e a tela precisa dizer isso onde a promessa do formato é
                justamente arrastar. */}
            {calculada && <p className="mb-1 text-[10px] text-ink-2">o banco responde</p>}

            <div className="max-h-[460px] space-y-2 overflow-y-auto rounded-rebrand-sm bg-canvas p-2">
              {daPosicao.length === 0 ? (
                <p className="p-2 text-[12px] text-ink-2">vazia</p>
              ) : (
                visiveis.map((lead) => <Cartao key={lead.id} lead={lead} />)
              )}

              {sobram > 0 && (
                <p className="p-2 text-[12px] font-bold text-ink-2">
                  + {sobram} que não cabem aqui. Use a tabela para trabalhar esta coluna.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
