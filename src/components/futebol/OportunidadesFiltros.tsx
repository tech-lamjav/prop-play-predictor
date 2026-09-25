import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Chip } from './Chip';
import { ITEM_SELETOR as ITEM_CLS, SeletorDeMenu } from './SeletorDeMenu';
import type { EstadoDoJogo, Faixa, FiltroDeValor } from '@/utils/futebol-score';

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
            <Chip key={m.value} ativo={value === m.value} onClick={() => onChange(m.value)}>{m.label}</Chip>
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


/**
 * O seletor de marcar vários, um só para faixa, estado e competição.
 *
 * As três tinham a própria cópia deste menu, e as cópias já divergiam: a de
 * faixa marcava tudo pelo "Todas" e não desmarcava, a de competição devolvia
 * `null`, e as duas travavam no último item selecionado. Uma regra de seleção
 * escrita três vezes é uma regra que muda em uma e não nas outras.
 *
 * ⚠️ DESMARCAR O ÚLTIMO É PERMITIDO. A trava antiga (`if (length === 1)
 * return`) evitava a lista vazia à custa de um clique que não fazia nada e não
 * explicava por quê. Quem fica sem nenhum marcado vê a tela vazia dizendo o que
 * fazer, e isso é informação; um clique que o produto engole não é.
 */
function MultiSelect<T extends string>({
  rotulo, opcoes, selecionadas, onChange, tudoLabel, nadaLabel, plural, largura, align,
}: {
  rotulo: string;
  opcoes: readonly { value: T; label: string }[];
  selecionadas: readonly T[];
  onChange: (value: T[]) => void;
  tudoLabel: string;
  nadaLabel: string;
  plural: string;
  largura: string;
  align?: 'start' | 'end';
}) {
  const todos = opcoes.map((opcao) => opcao.value);
  const marcadas = opcoes.filter((opcao) => selecionadas.includes(opcao.value));
  const tudo = marcadas.length === opcoes.length;
  const resumo = tudo
    ? tudoLabel
    : marcadas.length === 0
      ? nadaLabel
      : marcadas.length === 1
        ? marcadas[0].label
        // "Alta e Média" em vez de "2 faixas": com três opções o nome cabe e diz
        // mais. De três para cima a contagem fica mais curta que a enumeração.
        : marcadas.length === 2 && opcoes.length <= 3
          ? `${marcadas[0].label} e ${marcadas[1].label}`
          : `${marcadas.length} ${plural}`;
  // A saída mantém a ordem da LISTA, não a ordem dos cliques: o resumo do botão
  // lê "Alta e Média" sempre, e não "Média e Alta" dependendo de por onde a
  // pessoa passou.
  const alternar = (valor: T) =>
    onChange(
      selecionadas.includes(valor)
        ? todos.filter((item) => item !== valor && selecionadas.includes(item))
        : todos.filter((item) => item === valor || selecionadas.includes(item)),
    );
  return (
    <SeletorDeMenu rotulo={rotulo} resumo={resumo} largura={largura} align={align}>
      <DropdownMenuCheckboxItem
        checked={tudo}
        onSelect={(event) => {
          event.preventDefault();
          onChange(tudo ? [] : todos);
        }}
        className={ITEM_CLS}
      >
        {tudoLabel}
      </DropdownMenuCheckboxItem>
      {opcoes.map((opcao) => (
        <DropdownMenuCheckboxItem
          key={opcao.value}
          checked={selecionadas.includes(opcao.value)}
          onSelect={(event) => {
            event.preventDefault();
            alternar(opcao.value);
          }}
          className={ITEM_CLS}
        >
          {opcao.label}
        </DropdownMenuCheckboxItem>
      ))}
    </SeletorDeMenu>
  );
}

const FAIXAS: { value: Faixa; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
];

const ESTADOS: { value: EstadoDoJogo; label: string }[] = [
  { value: 'aberto', label: 'Em aberto' },
  { value: 'ao_vivo', label: 'Ao vivo' },
  { value: 'encerrado', label: 'Encerrado' },
];

const VALORES: { value: FiltroDeValor; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'positivo', label: 'Acima do justo' },
  { value: 'perto', label: 'Até 2% abaixo' },
  { value: 'abaixo', label: 'Mais de 2% abaixo' },
];

/**
 * Seleção ÚNICA, ao contrário de faixa, estado e competição: as três opções são
 * um intervalo contínuo, e marcar "acima do justo" junto com "mais de 2%
 * abaixo" descreveria um recorte que ninguém procura. Quem quer os dois
 * extremos quer, na prática, todos.
 *
 * E por ser única, ela FECHA ao escolher. O menu de marcar vários fica aberto
 * porque o próximo clique é esperado; aqui não há próximo clique, e continuar
 * aberto era o motivo de o seletor de Valor parecer travado.
 */
function ValorSelect({ valor, onChange }: { valor: FiltroDeValor; onChange: (value: FiltroDeValor) => void }) {
  const label = VALORES.find((item) => item.value === valor)?.label ?? 'Todos';
  return (
    <SeletorDeMenu rotulo="Valor" resumo={label} largura="sm:w-[196px]">
      {VALORES.map((item) => (
        <DropdownMenuCheckboxItem
          key={item.value}
          checked={valor === item.value}
          onSelect={() => onChange(item.value)}
          className={ITEM_CLS}
        >
          {item.label}
        </DropdownMenuCheckboxItem>
      ))}
    </SeletorDeMenu>
  );
}

/**
 * A competição fala `null` com a tela, e lista com o seletor.
 *
 * `null` é "todas", e acompanha as ligas do dia sozinho em vez de congelar a
 * lista de hoje — um dia com liga nova continua com todas marcadas. A tradução
 * mora aqui, e não no seletor genérico, que não tem por que conhecer essa
 * conveniência.
 */
function CompeticaoMultiSelect({
  options, selecionadas, onChange,
}: {
  options: SelectOption[];
  selecionadas: readonly string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const todas = options.map((option) => option.value);
  // Dia sem competição nenhuma não ganha seletor. Com a lista vazia o menu
  // abria sem itens, com "Todas" marcada por vacuidade (zero de zero), e o
  // clique não mudava nada — o clique engolido que esta mudança veio tirar.
  if (options.length === 0) return null;
  return (
    <MultiSelect
      rotulo="Competição"
      opcoes={options}
      selecionadas={selecionadas ?? todas}
      onChange={(proxima) => onChange(proxima.length === todas.length ? null : proxima)}
      tudoLabel="Todas"
      nadaLabel="Nenhuma"
      plural="campeonatos"
      largura="sm:w-[208px]"
      align="end"
    />
  );
}

export function OportunidadesFiltros({
  mercado, onMercadoChange,
  estadosSelecionados, onEstadosChange,
  faixasSelecionadas, onFaixasChange,
  valor, onValorChange,
  competicoesSelecionadas, onCompeticoesChange, competicaoOptions,
}: {
  mercado: MarketFilter; onMercadoChange: (value: MarketFilter) => void;
  estadosSelecionados: readonly EstadoDoJogo[]; onEstadosChange: (value: EstadoDoJogo[]) => void;
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
      {/* Grade de dois no celular, fileira no desktop.
          A fileira rolava na horizontal, e com quatro controles de largura fixa
          era preciso arrastar para chegar ao último — arrastando justamente por
          cima de botões que abrem menu ao toque. Empilhados numa grade, os
          quatro aparecem de uma vez e não há arrasto disputando o gesto. */}
      <div data-testid="filtros-visualizacao" className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 sm:shrink-0">
        <MultiSelect
          rotulo="Estado"
          opcoes={ESTADOS}
          selecionadas={estadosSelecionados}
          onChange={onEstadosChange}
          tudoLabel="Todos"
          nadaLabel="Nenhum"
          plural="estados"
          largura="sm:w-[184px]"
        />
        <MultiSelect
          rotulo="Faixa"
          opcoes={FAIXAS}
          selecionadas={faixasSelecionadas}
          onChange={onFaixasChange}
          tudoLabel="Todas"
          nadaLabel="Nenhuma"
          plural="faixas"
          largura="sm:w-[168px]"
        />
        <ValorSelect valor={valor} onChange={onValorChange} />
        <CompeticaoMultiSelect options={competicaoOptions} selecionadas={competicoesSelecionadas} onChange={onCompeticoesChange} />
      </div>
    </div>
  );
}
