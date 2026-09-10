import type { MetricasDeNegocio } from './crm-painel';

function Numero({
  valor,
  rotulo,
  explicacao,
}: {
  valor: string;
  rotulo: string;
  explicacao: string;
}) {
  return (
    <div className="flex-1 rounded-rebrand-md border border-line-2 bg-white p-4">
      <p className="font-display text-3xl font-black tabular-nums text-ink" aria-label={rotulo}>
        {valor}
      </p>
      <p className="mt-0.5 text-[13px] font-bold text-ink">{rotulo}</p>
      <p className="mt-0.5 text-[12px] text-ink-2">{explicacao}</p>
    </div>
  );
}

/**
 * Os três números de acompanhamento.
 *
 * Não são para agir hoje — para isso existe a fila logo abaixo. São para
 * responder "como está a operação" sem ter que contar nada na mão.
 *
 * "Abordados" é métrica de ESFORÇO, e é de propósito: na fase de MVP o gargalo
 * não é a conversão, é quanto da base a gente conseguiu tocar. Esse número não
 * aparece em nenhuma métrica de conversão, e é o que fica feio primeiro.
 */
export function MetricasDoTopo({ metricas }: { metricas: MetricasDeNegocio }) {
  return (
    <section role="region" aria-label="Números da operação" className="flex flex-wrap gap-3">
      <Numero
        valor={String(metricas.cadastrosNoMes)}
        rotulo="Cadastros em 30 dias"
        explicacao="quanta gente nova chegou"
      />
      <Numero
        valor={`${metricas.conversao}%`}
        rotulo="Conversão"
        explicacao={`${metricas.assinantes} ${metricas.assinantes === 1 ? 'assinante' : 'assinantes'} na base`}
      />
      <Numero
        valor={`${metricas.abordados}%`}
        rotulo="Abordados"
        explicacao="tocados por vocês, não pelo produto"
      />
    </section>
  );
}
