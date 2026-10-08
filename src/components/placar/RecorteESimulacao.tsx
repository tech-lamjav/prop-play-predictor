import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fmtExato, fmtPct } from '@/utils/formato';
import { CampoNumerico } from './CampoNumerico';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ehSimulacao, type PesoPorFaixa } from './placar-agregacao';
import {
  CORTES_DE_VALOR,
  FAIXAS_PARA_FILTRAR,
  temRecorte,
  type Recorte,
} from './placar-filtros';

/** Os tamanhos de aposta que a simulação usa de verdade. */
const PESOS_RAPIDOS = [0, 0.5, 1] as const;

/**
 * O resumo que fica no botão, para o estado ser visível sem abrir.
 *
 * O `t` chega por parâmetro, e não de um `useTranslation` aqui dentro: esta é
 * uma função pura chamada no render, e trazer o hook para dentro dela a
 * transformaria num componente só para ler três palavras.
 */
function resumo(
  recorte: Recorte,
  pesos: PesoPorFaixa,
  t: (chave: string, valores?: Record<string, unknown>) => string,
): string {
  const partes: string[] = [];
  if (recorte.faixas.length > 0)
    partes.push(t('placar.recorte.faixasEscolhidas', { quantas: recorte.faixas.length }));
  if (recorte.valorMinimo != null)
    // ⚠️ O `.replace` do menos fica. `fmtPct` devolve o hífen do `Intl`, e a
    // tela escreve o menos tipográfico (−) em todo lugar — inclusive no rótulo
    // do botão "≥ −2%" logo abaixo. Sem a troca, o resumo passaria a mostrar um
    // sinal diferente do da opção que ele está resumindo.
    partes.push(
      t('placar.recorte.valorMinimoResumo', {
        valor: fmtPct(recorte.valorMinimo, 0).replace('-', '−'),
      }),
    );
  if (ehSimulacao(pesos)) partes.push(t('placar.recorte.simulando'));
  return partes.length === 0 ? t('placar.recorte.rotulo') : partes.join(' · ');
}

/**
 * O recorte da amostra e a simulação de unidades, num lugar só.
 *
 * Os dois vivem aqui porque os dois respondem "e se": e se a gente só
 * publicasse nota alta, e se a gente barrasse preço pior que o justo, e se a
 * gente apostasse menos na faixa baixa. E ficam FORA da barra principal porque
 * a barra é o que se mexe sempre — isto é o que se mexe quando há uma hipótese
 * na mão.
 *
 * Aplica no clique, ao contrário do período: recorte e peso são conta no
 * navegador, sem ida ao banco, então não há o que esperar.
 *
 * ⚠️ Filtrar e pesar não são a mesma coisa, e o texto diz. Filtrar tira a linha
 * da amostra como se ela nunca tivesse sido publicada; peso zero a mantém
 * contada à parte, porque ali a pergunta é de gerenciamento de banca e não de
 * régua de publicação.
 */
export function RecorteESimulacao({
  recorte,
  pesos,
  aoMudarRecorte,
  aoMudarPesos,
}: {
  recorte: Recorte;
  pesos: PesoPorFaixa;
  aoMudarRecorte: (r: Recorte) => void;
  aoMudarPesos: (p: PesoPorFaixa) => void;
}) {
  const { t } = useTranslation('socios');
  const ativo = temRecorte(recorte) || ehSimulacao(pesos);

  const alternarFaixa = (faixa: string) =>
    aoMudarRecorte({
      ...recorte,
      faixas: recorte.faixas.includes(faixa)
        ? recorte.faixas.filter((f) => f !== faixa)
        : [...recorte.faixas, faixa],
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-rebrand-sm border px-3 py-2 text-[13px] font-bold transition ${
            ativo
              ? 'border-forest bg-forest/10 text-forest'
              : 'border-line-2 bg-white text-ink-2 hover:border-ink hover:text-ink'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {resumo(recorte, pesos, t)}
        </button>
      </PopoverTrigger>

      {/* O tema vai no conteúdo porque o popover renderiza num portal, fora do
          wrapper de tema da página. */}
      <PopoverContent
        align="start"
        className="theme-bolao w-[22rem] max-w-[95vw] border-line-2 bg-white p-4 text-ink"
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
              {t('placar.recorte.soEstasFaixas')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {/* O nome da faixa é o valor gravado no banco (FAIXAS_DO_SCORE), e
                  por isso ele não passa pelo catálogo: é contrato de dado, e a
                  tela compara contra ele. */}
              {FAIXAS_PARA_FILTRAR.map((f) => {
                const dentro = recorte.faixas.length === 0 || recorte.faixas.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => alternarFaixa(f)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition ${
                      dentro
                        ? 'border-forest bg-forest/10 text-forest'
                        : 'border-line-2 text-ink-dim hover:text-ink'
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-ink-dim">
              {t('placar.recorte.nenhumaEhTodas')}
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
              {t('placar.recorte.valorMinimo')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {/* ⚠️ `c.rotulo` continua em português: CORTES_DE_VALOR mora em
                  `placar-filtros.ts`, que não entra nesta migração. A chave do
                  React é o VALOR, e não o rótulo: rótulo traduzido remonta a
                  lista a cada troca de idioma. */}
              {CORTES_DE_VALOR.map((c) => (
                <button
                  key={String(c.valor)}
                  type="button"
                  onClick={() => aoMudarRecorte({ ...recorte, valorMinimo: c.valor })}
                  className={`rounded-rebrand-sm border px-2.5 py-1 text-[12px] font-bold transition ${
                    recorte.valorMinimo === c.valor
                      ? 'border-forest bg-forest text-white'
                      : 'border-line-2 text-ink-2 hover:text-ink'
                  }`}
                >
                  {c.rotulo}
                </button>
              ))}
              <CampoNumerico
                aria={t('placar.recorte.valorMinimoAria')}
                sufixo="%"
                valor={recorte.valorMinimo == null ? null : recorte.valorMinimo * 100}
                aoMudar={(n) =>
                  aoMudarRecorte({ ...recorte, valorMinimo: n == null ? null : n / 100 })
                }
              />
            </div>
          </div>

          <div className="border-t border-line-2 pt-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
              {t('placar.recorte.unidadesPorFaixa')}
            </p>
            <p className="mt-1 text-[11px] text-ink-dim">
              {t('placar.recorte.unidadesPorFaixaAjuda')}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {FAIXAS_PARA_FILTRAR.map((f) => (
                <div key={f} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-ink-2">{f}</span>
                  <span className="flex items-center gap-1">
                    {/* Os atalhos existem porque "meia unidade na média" é o que
                        se quer dizer nove de cada dez vezes, e clicar não erra
                        separador decimal. O campo fica ao lado para o resto. */}
                    {PESOS_RAPIDOS.map((peso) => (
                      <button
                        key={peso}
                        type="button"
                        onClick={() => aoMudarPesos({ ...pesos, [f]: peso })}
                        className={`rounded-rebrand-sm border px-1.5 py-0.5 text-[11px] font-bold transition ${
                          (pesos[f] ?? 1) === peso
                            ? 'border-forest bg-forest text-white'
                            : 'border-line-2 text-ink-dim hover:text-ink'
                        }`}
                      >
                        {fmtExato(peso)}
                      </button>
                    ))}
                    <CampoNumerico
                      aria={t('placar.recorte.unidadesNaFaixaAria', { faixa: f })}
                      valor={pesos[f] ?? 1}
                      minimo={0}
                      maximo={5}
                      className="w-14"
                      aoMudar={(n) => aoMudarPesos({ ...pesos, [f]: n ?? 0 })}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
