import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ATALHOS, periodoAnterior, rotuloDoPeriodo, type Periodo } from './placar-periodo';

/**
 * O seletor de período, no formato que o Meta Ads usa.
 *
 * Três coisas o definem, e todas são decisão de produto e não estética:
 *
 *   · os ATALHOS ficam à esquerda, porque é por eles que se entra em 9 de cada
 *     10 vezes, e o calendário existe para a décima;
 *   · dois meses à vista, porque o período que interessa quase sempre cruza a
 *     virada do mês;
 *   · aplica no CONFIRMAR, e não a cada clique. Num painel de leitura, aplicar
 *     no clique recarrega a tela três vezes enquanto a pessoa escolhe — e com
 *     comparação ligada são seis consultas para uma decisão.
 *
 * O fuso é dito no rodapé pelo mesmo motivo que o Meta diz: o dia de um jogo
 * depende dele, e quem lê o número precisa saber qual dia é "hoje".
 */
export function SeletorDePeriodo({
  periodo,
  periodoB,
  hoje,
  aoAplicar,
}: {
  periodo: Periodo;
  periodoB: Periodo | null;
  hoje: string;
  aoAplicar: (periodo: Periodo, periodoB: Periodo | null) => void;
}) {
  const [aberto, setAberto] = useState(false);

  // O rascunho existe para o "Cancelar" ter o que descartar. Sem ele, mexer no
  // calendário já teria mudado o que a tela mostra.
  const [rascunho, setRascunho] = useState<Periodo>(periodo);
  const [comparando, setComparando] = useState(periodoB !== null);
  const [rascunhoB, setRascunhoB] = useState<Periodo>(periodoB ?? periodoAnterior(periodo));
  const primeiroFoco = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setRascunho(periodo);
    setComparando(periodoB !== null);
    setRascunhoB(periodoB ?? periodoAnterior(periodo));
  }, [aberto, periodo, periodoB]);

  const comoData = (dia: string) => new Date(`${dia}T12:00:00Z`);
  const comoDia = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const selecionar = (r: DateRange | undefined) => {
    if (!r?.from) return;
    const de = comoDia(r.from);
    const ate = r.to ? comoDia(r.to) : de;
    setRascunho({ de, ate });
    // O período de comparação segue o principal enquanto ninguém o editar à
    // mão: é o que ele quase sempre deve ser, e ficar desatualizado no meio de
    // uma escolha é como a comparação vira duas janelas sem relação.
    if (comparando) setRascunhoB(periodoAnterior({ de, ate }));
  };

  const aplicar = () => {
    aoAplicar(rascunho, comparando ? rascunhoB : null);
    setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-rebrand-sm border border-line-2 bg-white px-3 py-2 text-[13px] font-bold text-ink transition hover:border-ink"
        >
          <CalendarDays className="h-4 w-4 text-ink-dim" />
          <span>{rotuloDoPeriodo(periodo)}</span>
          {periodoB && (
            <span className="text-[12px] font-normal text-ink-dim">
              vs {rotuloDoPeriodo(periodoB)}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-ink-dim" />
        </button>
      </PopoverTrigger>

      {/* ⚠️ `theme-bolao` aqui, e não só na página: o popover do Radix renderiza
          num PORTAL, no fim do body, então ele sai de dentro do wrapper de tema
          e os tokens caem no tema padrão do app — que é escuro. Sem esta classe
          o calendário aparece preto no meio de uma tela clara. */}
      <PopoverContent align="start" className="theme-bolao w-auto max-w-[95vw] border-line-2 bg-white p-0 text-ink">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-1 border-b border-line-2 bg-canvas p-3 sm:border-b-0 sm:border-r">
            <span className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
              Atalhos
            </span>
            {ATALHOS.filter((a) => a.id !== 'personalizado').map((a, i) => {
              const janela = a.periodo(hoje);
              const ativo = janela.de === rascunho.de && janela.ate === rascunho.ate;
              return (
                <button
                  key={a.id}
                  ref={i === 0 ? primeiroFoco : undefined}
                  type="button"
                  onClick={() => {
                    setRascunho(janela);
                    if (comparando) setRascunhoB(periodoAnterior(janela));
                  }}
                  className={`rounded-rebrand-sm px-3 py-1.5 text-left text-[13px] transition ${
                    ativo ? 'bg-forest font-bold text-white' : 'text-ink-2 hover:bg-canvas'
                  }`}
                >
                  {a.rotulo}
                </button>
              );
            })}
          </div>

          <div className="p-3">
            {/* O Calendar do design system, e não o DayPicker cru: ele já traz o
                espaçamento e os dois meses lado a lado.

                ⚠️ As classes do intervalo vêm sobrescritas porque os padrões
                dele falam em `bg-primary` e `bg-accent`, e esses dois tokens o
                tema claro não redefine — eles caem no tema padrão do app, que é
                escuro. O resultado era um bloco azul-marinho no meio de um
                calendário branco. */}
            <Calendar
              classNames={{
                cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-forest/5 [&:has([aria-selected])]:bg-forest/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                day_selected:
                  'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                day_range_middle: 'aria-selected:bg-forest/10 aria-selected:text-ink',
                // ⚠️ `aria-selected:text-white` junto: hoje quase sempre É a ponta do
                // intervalo, e aí o verde do texto caía em cima do verde do fundo —
                // o número sumia. O contorno some quando selecionado pelo mesmo motivo.
                day_today:
                  'font-bold text-forest ring-1 ring-inset ring-forest aria-selected:text-white aria-selected:ring-0',
                day_outside: 'day-outside text-ink-dim opacity-50 aria-selected:bg-forest/5 aria-selected:text-ink-dim aria-selected:opacity-40',
                day_disabled: 'text-ink-dim opacity-40',
                head_cell: 'text-ink-dim rounded-md w-9 font-normal text-[0.8rem]',
                caption_label: 'text-sm font-bold text-ink',
                nav_button: 'h-7 w-7 rounded-rebrand-sm border border-line-2 bg-white p-0 text-ink-2 opacity-70 transition hover:opacity-100',
              }}
              mode="range"
              locale={ptBR}
              numberOfMonths={2}
              defaultMonth={comoData(rascunho.de)}
              selected={{ from: comoData(rascunho.de), to: comoData(rascunho.ate) }}
              onSelect={selecionar}
              disabled={{ after: comoData(hoje) }}
              className="p-0"
            />

            <label className="mt-2 flex items-center gap-2 border-t border-line-2 pt-3 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={comparando}
                onChange={(e) => {
                  setComparando(e.target.checked);
                  if (e.target.checked) setRascunhoB(periodoAnterior(rascunho));
                }}
                className="h-4 w-4 accent-forest"
              />
              Comparar com
              <span className={comparando ? 'font-bold' : 'text-ink-dim'}>
                {rotuloDoPeriodo(rascunhoB)}
              </span>
            </label>

            {comparando && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                <input
                  type="date"
                  aria-label="Início do período de comparação"
                  value={rascunhoB.de}
                  max={rascunhoB.ate}
                  onChange={(e) => setRascunhoB({ ...rascunhoB, de: e.target.value })}
                  className="rounded-rebrand-sm border border-line-2 px-2 py-1"
                />
                <span className="text-ink-dim">até</span>
                <input
                  type="date"
                  aria-label="Fim do período de comparação"
                  value={rascunhoB.ate}
                  min={rascunhoB.de}
                  onChange={(e) => setRascunhoB({ ...rascunhoB, ate: e.target.value })}
                  className="rounded-rebrand-sm border border-line-2 px-2 py-1"
                />
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-2 pt-3">
              <span className="text-[11px] text-ink-dim">Fuso das datas: Brasília</span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-rebrand-sm border border-line-2 px-3 py-1.5 text-[13px] font-bold text-ink-2 transition hover:border-ink hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={aplicar}
                  className="rounded-rebrand-sm bg-forest px-3 py-1.5 text-[13px] font-bold text-white transition hover:bg-forest/90"
                >
                  Atualizar
                </button>
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
