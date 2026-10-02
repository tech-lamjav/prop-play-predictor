import { ChevronDown } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
import { emN, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import type { LadoMedido } from './placar-por-premissa';

/** A diferença entre acesa e apagada, com o veredito. */
function Diferenca({ valor, erro, ruido }: { valor: number | null; erro: number | null; ruido: boolean }) {
  const { t } = useTranslation('socios');

  if (valor == null) return <span className="text-[13px] text-ink-dim">—</span>;

  if (ruido) {
    return (
      <span className="flex flex-col">
        <span className="text-[12px] text-ink-2">{t('quebras.premissas.ruido')}</span>
        <span className="text-[11px] tabular-nums text-ink-dim">
          {roiPct(valor)} ± {epPct(erro ?? 0)}
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span className={`text-[15px] font-black tabular-nums ${tomDoRoi(valor)}`}>
        {roiPct(valor)}
      </span>
      <span className="text-[11px] tabular-nums text-ink-dim">± {epPct(erro ?? 0)}</span>
    </span>
  );
}

/**
 * Um lado de um mercado, com as premissas dele.
 *
 * O cabeçalho é o ROI DO LADO, e ele não é enfeite: é a linha de base contra a
 * qual cada premissa é lida. Uma premissa que rende 15% num lado que rende 15%
 * não informa nada, e sem o número do lado à vista essa leitura não acontece.
 *
 * A coluna que decide é a última — a diferença entre acesa e apagada. As duas do
 * meio estão lá para mostrar de onde ela veio e sobre quantas apostas.
 *
 * No CELULAR as cinco colunas não cabem, e a tabela vira uma lista: o nome e o
 * peso à esquerda, a diferença — que é o que decide — grande à direita, e acesa
 * contra apagada numa linha embaixo. As duas frases de leitura vão para trás de
 * um "Como ler", porque com oito lados na tela elas se repetiriam oito vezes.
 */
export function PremissasDoLado({ lado }: { lado: LadoMedido }) {
  const { t } = useTranslation('socios');
  const noCelular = useIsMobile();

  return (
    // <details> e não um botão com estado: o navegador já sabe abrir e fechar,
    // já responde ao teclado, e o conteúdo fechado não some do Ctrl+F. Nasce
    // aberto porque a leitura é de cima para baixo — recolher é para o que já
    // foi lido, e com oito lados na tela isso é o que falta.
    <details open className="group rounded-rebrand-md border border-line-2 bg-white">
      <summary className="cursor-pointer list-none border-b border-line-2 px-5 py-3 marker:content-none">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <ChevronDown className="h-4 w-4 shrink-0 self-center text-ink-dim transition group-open:rotate-180" />
          {/* `lado.rotulo` vem de `placar-por-premissa.ts` (ROTULO_DO_LADO) e
              segue em português: aquele arquivo está fora deste passo. */}
          <h3 className="font-display text-[16px] font-black text-ink">{lado.rotulo}</h3>
          <span className={`text-[15px] font-black tabular-nums ${tomDoRoi(lado.total.roi)}`}>
            {roiPct(lado.total.roi)}
          </span>
          <span className="text-[12px] text-ink-dim">
            {t('quebras.deAcerto', { taxa: taxaPct(lado.total.taxa) })} · {emN(lado.total.n)} · ±{' '}
            {epPct(lado.total.ep)}
          </span>
        </div>
        {/* Sem esta frase o número do cabeçalho parece só mais um: ele é a LINHA
            DE BASE, o que teria acontecido apostando em tudo deste lado. Cada
            premissa abaixo é lida contra ele. */}
        {!noCelular && (
          <p className="mt-1 text-[12px] text-ink-2">
            <Trans
              t={t}
              i18nKey="quebras.premissas.linhaDeBase"
              components={[<strong className="text-ink" key="todas" />]}
            />
          </p>
        )}
      </summary>

      {noCelular ? (
        <>
          <ul className="divide-y divide-line-2">
            {lado.premissas.map((p) => (
              <li
                key={p.slug}
                className={`flex items-start justify-between gap-3 px-4 py-3 ${
                  p.acesa.n === 0 ? 'opacity-60' : ''
                }`}
              >
                <span className="min-w-0">
                  {/* `p.label` é o nome da premissa, de `placar-por-premissa.ts`,
                      e segue em português: aquele arquivo está fora deste passo. */}
                  <span className="block text-[14px] font-bold text-ink">{p.label}</span>
                  <span className="block text-[11px] text-ink-dim">
                    {t('quebras.premissas.peso')} {p.peso == null ? '—' : p.peso}
                  </span>
                  <span className="mt-1 block text-[12px] tabular-nums text-ink-2">
                    {p.acesa.n === 0 ? (
                      t('quebras.premissas.nuncaAcendeu')
                    ) : (
                      <>
                        {t('quebras.premissas.acesa')}{' '}
                        <span className={tomDoRoi(p.acesa.roi)}>{roiPct(p.acesa.roi)}</span>{' '}
                        <span className="text-ink-dim">{emN(p.acesa.n)}</span>
                      </>
                    )}
                    {' · '}
                    {p.apagada.n === 0 ? (
                      t('quebras.premissas.apagadaVazia')
                    ) : (
                      <>
                        {t('quebras.premissas.apagada')}{' '}
                        <span className={tomDoRoi(p.apagada.roi)}>{roiPct(p.apagada.roi)}</span>{' '}
                        <span className="text-ink-dim">{emN(p.apagada.n)}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <Diferenca valor={p.diferenca} erro={p.erro} ruido={p.dentroDoRuido} />
                </span>
              </li>
            ))}
          </ul>

          <details className="border-t border-line-2 px-4 py-2 text-[12px] text-ink-2">
            <summary className="cursor-pointer font-bold text-ink-dim">
              {t('quebras.premissas.comoLer')}
            </summary>
            {/* A MESMA frase do desktop, e por isso a MESMA chave — o que muda é
                só o destaque. O `<span>` existe para absorver a marcação sem
                pintar nada: aqui a linha é a legenda de trás de um "Como ler",
                e nela o negrito do desktop não aparecia. */}
            <p className="mt-1">
              <Trans
                t={t}
                i18nKey="quebras.premissas.linhaDeBase"
                components={[<span key="todas" />]}
              />
            </p>
            <p className="mt-1">{t('quebras.premissas.comoLerLista')}</p>
          </details>
        </>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                  <th className="px-5 py-2 font-bold">{t('quebras.premissas.coluna.premissa')}</th>
                  <th className="px-3 py-2 text-right font-bold">
                    {t('quebras.premissas.coluna.peso')}
                  </th>
                  <th className="px-3 py-2 text-right font-bold">
                    {t('quebras.premissas.coluna.roiAcesa')}
                  </th>
                  <th className="px-3 py-2 text-right font-bold">
                    {t('quebras.premissas.coluna.roiApagada')}
                  </th>
                  <th className="px-5 py-2 text-right font-bold">
                    {t('quebras.premissas.coluna.separa')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lado.premissas.map((p) => (
                  <tr
                    key={p.slug}
                    className={`border-b border-line-2 last:border-b-0 ${
                      p.acesa.n === 0 ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-5 py-2.5 text-[13px] font-bold text-ink">{p.label}</td>
                    <td className="px-3 py-2.5 text-right text-[12px] tabular-nums text-ink-2">
                      {p.peso == null ? '—' : p.peso}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                      {p.acesa.n === 0 ? (
                        <span className="text-[12px] text-ink-dim">
                          {t('quebras.premissas.nuncaAcendeu')}
                        </span>
                      ) : (
                        <>
                          <span className={tomDoRoi(p.acesa.roi)}>{roiPct(p.acesa.roi)}</span>
                          <span className="ml-1 text-[11px] text-ink-dim">{emN(p.acesa.n)}</span>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                      {p.apagada.n === 0 ? (
                        <span className="text-[12px] text-ink-dim">—</span>
                      ) : (
                        <>
                          <span className={tomDoRoi(p.apagada.roi)}>{roiPct(p.apagada.roi)}</span>
                          <span className="ml-1 text-[11px] text-ink-dim">{emN(p.apagada.n)}</span>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Diferenca valor={p.diferenca} erro={p.erro} ruido={p.dentroDoRuido} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* A legenda explica as duas leituras que a tabela pede, e existe porque
              a primeira pessoa a ver esta tabela perguntou o que ela estava
              medindo. */}
          <p className="border-t border-line-2 px-5 py-2 text-[11px] text-ink-dim">
            <Trans
              t={t}
              i18nKey="quebras.premissas.comoLerTabela"
              components={[<strong className="font-bold" key="ruido" />]}
            />
          </p>
        </>
      )}
    </details>
  );
}
