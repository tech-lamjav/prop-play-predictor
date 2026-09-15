import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { emReais } from './crm-receita';
import {
  comOTotal,
  ehPerfil,
  emPorcento,
  principal,
  type Perfil,
  type Recorte,
} from './crm-perfil';
import type { EstadoDoPerfil } from '@/hooks/use-perfil-de-aposta';
import { Bloco } from './Bloco';

// ============================================================================
// O perfil de aposta, na aba de comportamento
// ============================================================================
// ⚠️ O ROI É DA PESSOA, e não nosso. A tela mostra o número sem adjetivo: quem
// está perdendo não é um problema, é uma conversa — a abertura para oferecer o
// produto que ajuda. Nas palavras do Victor: "não temos culpa da performance
// dele, na verdade é até uma forma de a gente abordar o cara".
//
// Por isso não existe verde e vermelho aqui. Pintar prejuízo de vermelho na
// ficha de um cliente transforma um dado em julgamento, e quem abre a ficha
// está prestes a falar com essa pessoa.
// ============================================================================

const dia = (carimbo: string | null) => {
  const d = brtDayOf(carimbo);
  return d ? formatarDia(d) : null;
};

/** Um número grande com o rótulo embaixo. */
function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div>
      <p className="text-[17px] font-bold leading-tight text-ink">{valor}</p>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-dim">{rotulo}</p>
      {nota ? <p className="mt-0.5 text-[11px] text-ink-2">{nota}</p> : null}
    </div>
  );
}

/**
 * Uma tabelinha de recorte: nome, quantas, e o ROI.
 *
 * A barra é a participação em QUANTIDADE, não em lucro: a pergunta é como a
 * pessoa aposta, e quem responde isso é onde ela vai mais vezes.
 */
function Recortes({
  titulo,
  recortes,
  total,
}: {
  titulo: string;
  recortes: Recorte[];
  total: number;
}) {
  if (recortes.length === 0) return null;

  return (
    <div>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-dim">{titulo}</p>
      <ul className="mt-1.5">
        {recortes.map((r) => (
          <li key={r.nome} className="border-t border-line-2 py-1.5 first:border-t-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-ink">{r.nome}</span>
              <span className="shrink-0 text-[12px] text-ink-2">
                {comOTotal(r.n, total)}
                {r.roi !== null ? ` · ${emPorcento(r.roi)}` : ''}
              </span>
            </div>
            {/* A barra é leitura de relance, e o número ao lado é a verdade.
                Sozinha ela exageraria diferenças pequenas. */}
            <div className="mt-1 h-1 w-full rounded-full bg-canvas">
              <div
                className="h-1 rounded-full bg-forest"
                style={{ width: `${Math.max(2, Math.round((r.n / Math.max(total, 1)) * 100))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Resumo({ perfil }: { perfil: Perfil }) {
  const primeira = dia(perfil.primeira);
  const ultima = dia(perfil.ultima);
  const mercado = principal(perfil.porMercado);
  const esporte = principal(perfil.porEsporte);

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Apostas" valor={String(perfil.total)} />
        <Numero
          rotulo="Liquidadas"
          valor={String(perfil.liquidadas)}
          nota={
            perfil.total > perfil.liquidadas
              ? `${perfil.total - perfil.liquidadas} em aberto`
              : undefined
          }
        />
        <Numero rotulo="Apostado" valor={emReais(perfil.apostado)} />
        {/* ⚠️ Traço, e não "0%", quando nada liquidou. Zero por cento é uma
            afirmação, e quem só tem aposta em aberto não afirmou nada. */}
        <Numero
          rotulo="ROI dele"
          valor={perfil.roi === null ? '—' : emPorcento(perfil.roi)}
          nota={perfil.roi === null ? 'nada liquidado ainda' : emReais(perfil.lucro)}
        />
      </div>

      {perfil.roi !== null && perfil.roi < 0 ? (
        <p className="rounded-rebrand-sm bg-canvas px-3 py-2 text-[12px] text-ink-2">
          Está no vermelho nas apostas dele. Não é conta nossa, e é por onde a conversa entra:
          dá para falar de gestão de banca e do que a gente tem para ajudar nisso.
        </p>
      ) : null}

      <p className="text-[12px] text-ink-2">
        {primeira && ultima
          ? `Aposta desde ${primeira}, a última em ${ultima}.`
          : 'Sem data de aposta registrada.'}
      </p>

      {ehPerfil(mercado) || ehPerfil(esporte) ? (
        <p className="text-[13px] text-ink">
          {ehPerfil(mercado) ? (
            <>
              Aposta mais em <span className="font-bold">{mercado!.nome}</span> (
              {comOTotal(mercado!.n, perfil.total)})
              {ehPerfil(esporte) ? ', ' : '.'}
            </>
          ) : null}
          {ehPerfil(esporte) ? (
            <>
              {ehPerfil(mercado) ? 'quase sempre em ' : 'Aposta quase sempre em '}
              <span className="font-bold">{esporte!.nome}</span> (
              {comOTotal(esporte!.n, perfil.total)}).
            </>
          ) : null}
        </p>
      ) : (
        // ⚠️ Não chama de perfil o que são três apostas. "Aposta mais em
        // Over/Under" com N de 3 é uma frase que mente, e o sócio a levaria
        // para a conversa.
        <p className="text-[12px] text-ink-2">
          Poucas apostas para falar em perfil. Os recortes abaixo mostram o que existe.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Recortes titulo="Por mercado" recortes={perfil.porMercado} total={perfil.total} />
        <Recortes titulo="Por esporte" recortes={perfil.porEsporte} total={perfil.total} />
      </div>

      <Recortes titulo="Por faixa de odd" recortes={perfil.porFaixaDeOdd} total={perfil.total} />

      <p className="text-[11px] text-ink-dim">
        Só o que já terminou entra nas contas de dinheiro. Aposta em aberto não tem resultado, e
        somá-la diluiria o ROI a ponto de não dizer nada.
      </p>
    </div>
  );
}

/**
 * Como essa pessoa aposta.
 *
 * Vive na aba de comportamento, ao lado do que o PostHog sabe: as duas
 * respondem a mesma pergunta por caminhos diferentes — o PostHog diz se a
 * pessoa aparece, e isto diz o que ela faz quando aparece.
 */
export function PerfilDeAposta({ estado }: { estado: EstadoDoPerfil }) {
  if (estado.tipo === 'carregando') {
    return (
      <Bloco titulo="Perfil de aposta">
        <p className="text-[13px] text-ink-2">Lendo as apostas…</p>
      </Bloco>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <Bloco titulo="Perfil de aposta">
        <p className="text-[13px] text-ink-2">Não deu para ler as apostas desta pessoa agora.</p>
      </Bloco>
    );
  }

  if (estado.tipo === 'vazio') {
    return (
      <Bloco titulo="Perfil de aposta">
        {/* Não é erro nem falta de dado: é o caso comum. Na base inteira, 110
            pessoas já registraram alguma aposta. */}
        <p className="text-[13px] text-ink-2">
          Nunca registrou aposta no Betinho. É o caso da maior parte da base, e em si já é assunto:
          quem assina e não usa é quem cancela primeiro.
        </p>
      </Bloco>
    );
  }

  return (
    <Bloco titulo="Perfil de aposta">
      <Resumo perfil={estado.perfil} />
    </Bloco>
  );
}
