import { Users, TrendingUp, Handshake } from 'lucide-react';
import type { MetricasDeNegocio } from './crm-painel';

/**
 * Um número do hero.
 *
 * Número em âmbar, rótulo em maiúsculas estreitas, explicação embaixo. O âmbar
 * é o único acento da identidade e o design system reserva ele exatamente para
 * isto: o valor de um indicador.
 */
function Indicador({
  Icone,
  valor,
  rotulo,
  explicacao,
}: {
  Icone: typeof Users;
  valor: string;
  rotulo: string;
  explicacao: string;
}) {
  return (
    <div className="flex-1 min-w-[150px]">
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
        <Icone className="h-3.5 w-3.5" />
        {rotulo}
      </p>
      <p
        className="mt-1.5 font-display text-4xl font-black tabular-nums text-amber-300"
        aria-label={rotulo}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[12px] text-white/70">{explicacao}</p>
    </div>
  );
}

/**
 * Os três números de acompanhamento, no hero da identidade.
 *
 * O gradiente floresta com o brilho âmbar no canto é a única floritura do
 * design system, e ela existe justamente para o lugar onde os números são o
 * assunto. A primeira versão desenhava três cartões brancos iguais aos de
 * baixo, e o resultado é que nada na tela tinha peso — tudo pesava igual.
 *
 * Eles não são para agir hoje; para isso existe a lista logo abaixo. São para
 * responder "como está a operação" sem ter que contar nada na mão.
 *
 * "Abordados" é métrica de ESFORÇO, e é de propósito: na fase de MVP o gargalo
 * não é a conversão, é quanto da base a gente conseguiu tocar. Esse número não
 * aparece em nenhuma métrica de conversão, e é o que fica feio primeiro.
 */
export function MetricasDoTopo({ metricas }: { metricas: MetricasDeNegocio }) {
  return (
    <section
      role="region"
      aria-label="Números da operação"
      className="relative overflow-hidden rounded-rebrand-lg p-6"
      style={{ background: 'linear-gradient(135deg,#0a3d2e,#08321f 60%,#051f12)' }}
    >
      {/* O brilho âmbar no canto. Decorativo e só: fica fora da árvore de
          acessibilidade para não virar um elemento sem nome no leitor de tela. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          right: -60,
          top: -90,
          width: 320,
          height: 320,
          borderRadius: 999,
          background: 'radial-gradient(circle,rgba(251,191,36,.22),transparent 68%)',
        }}
      />

      <div className="relative flex flex-wrap gap-6">
        <Indicador
          Icone={Users}
          valor={String(metricas.cadastrosNoMes)}
          rotulo="Cadastros em 30 dias"
          explicacao="quanta gente nova chegou"
        />
        <Indicador
          Icone={TrendingUp}
          valor={`${metricas.conversao}%`}
          rotulo="Conversão"
          explicacao={`${metricas.assinantes} ${
            metricas.assinantes === 1 ? 'assinante' : 'assinantes'
          } na base`}
        />
        <Indicador
          Icone={Handshake}
          valor={`${metricas.abordados}%`}
          rotulo="Abordados"
          explicacao="tocados por vocês, não pelo produto"
        />
      </div>
    </section>
  );
}
