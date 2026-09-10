import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { historiaTruncada, tempoDeTela } from './crm-comportamento';
import type { EstadoDoComportamento } from '@/hooks/use-comportamento';
import { Bloco } from './Bloco';

const dia = (carimbo: string | null) => {
  const d = brtDayOf(carimbo);
  return d ? formatarDia(d) : null;
};

/**
 * O que o PostHog sabe sobre a pessoa.
 *
 * O bloco existia desde a primeira volta como lugar reservado, dizendo que os
 * números moravam no PostHog e ainda não estavam aqui. Agora estão.
 *
 * ⚠️ Ele diz de quando a história começa, e não só os totais. Se o plano do
 * PostHog descartou o que era antigo, "2 sessões" para quem se cadastrou em
 * março parece abandono — e pode ser só retenção de dados. O aviso é o que
 * separa as duas leituras.
 */
export function BlocoDeComportamento({
  estado,
  cadastradoEm,
}: {
  estado: EstadoDoComportamento;
  cadastradoEm: string | null;
}) {
  if (estado.tipo === 'carregando') {
    return (
      <Bloco titulo="Comportamento">
        <p className="text-[13px] text-ink-2">Consultando o PostHog…</p>
      </Bloco>
    );
  }

  if (estado.tipo === 'erro') {
    const semChave = estado.motivo.includes('sem_chave');
    return (
      <Bloco titulo="Comportamento">
        <p className="text-[13px] text-ink-2">
          {semChave
            ? 'A chave de consulta do PostHog não está configurada neste ambiente.'
            : 'Não deu para consultar o PostHog agora.'}
        </p>
      </Bloco>
    );
  }

  const { comportamento: c } = estado;
  const primeiro = dia(c.primeiroEvento);
  const ultimo = dia(c.ultimoEvento);

  if (c.sessoes === 0) {
    return (
      <Bloco titulo="Comportamento">
        {/* Zero sessão é informação, e das boas: a pessoa se cadastrou e nunca
            voltou. Dizer isso é diferente de deixar o bloco vazio. */}
        <p className="text-[13px] text-ink-2">
          Nenhuma visita registrada. A pessoa se cadastrou e não voltou ao site.
        </p>
      </Bloco>
    );
  }

  return (
    <Bloco titulo="Comportamento">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <p className="font-display text-xl font-black tabular-nums text-ink" aria-label="Sessões">
            {c.sessoes}
          </p>
          <p className="text-[12px] text-ink-2">{c.sessoes === 1 ? 'visita' : 'visitas'}</p>
        </div>
        <div>
          <p className="text-[15px] font-bold text-ink" aria-label="Tempo de tela">
            {tempoDeTela(c.segundosDeTela)}
          </p>
          <p className="text-[12px] text-ink-2">de tela, somado</p>
        </div>
        {ultimo && (
          <div>
            <p className="text-[15px] font-bold text-ink" aria-label="Última visita">
              {ultimo}
            </p>
            <p className="text-[12px] text-ink-2">última visita</p>
          </div>
        )}
      </div>

      {c.paginas.length > 0 && (
        <ul className="mt-3 border-t border-line-2 pt-2">
          {c.paginas.map((p) => (
            <li key={p.caminho} className="flex justify-between gap-3 py-0.5 text-[13px]">
              <span className="truncate text-ink-2">{p.caminho || '(sem caminho)'}</span>
              <span className="tabular-nums text-ink">{p.vezes}</span>
            </li>
          ))}
        </ul>
      )}

      {historiaTruncada(c, cadastradoEm) && primeiro && (
        <p className="mt-3 text-[12px] text-ink-2">
          O PostHog só guarda eventos desde {primeiro}, e esta pessoa se cadastrou antes disso.
          Estes números são desse recorte, não de sempre.
        </p>
      )}
    </Bloco>
  );
}
