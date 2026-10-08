import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Chip } from './Chip';
import { ITEM_SELETOR as ITEM_CLS, SeletorDeMenu } from './SeletorDeMenu';
import type { EstadoDoJogo, Faixa } from '@/utils/futebol-score';

export type MarketFilter = 'all' | 'match_winner' | 'goals_over_under' | 'asian_handicap' | 'btts' | 'double_chance';

type SelectOption = { value: string; label: string };

const LABEL = 'text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3';

/** Valor e CHAVE do catálogo: o texto de cada mercado mora no catálogo. */
const MARKET_ITEMS: { value: MarketFilter; chave: string }[] = [
  { value: 'all', chave: 'filtros.mercado.todos' },
  { value: 'match_winner', chave: 'filtros.mercado.resultado' },
  { value: 'goals_over_under', chave: 'filtros.mercado.gols' },
  { value: 'btts', chave: 'filtros.mercado.ambosMarcam' },
  { value: 'asian_handicap', chave: 'filtros.mercado.handicap' },
  { value: 'double_chance', chave: 'filtros.mercado.duplaChance' },
];

function MarketChips({ value, onChange }: { value: MarketFilter; onChange: (m: MarketFilter) => void }) {
  const { t } = useTranslation('futebol');
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
      <span className={`${LABEL} shrink-0`}>{t('filtros.mercadoRotulo')}</span>
      <div className="relative min-w-0 flex-1">
        <div ref={ref} className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -my-1 py-1 pr-7">
          {MARKET_ITEMS.map((m) => (
            <Chip key={m.value} ativo={value === m.value} onClick={() => onChange(m.value)}>{t(m.chave)}</Chip>
          ))}
        </div>
        {more && (
          <button
            type="button"
            aria-label={t('filtros.verMais')}
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
  const { t } = useTranslation('futebol');
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
          ? t('filtros.doisRotulos', { primeiro: marcadas[0].label, segundo: marcadas[1].label })
          : t('filtros.varios', { quantidade: marcadas.length, plural });
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

/** Valor e CHAVE do catálogo, como nos mercados: o texto não mora aqui. */
const FAIXAS: { value: Faixa; chave: string }[] = [
  { value: 'alta', chave: 'faixa.alta' },
  { value: 'media', chave: 'faixa.media' },
  { value: 'baixa', chave: 'faixa.baixa' },
];

const ESTADOS: { value: EstadoDoJogo; chave: string }[] = [
  { value: 'aberto', chave: 'filtros.estado.aberto' },
  { value: 'ao_vivo', chave: 'filtros.estado.aoVivo' },
  { value: 'encerrado', chave: 'filtros.estado.encerrado' },
];

/**
 * A competição fala `null` com a tela, e lista com o seletor.
 *
 * `null` é "todas", e acompanha as ligas do dia sozinho em vez de congelar a
 * lista de hoje — um dia com liga nova continua com todas marcadas. A conversão
 * entre `null` e lista mora aqui, e não no seletor genérico, que não tem por que
 * conhecer essa conveniência.
 */
function CompeticaoMultiSelect({
  options, selecionadas, onChange,
}: {
  options: SelectOption[];
  selecionadas: readonly string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const { t } = useTranslation('futebol');
  const todas = options.map((option) => option.value);
  // Dia sem competição nenhuma não ganha seletor. Com a lista vazia o menu
  // abria sem itens, com "Todas" marcada por vacuidade (zero de zero), e o
  // clique não mudava nada — o clique engolido que esta mudança veio tirar.
  if (options.length === 0) return null;
  return (
    <MultiSelect
      rotulo={t('filtros.competicaoRotulo')}
      opcoes={options}
      selecionadas={selecionadas ?? todas}
      onChange={(proxima) => onChange(proxima.length === todas.length ? null : proxima)}
      tudoLabel={t('filtros.todas')}
      nadaLabel={t('filtros.nenhuma')}
      plural={t('filtros.plural.campeonatos')}
      largura="sm:w-[208px]"
      align="end"
    />
  );
}

export function OportunidadesFiltros({
  mercado, onMercadoChange,
  estadosSelecionados, onEstadosChange,
  faixasSelecionadas, onFaixasChange,
  competicoesSelecionadas, onCompeticoesChange, competicaoOptions,
}: {
  mercado: MarketFilter; onMercadoChange: (value: MarketFilter) => void;
  estadosSelecionados: readonly EstadoDoJogo[]; onEstadosChange: (value: EstadoDoJogo[]) => void;
  faixasSelecionadas: readonly Faixa[]; onFaixasChange: (value: Faixa[]) => void;
  competicoesSelecionadas: readonly string[] | null; onCompeticoesChange: (value: string[] | null) => void; competicaoOptions: SelectOption[];
}) {
  const { t } = useTranslation('futebol');
  // As opções nascem traduzidas aqui, e não em constante de módulo: o rótulo
  // acompanha o idioma ativo, que só existe dentro do componente.
  const estados = ESTADOS.map(({ value, chave }) => ({ value, label: t(chave) }));
  const faixas = FAIXAS.map(({ value, chave }) => ({ value, label: t(chave) }));
  return (
    <div data-tour="fut-opp-filtros" className="rounded-rebrand-md p-3 bg-white border border-line flex flex-col sm:flex-row sm:items-center gap-3">
      <div data-testid="filtros-mercado" className="min-w-0 sm:flex-1">
        <MarketChips value={mercado} onChange={onMercadoChange} />
      </div>
      <div className="h-px bg-line/70 sm:hidden" />
      {/* Uma FILEIRA, no celular e no desktop.
          Já foi grade de dois no celular, e isso resolvia um problema que não
          existe mais: eram QUATRO controles de largura fixa, a fileira rolava, e
          chegar ao último exigia arrastar por cima de botões que abrem menu ao
          toque. Com a saída do filtro de valor (#520) sobraram três, e a grade
          passou a deixar um órfão sozinho na segunda linha — mais feio do que o
          arrasto que ela evitava. Três lado a lado cabem, e o `overflow-x-auto`
          segura o caso extremo sem obrigar ninguém a arrastar no caso normal. */}
      <div data-testid="filtros-visualizacao" className="flex items-center gap-2 overflow-x-auto scrollbar-hide -my-1 py-1 sm:overflow-visible sm:shrink-0">
        <MultiSelect
          rotulo={t('filtros.estadoRotulo')}
          opcoes={estados}
          selecionadas={estadosSelecionados}
          onChange={onEstadosChange}
          tudoLabel={t('filtros.todos')}
          nadaLabel={t('filtros.nenhum')}
          plural={t('filtros.plural.estados')}
          largura="sm:w-[184px]"
        />
        <MultiSelect
          rotulo={t('filtros.faixaRotulo')}
          opcoes={faixas}
          selecionadas={faixasSelecionadas}
          onChange={onFaixasChange}
          tudoLabel={t('filtros.todas')}
          nadaLabel={t('filtros.nenhuma')}
          plural={t('filtros.plural.faixas')}
          largura="sm:w-[168px]"
        />
        <CompeticaoMultiSelect options={competicaoOptions} selecionadas={competicoesSelecionadas} onChange={onCompeticoesChange} />
      </div>
    </div>
  );
}
