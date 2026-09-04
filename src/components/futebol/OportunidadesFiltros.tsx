import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Faixa, FiltroDeValor } from '@/utils/futebol-score';

export type MarketFilter = 'all' | 'match_winner' | 'goals_over_under' | 'asian_handicap' | 'btts' | 'double_chance';

type SelectOption = { value: string; label: string };

const LABEL = 'text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3';

const MARKET_ITEMS: { value: MarketFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'match_winner', label: 'Resultado' },
  { value: 'goals_over_under', label: 'Gols' },
  { value: 'btts', label: 'Ambos marcam' },
  { value: 'asian_handicap', label: 'Handicap' },
  { value: 'double_chance', label: 'Dupla chance' },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`h-8 px-3 rounded-rebrand-sm text-[12px] font-semibold border transition-colors shrink-0 ${active ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink border-line hover:bg-canvas-2'}`}>
      {children}
    </button>
  );
}

function MarketChips({ value, onChange }: { value: MarketFilter; onChange: (m: MarketFilter) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, []);
  return (
    <div className="flex items-center gap-2.5 min-w-0 sm:flex-1">
      <span className={`${LABEL} shrink-0`}>Mercado</span>
      <div className="relative min-w-0 flex-1">
        <div ref={ref} className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -my-1 py-1 pr-7">
          {MARKET_ITEMS.map((m) => (
            <Chip key={m.value} active={value === m.value} onClick={() => onChange(m.value)}>{m.label}</Chip>
          ))}
        </div>
        {more && (
          <button
            type="button"
            aria-label="Ver mais mercados"
            onClick={() => ref.current?.scrollBy({ left: 160, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-line grid place-items-center shadow-sm hover:bg-canvas-2"
          >
            <ChevronRight className="w-3.5 h-3.5 text-ink-2" />
          </button>
        )}
      </div>
    </div>
  );
}

const FAIXAS: { value: Faixa; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

function faixaLabel(selecionadas: readonly Faixa[]): string {
  const labels = FAIXAS.filter((faixa) => selecionadas.includes(faixa.value)).map((faixa) => faixa.label);
  if (labels.length === FAIXAS.length) return 'Todas';
  return labels.length === 2 ? `${labels[0]} e ${labels[1]}` : labels[0] ?? '—';
}

function FaixaMultiSelect({ selecionadas, onChange }: { selecionadas: readonly Faixa[]; onChange: (value: Faixa[]) => void }) {
  const toggle = (faixa: Faixa) => {
    if (selecionadas.includes(faixa)) {
      if (selecionadas.length === 1) return;
      onChange(selecionadas.filter((item) => item !== faixa));
      return;
    }
    onChange(FAIXAS.filter((item) => selecionadas.includes(item.value) || item.value === faixa).map((item) => item.value));
  };
  const label = faixaLabel(selecionadas);
  const todas = selecionadas.length === FAIXAS.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label={`Faixa ${label}`} className="inline-flex w-[168px] items-center gap-1.5 h-9 px-3 rounded-rebrand-sm border border-line bg-white text-[12px] font-semibold text-ink hover:bg-canvas-2 transition shrink-0">
          <span className="text-ink-3 font-medium uppercase tracking-[0.1em] text-[10px]">Faixa</span>
          <span>{label}</span>
          <ChevronDown className="ml-auto w-3.5 h-3.5 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="theme-bolao bg-white border-line min-w-[160px]">
        {/* "Todas" em um toque: chegar às três marcando uma a uma era o atrito
            que o seletor antigo não tinha. */}
        <DropdownMenuCheckboxItem
          checked={todas}
          onSelect={(event) => {
            event.preventDefault();
            if (!todas) onChange(FAIXAS.map((item) => item.value));
          }}
          className="cursor-pointer text-[13px] text-ink focus:bg-forest-tint focus:text-forest data-[highlighted]:bg-forest-tint data-[highlighted]:text-forest data-[state=checked]:bg-forest-tint data-[state=checked]:text-forest data-[state=checked]:font-semibold"
        >
          Todas
        </DropdownMenuCheckboxItem>
        {FAIXAS.map((faixa) => (
          <DropdownMenuCheckboxItem
            key={faixa.value}
            checked={selecionadas.includes(faixa.value)}
            onSelect={(event) => {
              event.preventDefault();
              toggle(faixa.value);
            }}
            className="cursor-pointer text-[13px] text-ink focus:bg-forest-tint focus:text-forest data-[highlighted]:bg-forest-tint data-[highlighted]:text-forest data-[state=checked]:bg-forest-tint data-[state=checked]:text-forest data-[state=checked]:font-semibold"
          >
            {faixa.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const VALORES: { value: FiltroDeValor; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'positivo', label: 'Acima do justo' },
  { value: 'perto', label: 'Até 2% abaixo' },
  { value: 'abaixo', label: 'Mais de 2% abaixo' },
];

/**
 * Seleção ÚNICA, ao contrário de faixa e competição: as três opções são um
 * intervalo contínuo, e marcar "acima do justo" junto com "mais de 2% abaixo"
 * descreveria um recorte que ninguém procura. Quem quer os dois extremos quer,
 * na prática, todos.
 */
function ValorSelect({ valor, onChange }: { valor: FiltroDeValor; onChange: (value: FiltroDeValor) => void }) {
  const label = VALORES.find((item) => item.value === valor)?.label ?? 'Todos';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label={`Valor ${label}`} className="inline-flex w-[196px] items-center gap-1.5 h-9 px-3 rounded-rebrand-sm border border-line bg-white text-[12px] font-semibold text-ink hover:bg-canvas-2 transition shrink-0">
          <span className="text-ink-3 font-medium uppercase tracking-[0.1em] text-[10px]">Valor</span>
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-auto w-3.5 h-3.5 shrink-0 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="theme-bolao bg-white border-line min-w-[196px]">
        {VALORES.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.value}
            checked={valor === item.value}
            onSelect={(event) => {
              event.preventDefault();
              onChange(item.value);
            }}
            className="cursor-pointer text-[13px] text-ink focus:bg-forest-tint focus:text-forest data-[highlighted]:bg-forest-tint data-[highlighted]:text-forest data-[state=checked]:bg-forest-tint data-[state=checked]:text-forest data-[state=checked]:font-semibold"
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CompeticaoMultiSelect({
  options,
  selecionadas,
  onChange,
}: {
  options: SelectOption[];
  selecionadas: readonly string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const todas = options.map((option) => option.value);
  const selecionadasAgora = selecionadas ?? todas;
  const resumo = selecionadasAgora.length === todas.length
    ? 'Todas'
    : selecionadasAgora.length === 1
      ? options.find((option) => option.value === selecionadasAgora[0])?.label ?? '—'
      : `${selecionadasAgora.length} campeonatos`;
  const toggle = (value: string) => {
    if (selecionadasAgora.includes(value)) {
      if (selecionadasAgora.length === 1) return;
      onChange(selecionadasAgora.filter((item) => item !== value));
      return;
    }
    const proxima = options.filter((option) => selecionadasAgora.includes(option.value) || option.value === value).map((option) => option.value);
    onChange(proxima.length === todas.length ? null : proxima);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label={`Competição ${resumo}`} className="inline-flex w-[208px] items-center gap-1.5 h-9 px-3 rounded-rebrand-sm border border-line bg-white text-[12px] font-semibold text-ink hover:bg-canvas-2 transition shrink-0">
          <span className="text-ink-3 font-medium uppercase tracking-[0.1em] text-[10px]">Competição</span>
          <span className="truncate">{resumo}</span>
          <ChevronDown className="ml-auto w-3.5 h-3.5 shrink-0 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="theme-bolao bg-white border-line min-w-[208px]">
        {/* Voltar a todas tem que ser um toque. Sem esta opção, quem tirou três
            ligas precisava remarcar uma a uma — e o estado vazio da tela manda
            justamente "clicar em Todas". `null` é o valor de todas: acompanha
            as ligas do dia sozinho, em vez de congelar a lista de hoje. */}
        <DropdownMenuCheckboxItem
          checked={selecionadas === null || selecionadasAgora.length === todas.length}
          onSelect={(event) => {
            event.preventDefault();
            onChange(null);
          }}
          className="cursor-pointer text-[13px] text-ink focus:bg-forest-tint focus:text-forest data-[highlighted]:bg-forest-tint data-[highlighted]:text-forest data-[state=checked]:bg-forest-tint data-[state=checked]:text-forest data-[state=checked]:font-semibold"
        >
          Todas
        </DropdownMenuCheckboxItem>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selecionadasAgora.includes(option.value)}
            onSelect={(event) => {
              event.preventDefault();
              toggle(option.value);
            }}
            className="cursor-pointer text-[13px] text-ink focus:bg-forest-tint focus:text-forest data-[highlighted]:bg-forest-tint data-[highlighted]:text-forest data-[state=checked]:bg-forest-tint data-[state=checked]:text-forest data-[state=checked]:font-semibold"
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OportunidadesFiltros({
  mercado, onMercadoChange,
  soEmAberto, onSoEmAbertoChange,
  faixasSelecionadas, onFaixasChange,
  valor, onValorChange,
  competicoesSelecionadas, onCompeticoesChange, competicaoOptions,
}: {
  mercado: MarketFilter; onMercadoChange: (value: MarketFilter) => void;
  soEmAberto: boolean; onSoEmAbertoChange: (value: boolean) => void;
  faixasSelecionadas: readonly Faixa[]; onFaixasChange: (value: Faixa[]) => void;
  valor: FiltroDeValor; onValorChange: (value: FiltroDeValor) => void;
  competicoesSelecionadas: readonly string[] | null; onCompeticoesChange: (value: string[] | null) => void; competicaoOptions: SelectOption[];
}) {
  return (
    <div data-tour="fut-opp-filtros" className="rounded-rebrand-md p-3 bg-white border border-line flex flex-col sm:flex-row sm:items-center gap-3">
      <div data-testid="filtros-mercado" className="min-w-0 sm:flex-1">
        <MarketChips value={mercado} onChange={onMercadoChange} />
      </div>
      <div className="h-px bg-line/70 sm:hidden" />
      <div data-testid="filtros-visualizacao" className="flex items-center gap-2 overflow-x-auto scrollbar-hide -my-1 py-1 sm:flex-nowrap sm:overflow-visible sm:shrink-0">
        <button
          type="button"
          aria-pressed={soEmAberto}
          onClick={() => onSoEmAbertoChange(!soEmAberto)}
          className={`h-9 px-3 rounded-rebrand-sm text-[12px] font-semibold border transition-colors shrink-0 ${
            soEmAberto
              ? 'bg-forest text-canvas border-forest'
              : 'bg-white text-ink-2 border-line hover:bg-canvas-2 hover:text-ink'
          }`}
        >
          Só jogos em aberto
        </button>
        <FaixaMultiSelect selecionadas={faixasSelecionadas} onChange={onFaixasChange} />
        <ValorSelect valor={valor} onChange={onValorChange} />
        <CompeticaoMultiSelect options={competicaoOptions} selecionadas={competicoesSelecionadas} onChange={onCompeticoesChange} />
      </div>
    </div>
  );
}
