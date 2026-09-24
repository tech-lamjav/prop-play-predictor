import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import {
  ESCOLHA_PADRAO,
  JANELAS_OFERECIDAS,
  METRICAS_OFERECIDAS,
  seriesDaEstatistica,
  type EscolhaDaEstatistica,
} from '@/utils/futebol-estatisticas-da-partida';
import { cabeRotulo, tetoDaEscala } from '@/utils/futebol-grafico-de-barras';
import { BlocoSerie, COR_CONTRA, COR_FAVOR } from './GraficoDeBarras';

/**
 * O jogo a jogo dos dois times, na aba de Estatísticas.
 *
 * ⚠️ O que ele mostra é **estatística da partida**, e não **evidência** de
 * premissa. É essa fronteira que autoriza a janela e o mando a serem escolha de
 * quem olha: o gráfico da aba de mercados tem os dois travados pelo modelo,
 * porque lá o gráfico responde por um número que o modelo calculou, e mudar o
 * recorte faria o desenho desmentir a frase em cima dele.
 *
 * Aqui não há premissa nenhuma sendo explicada, então não há o que desmentir —
 * e por isso este componente nunca pode ser montado embaixo de uma premissa.
 */

const LABEL = 'text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3';

/**
 * O mesmo chip da fileira de filtros de Oportunidades, de propósito: 44px de
 * alvo no celular, 32 no desktop, fundo forest quando ativo. Escrito aqui e não
 * importado de lá porque o de lá vive dentro de uma fileira que rola na
 * horizontal e carrega o comportamento dela junto; o que se quer igual é a
 * aparência do controle, que são estas classes.
 */
function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'h-11 sm:h-8 px-3 rounded-rebrand-sm text-[12px] font-semibold border transition-colors shrink-0',
        ativo ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink border-line hover:bg-canvas-2',
      )}
    >
      {children}
    </button>
  );
}

function FileiraDeChips({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className={`${LABEL} shrink-0 w-[52px]`}>{rotulo}</span>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">{children}</div>
    </div>
  );
}

export function EstatisticasDoJogo({
  historico,
  carregando,
}: {
  historico: FutebolFixtureHistorico[] | undefined;
  carregando: boolean;
}) {
  const [escolha, setEscolha] = useState<EscolhaDaEstatistica>(ESCOLHA_PADRAO);
  const series = seriesDaEstatistica(escolha, historico);
  const teto = tetoDaEscala(series);
  const comRotulo = cabeRotulo(series);
  const muda = (parte: Partial<EscolhaDaEstatistica>) => setEscolha((atual) => ({ ...atual, ...parte }));

  return (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Jogo a jogo</div>
        {/* Diz o que isto é ANTES de a pessoa ler os números. Sem esta linha, um
            gráfico do lado da leitura do modelo é lido como parte dela. */}
        <div className="text-[10px] text-ink-3 mt-0.5">
          O desempenho recente dos dois times. Não é a leitura do modelo.
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-col gap-2.5 mb-4">
          <FileiraDeChips rotulo="Mostra">
            {METRICAS_OFERECIDAS.map((m) => (
              <Chip key={m.valor} ativo={escolha.metrica === m.valor} onClick={() => muda({ metrica: m.valor })}>
                {m.rotulo}
              </Chip>
            ))}
          </FileiraDeChips>
          <FileiraDeChips rotulo="Janela">
            {JANELAS_OFERECIDAS.map((j) => (
              <Chip key={j} ativo={escolha.janela === j} onClick={() => muda({ janela: j })}>
                {`Últimos ${j}`}
              </Chip>
            ))}
          </FileiraDeChips>
          <FileiraDeChips rotulo="Mando">
            <Chip ativo={escolha.mando === 'todos'} onClick={() => muda({ mando: 'todos' })}>
              Todos os jogos
            </Chip>
            {/* "Mando deste jogo" e não "em casa": o recorte é o mandante em casa
                E o visitante fora, que são mandos opostos. Um rótulo só serve
                para os dois porque nomeia a REGRA, não um dos lados. */}
            <Chip ativo={escolha.mando === 'proprio'} onClick={() => muda({ mando: 'proprio' })}>
              Mando deste jogo
            </Chip>
          </FileiraDeChips>
        </div>

        {carregando ? (
          <p className="text-[13px] py-6 text-center" style={{ color: '#8d8672' }}>
            Carregando os jogos anteriores.
          </p>
        ) : !series.length ? (
          // Honesto sobre QUAL recorte ficou vazio: com o mando deste jogo
          // ligado, um time que só jogou fora fica sem barra nenhuma, e dizer
          // "sem histórico" mandaria a pessoa embora de um gráfico que existe.
          <p className="text-[13px] py-6 text-center" style={{ color: '#8d8672' }}>
            {escolha.mando === 'proprio'
              ? 'Nenhum dos jogos recentes bate com o mando deste confronto. Experimente todos os jogos.'
              : 'Sem jogos anteriores para estes times.'}
          </p>
        ) : (
          <>
            {/* A legenda diz o que a cor MEDE, e diz que ela não julga.
                Em gols sofridos, acima da média é barra escura — e escuro lê
                como "bom" quando ali significa ter sofrido mais gol. Inverter a
                cor por métrica embutiria um juízo que a tela não tem como
                fazer: sofrer menos é bom para o time, e para quem aposta
                depende do lado. Então a cor mede, e a frase avisa. */}
            <div className="flex flex-col items-start gap-1 mb-3 md:flex-row md:items-center md:gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_FAVOR }} />
                <span className="text-[10.5px] text-ink-2">acima da média do time</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_CONTRA }} />
                <span className="text-[10.5px] text-ink-3">abaixo da média</span>
              </span>
              <span className="text-[10.5px]" style={{ color: '#8d8672' }}>
                A cor compara com a média, não diz se foi bom.
              </span>
            </div>

            {/* Lado a lado no desktop, empilhado no celular — em 343px os dois
                blocos deixariam barras de 10px. A escala segue compartilhada nos
                dois casos, que é o que faz altura comparar entre os times. */}
            <div className="flex flex-col md:flex-row items-stretch md:items-start gap-4 md:gap-3">
              {series.map((s, i) => (
                <div
                  key={s.chave}
                  className={cn(
                    'flex min-w-0',
                    i > 0 && 'pt-4 border-t md:pt-0 md:pl-3 md:border-t-0 md:border-l border-line',
                  )}
                  style={{ flexGrow: s.jogos.length, flexBasis: 0 }}
                >
                  <BlocoSerie s={s} teto={teto} comRotulo={comRotulo} mostraComoLer={false} />
                </div>
              ))}
            </div>

            {/* Uma explicação só embaixo dos dois: as duas séries medem a MESMA
                coisa aqui, sempre, porque a métrica é uma escolha única. */}
            <div className="text-[11px] leading-relaxed mt-3" style={{ color: '#8d8672' }}>
              {series[0].comoLer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
