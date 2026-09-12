import type { PesoPorFaixa } from './placar-agregacao';
import type { Recorte } from './placar-filtros';
import { EXPLICACAO_DO_EIXO, type Eixo, type Periodo } from './placar-periodo';
import { RecorteESimulacao } from './RecorteESimulacao';
import { SeletorDePeriodo } from './SeletorDePeriodo';

/** Um par de botões que escolhe entre duas leituras. */
function Escolha<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: { id: T; label: string; ajuda?: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
        {rotulo}
      </span>
      <span className="flex overflow-hidden rounded-rebrand-sm border border-line-2">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            title={o.ajuda}
            onClick={() => aoMudar(o.id)}
            className={`px-3 py-2 text-[13px] font-bold transition ${
              valor === o.id ? 'bg-ink text-white' : 'bg-white text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </span>
    </span>
  );
}

/**
 * Uma barra, e não quatro linhas empilhadas.
 *
 * As escolhas do placar são quatro — período, eixo, vitrine e comparação — e elas
 * nasceram uma por linha, com a explicação de cada uma escrita ao lado. O
 * resultado ocupava meia tela antes do primeiro número e lia-se como formulário.
 *
 * Agora a comparação mora dentro do seletor de período, onde ela pertence (é uma
 * segunda janela, não um quinto filtro), e as duas escolhas que restam são pares
 * de botões com a explicação no title. O que a barra perde em texto ela ganha em
 * quantidade de tela até o primeiro número.
 */
export function BarraDeFiltros({
  periodo,
  periodoB,
  hoje,
  eixo,
  soVitrine,
  recorte,
  pesos,
  aoAplicarPeriodo,
  aoMudarEixo,
  aoMudarVitrine,
  aoMudarRecorte,
  aoMudarPesos,
}: {
  periodo: Periodo;
  periodoB: Periodo | null;
  hoje: string;
  eixo: Eixo;
  soVitrine: boolean;
  recorte: Recorte;
  pesos: PesoPorFaixa;
  aoAplicarPeriodo: (periodo: Periodo, periodoB: Periodo | null) => void;
  aoMudarEixo: (eixo: Eixo) => void;
  aoMudarVitrine: (soVitrine: boolean) => void;
  aoMudarRecorte: (r: Recorte) => void;
  aoMudarPesos: (p: PesoPorFaixa) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-2 bg-white px-4 py-3">
      <SeletorDePeriodo
        periodo={periodo}
        periodoB={periodoB}
        hoje={hoje}
        aoAplicar={aoAplicarPeriodo}
      />

      <Escolha
        rotulo="Conta"
        valor={eixo}
        opcoes={[
          { id: 'jogo' as Eixo, label: 'Por apito', ajuda: EXPLICACAO_DO_EIXO.jogo },
          { id: 'deteccao' as Eixo, label: 'Por detecção', ajuda: EXPLICACAO_DO_EIXO.deteccao },
        ]}
        aoMudar={aoMudarEixo}
      />

      <Escolha
        rotulo="Mercados"
        valor={soVitrine ? 'vitrine' : 'board'}
        opcoes={[
          {
            id: 'board',
            label: 'Board inteiro',
            ajuda: 'Inclui o mercado que saiu da vitrine. Responde como está a metodologia.',
          },
          {
            id: 'vitrine',
            label: 'Só a vitrine',
            ajuda: 'Só o que o assinante viu. Responde como foi o produto.',
          },
        ]}
        aoMudar={(v) => aoMudarVitrine(v === 'vitrine')}
      />

      <span className="ml-auto">
        <RecorteESimulacao
          recorte={recorte}
          pesos={pesos}
          aoMudarRecorte={aoMudarRecorte}
          aoMudarPesos={aoMudarPesos}
        />
      </span>
    </div>
  );
}
