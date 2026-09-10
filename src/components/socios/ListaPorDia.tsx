import { Link } from 'react-router-dom';
import { agruparPorDia, formatarDia } from './crm-lista';
import { ROTULO_DA_POSICAO, type Lead } from './crm-painel';
import { ROTA_DOS_SOCIOS } from './crm-vocabulario';

/**
 * Os cadastros agrupados pelo dia em que nasceram.
 *
 * Não é a visão principal do painel, e é de propósito: ela responde "o que
 * aconteceu", que é uma pergunta de acompanhamento. Quem trabalha a base
 * pergunta "com quem eu falo agora", e para isso existem a fila e a tabela.
 *
 * Continua aqui porque é a única visão que mostra o RITMO de chegada — três
 * dias seguidos sem ninguém novo é uma informação que nenhuma tabela dá.
 */
export function ListaPorDia({ leads }: { leads: Lead[] }) {
  const dias = agruparPorDia(leads, (l) => l.cadastradoEm);

  if (dias.length === 0) {
    return <p className="px-4 py-6 text-[14px] text-ink-2">Nenhum cadastro com esses filtros.</p>;
  }

  return (
    <div className="p-4">
      {dias.map((grupo) => (
        <div key={grupo.dia ?? 'sem-data'} className="mb-5 last:mb-0">
          <h3 className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2">
            {grupo.dia ? formatarDia(grupo.dia) : 'Sem data de cadastro'}
            <span className="ml-2 font-sans normal-case tracking-normal text-ink-2">
              {grupo.itens.length}
            </span>
          </h3>
          <ul className="rounded-rebrand-sm border border-line-2">
            {grupo.itens.map((c) => (
              <li key={c.id} className="border-t border-line-2 first:border-t-0">
                <Link
                  to={`${ROTA_DOS_SOCIOS}/${c.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-canvas"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-ink">
                      {c.nome}
                    </p>
                    <p className="truncate text-[12px] text-ink-2">
                      {c.whatsapp ?? c.email}
                    </p>
                  </div>
                  {c.assinante && (
                    <span className="shrink-0 rounded-full bg-forest px-2 py-0.5 text-[10px] font-bold text-white">
                      {ROTULO_DA_POSICAO.assinante}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
