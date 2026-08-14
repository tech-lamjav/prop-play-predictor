import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFutebolFixtureDays } from '@/hooks/use-futebol-data';
import { brtToday } from '@/utils/futebol-datas';

/**
 * O calendário da agenda, na casa.
 *
 * Era o `<input type="date">` nativo: vinha em inglês ("August 2026", "Mo Tu We"),
 * com o azul do sistema e os botões "Clear/Today" do Chrome, e mudava de cara a
 * cada navegador. Aqui ele usa a paleta do rebrand, fala português e, o que o
 * nativo nunca faria, **marca os dias que têm jogo** com o mesmo ponto da régua.
 *
 * A contagem do mês visível vem da mesma RPC da régua (get_futebol_fixture_days),
 * consultada só para o intervalo aberto na tela.
 */

/** YYYY-MM-DD no fuso local. `toISOString` usa UTC e devolveria o dia anterior. */
function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const dia = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

function paraData(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1);
}

export function AgendaCalendario({
  selectedDay,
  onSelectDay,
}: {
  selectedDay: string;
  onSelectDay: (day: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState<Date>(() => paraData(selectedDay));
  const hoje = brtToday();

  // Sobra de 7 dias de cada lado porque a grade mostra o fim do mês anterior e o
  // começo do próximo: sem isso, dia de fora nunca ganharia o ponto de "tem jogo".
  const inicio = useMemo(() => iso(new Date(mes.getFullYear(), mes.getMonth(), 1 - 7)), [mes]);
  const fim = useMemo(() => iso(new Date(mes.getFullYear(), mes.getMonth() + 1, 7)), [mes]);
  // Só busca com o calendário aberto: fechado, a régua já basta.
  const { data: dias } = useFutebolFixtureDays(aberto ? inicio : undefined, aberto ? fim : undefined);

  const comJogo = useMemo(() => {
    const s = new Set<string>();
    (dias ?? []).forEach((d) => {
      if (Number(d.jogos) > 0) s.add(d.day_brt);
    });
    return s;
  }, [dias]);

  const escolher = (d: Date | undefined) => {
    if (!d) return;
    setMes(d); // clicou num dia do mês vizinho: o calendário acompanha
    onSelectDay(iso(d));
    setAberto(false);
  };

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        // Abrir sempre no mês do dia escolhido: quem andou pelas setas da régua
        // espera achar o calendário onde ele parou, não onde estava da última vez.
        if (v) setMes(paraData(selectedDay));
        setAberto(v);
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="h-7 w-7 shrink-0 grid place-items-center rounded-full transition hover:bg-canvas-2"
          style={{ color: aberto ? 'var(--forest)' : '#6b6350' }}
          aria-label="Escolher data"
        >
          <CalendarDays className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        // `theme-bolao` na própria folha: o Radix porta o conteúdo pro body, fora da
        // árvore do tema, e sem isso as variáveis (--forest, --canvas-2) chegam vazias.
        className="theme-bolao w-auto p-0 rounded-[16px] border-0 shadow-lg"
        style={{ background: '#fff', border: '1px solid #ded2b6' }}
      >
        <DayPicker
          mode="single"
          locale={ptBR}
          month={mes}
          onMonthChange={setMes}
          selected={paraData(selectedDay)}
          onSelect={escolher}
          showOutsideDays
          weekStartsOn={0}
          modifiers={{
            comJogo: (d) => comJogo.has(iso(d)),
            hoje: (d) => iso(d) === hoje,
            // Modificador próprio porque o `classNames` customizado tira a classe
            // padrão do dia selecionado, e o ponto precisa clarear em cima do verde.
            escolhido: (d) => iso(d) === selectedDay,
          }}
          // O `locale` cuida dos nomes de mês e dia; os rótulos das setas ficariam em
          // inglês para o leitor de tela sem isto.
          labels={{ labelPrevious: () => 'Mês anterior', labelNext: () => 'Próximo mês' }}
          components={{
            IconLeft: () => <ChevronLeft className="w-4 h-4" />,
            IconRight: () => <ChevronRight className="w-4 h-4" />,
          }}
          className="p-3.5"
          classNames={{
            months: 'flex flex-col',
            month: 'space-y-3',
            caption: 'flex justify-center pt-0.5 relative items-center',
            caption_label: 'text-[13px] font-bold capitalize text-ink tracking-tight',
            nav: 'flex items-center',
            nav_button:
              'h-7 w-7 grid place-items-center rounded-lg text-[#6b6350] hover:bg-[var(--canvas-2)] transition',
            nav_button_previous: 'absolute left-0',
            nav_button_next: 'absolute right-0',
            table: 'w-full border-collapse',
            head_row: 'flex',
            head_cell: 'w-9 text-[10px] uppercase tracking-[0.08em] font-bold text-[#8d8672]',
            row: 'flex w-full mt-1',
            cell: 'relative p-0',
            day: 'relative h-9 w-9 rounded-[10px] text-[12.5px] font-medium text-ink tabular-nums hover:bg-[var(--canvas-2)] transition',
            day_selected: '!bg-forest !text-canvas font-bold hover:!bg-forest',
            day_outside: 'text-[#c4bda8]',
            day_disabled: 'text-[#c4bda8]',
            day_hidden: 'invisible',
          }}
          modifiersClassNames={{
            comJogo: 'fut-dia-com-jogo',
            hoje: 'fut-dia-hoje',
            escolhido: 'fut-dia-escolhido',
          }}
        />

        <div
          className="flex items-center justify-between px-3.5 py-2.5"
          style={{ borderTop: '1px solid #f1e9d6', background: '#fdfbf6' }}
        >
          <span className="inline-flex items-center gap-1.5 text-[10.5px]" style={{ color: '#8d8672' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--forest)' }} />
            dia com jogo
          </span>
          <button
            onClick={() => {
              setMes(paraData(hoje));
              onSelectDay(hoje);
              setAberto(false);
            }}
            className="text-[11.5px] font-semibold text-forest hover:underline underline-offset-2"
          >
            Ir para hoje
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
