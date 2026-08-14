import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AgendaCalendario } from './AgendaCalendario';
import { addDays, brtToday, fmtDayChip } from '@/utils/futebol-datas';

/**
 * Navegador de datas da agenda, no formato da Direção B aprovada: um pill compacto
 * que mora NA BARRA da página, ao lado do título, em vez da faixa full-width que
 * ocupava uma seção inteira só pra escolher dia (a crítica original: "o navegável
 * da data está muito grande, ocupa a faixa inteira da tela").
 *
 * A contagem por dia (`jogosPorDia`) vem da RPC get_futebol_fixture_days. Dia sem
 * jogo continua clicável: esconder dia vazio faz a régua "pular" e o usuário perde
 * a noção de calendário — o ponto embaixo do dia é quem diz se tem jogo.
 */

const VISIBLE = 5; // dias no pill; ímpar pra ter um centro

export function AgendaDateStrip({
  selectedDay,
  onSelectDay,
  jogosPorDia,
}: {
  selectedDay: string;
  onSelectDay: (day: string) => void;
  jogosPorDia?: Map<string, number>;
}) {
  const hoje = brtToday();
  const ativoRef = useRef<HTMLButtonElement | null>(null);

  // Janela centrada no dia escolhido: mover um dia desloca a régua junto, então o
  // dia selecionado nunca sai de vista.
  const dias = useMemo(() => {
    const meio = Math.floor(VISIBLE / 2);
    return Array.from({ length: VISIBLE }, (_, i) => addDays(selectedDay, i - meio));
  }, [selectedDay]);

  // Em tela estreita o pill rola; sem isto ele abre com o dia escolhido fora da
  // vista. `block: 'nearest'` pra não dar scroll vertical na página.
  useEffect(() => {
    ativoRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selectedDay]);

  return (
    <div className="flex items-center gap-0.5 bg-white border border-line rounded-full p-1 max-w-full">
      <button
        onClick={() => onSelectDay(addDays(selectedDay, -1))}
        className="h-7 w-7 shrink-0 grid place-items-center rounded-full text-ink-3 hover:bg-canvas-2 transition"
        aria-label="Dia anterior"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
        {dias.map((dia) => {
          const ativo = dia === selectedDay;
          const isHoje = dia === hoje;
          const n = jogosPorDia?.get(dia) ?? 0;
          const { weekday, day } = fmtDayChip(dia);
          return (
            <button
              key={dia}
              ref={ativo ? ativoRef : undefined}
              onClick={() => onSelectDay(dia)}
              aria-current={ativo ? 'date' : undefined}
              className={`relative shrink-0 h-7 px-2.5 rounded-full text-[12px] font-semibold transition-colors ${
                ativo ? 'bg-forest text-canvas' : isHoje ? 'text-forest hover:bg-canvas-2' : 'text-ink-2 hover:bg-canvas-2'
              }`}
            >
              {isHoje ? 'Hoje' : `${weekday} ${day.slice(0, 2)}`}
              {/* Ponto só quando tem jogo: a ausência informa tanto quanto a presença. */}
              {n > 0 && (
                <span
                  className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                    ativo ? 'bg-canvas/70' : 'bg-forest/60'
                  }`}
                  title={`${n} ${n === 1 ? 'jogo' : 'jogos'}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelectDay(addDays(selectedDay, 1))}
        className="h-7 w-7 shrink-0 grid place-items-center rounded-full text-ink-3 hover:bg-canvas-2 transition"
        aria-label="Próximo dia"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-4 bg-line mx-0.5 shrink-0" />

      {/* Pulo de volta pra hoje, só quando hoje saiu da janela visível. */}
      {!dias.includes(hoje) && (
        <button
          onClick={() => onSelectDay(hoje)}
          className="h-7 px-2.5 shrink-0 rounded-full text-[12px] font-semibold text-ink-2 hover:bg-canvas-2 transition"
        >
          Hoje
        </button>
      )}

      {/* Calendário próprio para pular para qualquer data. O nativo do browser vinha
          em inglês, com o azul do sistema, e não sabia dizer quais dias têm jogo. */}
      <AgendaCalendario selectedDay={selectedDay} onSelectDay={onSelectDay} />
    </div>
  );
}
