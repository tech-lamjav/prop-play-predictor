import { Trans, useTranslation } from 'react-i18next';
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
              {/* `r.nome` é o valor CRU da coluna (o mercado, o esporte): fica
                  fora do catálogo, como todo valor que vem do banco. */}
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
  const { t } = useTranslation('socios');
  const primeira = dia(perfil.primeira);
  const ultima = dia(perfil.ultima);
  const mercado = principal(perfil.porMercado);
  const esporte = principal(perfil.porEsporte);

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo={t('ficha.perfil.apostas')} valor={String(perfil.total)} />
        <Numero
          rotulo={t('ficha.perfil.liquidadas')}
          valor={String(perfil.liquidadas)}
          nota={
            perfil.total > perfil.liquidadas
              ? t('ficha.perfil.emAberto', { count: perfil.total - perfil.liquidadas })
              : undefined
          }
        />
        <Numero rotulo={t('ficha.perfil.apostado')} valor={emReais(perfil.apostado)} />
        {/* ⚠️ Traço, e não "0%", quando nada liquidou. Zero por cento é uma
            afirmação, e quem só tem aposta em aberto não afirmou nada. */}
        <Numero
          rotulo={t('ficha.perfil.roiDele')}
          valor={perfil.roi === null ? '—' : emPorcento(perfil.roi)}
          nota={perfil.roi === null ? t('ficha.perfil.nadaLiquidado') : emReais(perfil.lucro)}
        />
      </div>

      {perfil.roi !== null && perfil.roi < 0 ? (
        <p className="rounded-rebrand-sm bg-canvas px-3 py-2 text-[12px] text-ink-2">
          {t('ficha.perfil.noVermelho')}
        </p>
      ) : null}

      <p className="text-[12px] text-ink-2">
        {primeira && ultima
          ? t('ficha.perfil.apostaDesde', { primeira, ultima })
          : t('ficha.perfil.semData')}
      </p>

      {ehPerfil(mercado) || ehPerfil(esporte) ? (
        <p className="text-[13px] text-ink">
          {/* `<Trans>` porque a frase tem NEGRITO dentro dela: o nome do recorte
              fica em negrito no meio do texto, e em espanhol ele não cai na
              mesma posição. Partir a frase em pedaços de texto solto amarraria
              a ordem das palavras ao português.

              ⚠️ `comOTotal` vem de `crm-perfil.ts` e devolve "2 de 3" — o "de"
              ainda é português, e não foi migrado neste passo. */}
          {ehPerfil(mercado) ? (
            <>
              {/*
               * ⚠️ O NOME VAI COMO FILHO (`<0/>`), e nunca como `values`.
               *
               * Ele é texto que o assinante DIGITOU no Betinho — mercado e
               * esporte são campo livre. Um mercado chamado "<2.5 gols" posto
               * em `values` faz o parser de nós do `<Trans>` truncar a frase
               * ali, e o resto dela desaparece sem erro no console. Foi assim
               * que o aviso de simulação do placar se partiu em "Baixa (".
               * Como filho, o nome não atravessa parser nenhum.
               */}
              <Trans
                t={t}
                i18nKey="ficha.perfil.apostaMaisEm"
                values={{ parte: comOTotal(mercado!.n, perfil.total) }}
                components={[
                  <span className="font-bold" key="nome">
                    {mercado!.nome}
                  </span>,
                ]}
              />
              {ehPerfil(esporte) ? ', ' : '.'}
            </>
          ) : null}
          {ehPerfil(esporte) ? (
            <Trans
              t={t}
              i18nKey={
                ehPerfil(mercado)
                  ? 'ficha.perfil.quaseSempreEm'
                  : 'ficha.perfil.apostaQuaseSempreEm'
              }
              values={{ parte: comOTotal(esporte!.n, perfil.total) }}
              components={[
                <span className="font-bold" key="nome">
                  {esporte!.nome}
                </span>,
              ]}
            />
          ) : null}
        </p>
      ) : (
        // ⚠️ Não chama de perfil o que são três apostas. "Aposta mais em
        // Over/Under" com N de 3 é uma frase que mente, e o sócio a levaria
        // para a conversa.
        <p className="text-[12px] text-ink-2">{t('ficha.perfil.poucasApostas')}</p>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Recortes
          titulo={t('ficha.perfil.porMercado')}
          recortes={perfil.porMercado}
          total={perfil.total}
        />
        <Recortes
          titulo={t('ficha.perfil.porEsporte')}
          recortes={perfil.porEsporte}
          total={perfil.total}
        />
      </div>

      <Recortes
        titulo={t('ficha.perfil.porFaixaDeOdd')}
        recortes={perfil.porFaixaDeOdd}
        total={perfil.total}
      />

      <p className="text-[11px] text-ink-dim">{t('ficha.perfil.soLiquidadas')}</p>
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
  const { t } = useTranslation('socios');

  if (estado.tipo === 'carregando') {
    return (
      <Bloco titulo={t('ficha.perfil.titulo')}>
        <p className="text-[13px] text-ink-2">{t('ficha.perfil.carregando')}</p>
      </Bloco>
    );
  }

  if (estado.tipo === 'erro') {
    return (
      <Bloco titulo={t('ficha.perfil.titulo')}>
        <p className="text-[13px] text-ink-2">{t('ficha.perfil.erro')}</p>
      </Bloco>
    );
  }

  if (estado.tipo === 'vazio') {
    return (
      <Bloco titulo={t('ficha.perfil.titulo')}>
        {/* Não é erro nem falta de dado: é o caso comum. Na base inteira, 110
            pessoas já registraram alguma aposta. */}
        <p className="text-[13px] text-ink-2">{t('ficha.perfil.vazio')}</p>
      </Bloco>
    );
  }

  return (
    <Bloco titulo={t('ficha.perfil.titulo')}>
      <Resumo perfil={estado.perfil} />
    </Bloco>
  );
}
