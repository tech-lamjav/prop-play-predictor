import React, { useMemo, useState, useEffect } from 'react';
import { DollarSign, Pencil, Trash2, ChevronLeft, ChevronRight, Search, X, Calendar as CalendarIcon, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, Target, Flag } from 'lucide-react';
import type { CapitalMovement } from '@/hooks/use-capital-movements';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 25;

type EntryType = 'win' | 'loss' | 'cashout' | 'half_win' | 'half_loss' | 'void' | 'initial' | 'deposit' | 'withdrawal';

const TYPE_FILTER_OPTIONS: { value: EntryType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'deposit', label: 'Aportes' },
  { value: 'withdrawal', label: 'Saques' },
  { value: 'win', label: 'Ganhou' },
  { value: 'loss', label: 'Perdeu' },
  { value: 'cashout', label: 'Cashout' },
  { value: 'half_win', label: '1/2 Green' },
  { value: 'half_loss', label: '1/2 Red' },
  { value: 'void', label: 'Anulada' },
];

const parseDateString = (s: string): Date | undefined => {
  if (!s) return undefined;
  const d = parse(s, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
};
const formatDateToString = (d: Date | undefined): string => (d ? format(d, 'yyyy-MM-dd') : '');

interface Bet {
  id: string;
  bet_description: string;
  status: 'won' | 'lost' | 'cashout' | 'pending' | 'void' | 'half_won' | 'half_lost';
  stake_amount: number;
  potential_return: number;
  cashout_amount?: number;
  bet_date: string;
}

interface CashFlowTableProps {
  bets: Bet[];
  initialBankroll: number | null;
  formatCurrency: (amount: number) => string;
  capitalMovements?: CapitalMovement[];
  onEditCapitalMovement?: (id: string) => void;
  onDeleteCapitalMovement?: (id: string) => void;
  canEditMovement?: (id: string) => boolean;
}

interface CashFlowEntry {
  id: string;
  date: string;
  dateSort: number;
  description: string;
  type: 'win' | 'loss' | 'cashout' | 'half_win' | 'half_loss' | 'void' | 'initial' | 'deposit' | 'withdrawal';
  amount: number;
  balance: number;
  affectsBalance: boolean;
}

export const CashFlowTable: React.FC<CashFlowTableProps> = ({
  bets,
  initialBankroll,
  formatCurrency,
  capitalMovements = [],
  onEditCapitalMovement,
  onDeleteCapitalMovement,
  canEditMovement,
}) => {
  const showActions = Boolean(onEditCapitalMovement || onDeleteCapitalMovement);
  const isCapitalEntry = (type: CashFlowEntry['type']) => type === 'deposit' || type === 'withdrawal';
  const canEdit = (id: string) => canEditMovement === undefined || canEditMovement(id);
  const cashFlowData = useMemo(() => {
    const startBalance = initialBankroll || 0;

    const betEntries: Omit<CashFlowEntry, 'balance' | 'affectsBalance'>[] = bets
      .filter((bet) => ['won', 'lost', 'cashout', 'half_won', 'half_lost', 'void'].includes(bet.status))
      .map((bet) => {
        let amount = 0;
        let type: CashFlowEntry['type'] = 'loss';
        if (bet.status === 'won') {
          amount = bet.potential_return - bet.stake_amount;
          type = 'win';
        } else if (bet.status === 'lost') {
          amount = -bet.stake_amount;
          type = 'loss';
        } else if (bet.status === 'cashout' && bet.cashout_amount) {
          amount = bet.cashout_amount - bet.stake_amount;
          type = 'cashout';
        } else if (bet.status === 'half_won') {
          amount = (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
          type = 'half_win';
        } else if (bet.status === 'half_lost') {
          amount = bet.stake_amount / 2 - bet.stake_amount;
          type = 'half_loss';
        } else if (bet.status === 'void') {
          amount = 0;
          type = 'void';
        }
        return {
          id: bet.id,
          date: new Date(bet.bet_date).toLocaleDateString('pt-BR'),
          dateSort: new Date(bet.bet_date).getTime(),
          description: bet.bet_description,
          type,
          amount,
        };
      });

    const movementEntries: (Omit<CashFlowEntry, 'balance'> & { affectsBalance: boolean })[] = capitalMovements.map((m) => ({
      id: m.id,
      date: new Date(m.movement_date).toLocaleDateString('pt-BR'),
      dateSort: new Date(m.movement_date).getTime(),
      description:
        m.source === 'bankroll_edit'
          ? m.type === 'deposit'
            ? 'Ajuste de banca (aporte)'
            : 'Ajuste de banca (resgate)'
          : m.description || (m.type === 'deposit' ? 'Aporte' : 'Resgate'),
      type: m.type === 'deposit' ? 'deposit' : 'withdrawal',
      amount: m.type === 'deposit' ? m.amount : -m.amount,
      affectsBalance: m.affects_balance,
    }));

    const betEntriesWithAffects: (Omit<CashFlowEntry, 'balance'> & { affectsBalance: boolean })[] = betEntries.map((e) => ({
      ...e,
      affectsBalance: true,
    }));

    const allEntries = [...betEntriesWithAffects, ...movementEntries].sort((a, b) => a.dateSort - b.dateSort);

    if (allEntries.length === 0) return [];

    const entries: CashFlowEntry[] = [];
    let currentBalance = startBalance;

    entries.push({
      id: 'initial',
      date: 'Início',
      dateSort: 0,
      description: 'Saldo Inicial',
      type: 'initial',
      amount: 0,
      balance: startBalance,
      affectsBalance: true,
    });

    allEntries.forEach((e) => {
      if (e.affectsBalance) currentBalance += e.amount;

      entries.push({
        ...e,
        balance: currentBalance,
      });
    });

    return entries.reverse(); // Show newest first
  }, [bets, initialBankroll, capitalMovements]);

  // Filtros — state interno
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<EntryType[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [periodPopoverOpen, setPeriodPopoverOpen] = useState(false);

  const hasActiveFilters = searchQuery.trim() !== '' || typeFilter.length > 0 || !!dateFrom || !!dateTo;

  // Aplica filtros sobre cashFlowData (que já é o histórico completo)
  const filteredData = useMemo(() => {
    let result = cashFlowData;

    // Sempre exclui 'initial' dos filtros — fica fixo no fim como referência
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((e) => e.type === 'initial' || e.description.toLowerCase().includes(q));
    }
    if (typeFilter.length > 0) {
      result = result.filter((e) => e.type === 'initial' || typeFilter.includes(e.type as EntryType));
    }
    const fromDate = parseDateString(dateFrom);
    const toDate = parseDateString(dateTo);
    if (fromDate) {
      const fromTs = fromDate.getTime();
      result = result.filter((e) => e.type === 'initial' || e.dateSort >= fromTs);
    }
    if (toDate) {
      const toTs = toDate.getTime() + 24 * 60 * 60 * 1000 - 1; // inclusivo o dia inteiro
      result = result.filter((e) => e.type === 'initial' || e.dateSort <= toTs);
    }
    return result;
  }, [cashFlowData, searchQuery, typeFilter, dateFrom, dateTo]);

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));

  // Reset para página 1 se o total de linhas mudar (ex: edição/exclusão de movimento, mudança de filtro)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  // Reset para página 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, dateFrom, dateTo]);

  const paginatedData = useMemo(
    () => filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredData, currentPage]
  );

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter([]);
    setDateFrom('');
    setDateTo('');
  };

  const toggleTypeFilter = (value: EntryType | 'all') => {
    if (value === 'all') {
      setTypeFilter([]);
      return;
    }
    setTypeFilter((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getTypeLabel = (type: CashFlowEntry['type']) => {
    switch (type) {
      case 'win':
        return 'GANHOU';
      case 'loss':
        return 'PERDEU';
      case 'cashout':
        return 'CASHOUT';
      case 'half_win':
        return '1/2 GREEN';
      case 'half_loss':
        return '1/2 RED';
      case 'void':
        return 'ANULADA';
      case 'initial':
        return 'INICIAL';
      case 'deposit':
        return 'APORTE';
      case 'withdrawal':
        return 'RESGATE';
    }
  };

  // Ícone que distingue visualmente apostas (alvo) vs movimentos de banca (seta) vs marco inicial (bandeira)
  const getTypeIcon = (type: CashFlowEntry['type']) => {
    if (type === 'deposit') return ArrowDownCircle;
    if (type === 'withdrawal') return ArrowUpCircle;
    if (type === 'initial') return Flag;
    if (type === 'win' || type === 'half_win') return TrendingUp;
    if (type === 'loss' || type === 'half_loss') return TrendingDown;
    // cashout / void
    return Target;
  };

  const getTypePill = (type: CashFlowEntry['type']) => {
    switch (type) {
      case 'win':
        return 'bg-emerald-50 text-emerald-700';
      case 'loss':
        return 'bg-rose-50 text-rose-700';
      case 'cashout':
        return 'bg-blue-50 text-blue-700';
      case 'half_win':
        return 'bg-emerald-50/70 text-emerald-700';
      case 'half_loss':
        return 'bg-rose-50/70 text-rose-700';
      case 'void':
        return 'bg-ink-3 text-ink-2';
      case 'initial':
        return 'bg-forest-tint text-forest';
      case 'deposit':
        return 'bg-emerald-50 text-emerald-700';
      case 'withdrawal':
        return 'bg-rose-50 text-rose-700';
    }
  };

  if (cashFlowData.length === 0) {
    return (
      <div className="bg-white border border-line rounded-lg p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-forest-tint grid place-items-center">
          <DollarSign className="w-6 h-6 text-forest" />
        </div>
        <p className="text-[14px] font-medium text-ink">Nenhuma transação para exibir</p>
        <p className="text-[12px] text-ink-2 mt-1">Apostas finalizadas e movimentos aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-forest" />
            Fluxo de caixa
          </h2>
          <p className="text-[11px] text-ink-2 mt-0.5">Histórico completo de transações</p>
        </div>
        <span className="text-[11px] text-ink-2 tabular">
          {hasActiveFilters
            ? `${filteredData.filter((e) => e.type !== 'initial').length} de ${cashFlowData.filter((e) => e.type !== 'initial').length}`
            : `${cashFlowData.length} ${cashFlowData.length === 1 ? 'lançamento' : 'lançamentos'}`}
        </span>
      </div>

      {/* Filters bar */}
      <div className="px-5 py-3 border-b border-line flex flex-col md:flex-row md:items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-2.5 h-9 bg-ink-3/40 border border-line rounded-md w-full md:w-[240px] shrink-0">
          <Search className="w-4 h-4 text-ink-2 shrink-0" />
          <input
            type="text"
            placeholder="Buscar transação…"
            className="bg-transparent text-[13px] text-ink placeholder:text-ink-2 flex-1 outline-none min-w-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-ink-2 hover:text-ink"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Chips de tipo + Período (rolagem horizontal no mobile) */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 md:overflow-visible md:flex-wrap md:flex-1" style={{ scrollbarWidth: 'none' }}>
          {TYPE_FILTER_OPTIONS.map((opt) => {
            const active =
              opt.value === 'all'
                ? typeFilter.length === 0
                : typeFilter.includes(opt.value as EntryType);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleTypeFilter(opt.value)}
                className={`shrink-0 h-9 px-3 text-[12px] font-medium rounded-full border transition-colors ${
                  active ? 'bg-ink text-white border-ink' : 'bg-white text-ink-2 border-line hover:border-forest/30 hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            );
          })}

          {/* Período */}
          <Popover open={periodPopoverOpen} onOpenChange={setPeriodPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`shrink-0 h-9 px-3 text-[12px] font-medium rounded-full border inline-flex items-center gap-1.5 transition-colors ${
                  dateFrom || dateTo
                    ? 'bg-forest-tint text-forest border-forest/30'
                    : 'bg-white text-ink-2 border-line hover:border-forest/30 hover:text-ink'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                {(() => {
                  const from = parseDateString(dateFrom);
                  const to = parseDateString(dateTo);
                  if (from && to) return `${format(from, 'dd MMM', { locale: ptBR })} – ${format(to, 'dd MMM', { locale: ptBR })}`;
                  return 'Período';
                })()}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={6}
              className="theme-rebrand w-auto p-0 bg-white border border-line text-ink rounded-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)] z-[60]"
            >
              <div className="p-3 border-b border-line flex flex-wrap gap-1.5">
                {[
                  { l: '7d', days: 7 },
                  { l: '30d', days: 30 },
                  { l: '90d', days: 90 },
                ].map((p) => (
                  <button
                    key={p.l}
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const from = new Date();
                      from.setDate(today.getDate() - p.days);
                      setDateFrom(formatDateToString(from));
                      setDateTo(formatDateToString(today));
                    }}
                    className="h-8 px-3 text-[11px] font-semibold border border-line text-ink-2 hover:bg-forest-tint hover:text-forest hover:border-forest/30 rounded-md transition-colors"
                  >
                    Últimos {p.l}
                  </button>
                ))}
              </div>
              <CalendarComponent
                mode="range"
                selected={{ from: parseDateString(dateFrom), to: parseDateString(dateTo) }}
                onSelect={(range) => {
                  setDateFrom(formatDateToString(range?.from));
                  setDateTo(formatDateToString(range?.to));
                }}
                numberOfMonths={1}
                classNames={{
                  caption_label: 'text-sm font-semibold text-ink',
                  nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-ink-3/40 hover:text-ink rounded-md inline-flex items-center justify-center',
                  head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                  day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-ink-3/40 rounded-md aria-selected:opacity-100',
                  day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                  day_today: 'bg-ink-3 text-ink font-semibold',
                  day_outside: 'text-ink-2 opacity-40',
                  day_disabled: 'text-ink-2 opacity-30',
                  day_range_middle: 'aria-selected:bg-forest-tint aria-selected:text-forest aria-selected:rounded-none',
                  day_range_start: 'aria-selected:bg-forest aria-selected:text-white aria-selected:rounded-l-md aria-selected:rounded-r-none',
                  day_range_end: 'aria-selected:bg-forest aria-selected:text-white aria-selected:rounded-r-md aria-selected:rounded-l-none',
                }}
              />
              {(dateFrom || dateTo) && (
                <div className="px-3 py-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-[11px] font-semibold text-ink-2 hover:text-status-danger transition-colors"
                  >
                    Limpar período
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Limpar filtros — só aparece se houver filtros ativos */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 h-9 px-3 text-[12px] font-medium rounded-md text-ink-2 hover:text-status-danger hover:bg-status-danger/10 inline-flex items-center gap-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Estado vazio quando filtros não retornam nada */}
      {filteredData.filter((e) => e.type !== 'initial').length === 0 && hasActiveFilters && (
        <div className="p-8 text-center border-b border-line">
          <p className="text-[13px] text-ink-2">Nenhuma transação encontrada com os filtros aplicados.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-[12px] font-semibold text-forest hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-ink-3/40">
            <tr className="text-left text-[10px] uppercase tracking-[0.1em] text-ink-2 font-semibold">
              <th className="py-2.5 px-3">Data</th>
              <th className="py-2.5 px-3">Descrição</th>
              <th className="py-2.5 px-3">Tipo</th>
              <th className="py-2.5 px-3 text-right">Valor</th>
              <th className="py-2.5 px-3 text-right">Saldo após</th>
              {showActions && (
                <th className="py-2.5 px-3 text-right w-24">Ações</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((entry) => (
              <tr
                key={entry.id}
                className={`border-b border-line transition-colors last:border-0 ${
                  entry.type === 'initial' ? 'bg-forest-tint/30' : 'hover:bg-ink-3/30'
                }`}
              >
                <td className="py-2.5 px-3 tabular text-ink-2">{entry.date}</td>
                <td className="py-2.5 px-3 font-medium text-ink">
                  {entry.description}
                  {entry.type === 'initial' && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-forest font-semibold">· Início do histórico</span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`inline-flex items-center gap-1 px-2 h-5 rounded text-[10px] font-semibold uppercase tracking-[0.06em] ${getTypePill(entry.type)}`}>
                    {(() => { const Icon = getTypeIcon(entry.type); return <Icon className="w-3 h-3" />; })()}
                    {getTypeLabel(entry.type)}
                  </span>
                </td>
                <td className={`py-2.5 px-3 text-right tabular font-semibold ${
                  entry.amount > 0 ? 'text-emerald-700' :
                  entry.amount < 0 ? 'text-rose-700' :
                  'text-ink-2/60'
                }`}>
                  {entry.amount !== 0 ? (
                    <>{entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}</>
                  ) : '—'}
                </td>
                <td className={`py-2.5 px-3 text-right tabular font-medium ${
                  entry.type === 'initial'
                    ? 'text-ink'
                    : entry.balance > (initialBankroll || 0)
                      ? 'text-emerald-700'
                      : entry.balance < (initialBankroll || 0)
                        ? 'text-rose-700'
                        : 'text-ink'
                }`}>
                  {formatCurrency(entry.balance)}
                </td>
                {showActions && (
                  <td className="py-2.5 px-3 text-right">
                    {isCapitalEntry(entry.type) && (
                      <div className="inline-flex gap-1">
                        {onEditCapitalMovement && canEdit(entry.id) && (
                          <button
                            type="button"
                            className="w-9 h-9 grid place-items-center text-ink-2 hover:text-ink hover:bg-ink-3/60 rounded transition-colors"
                            onClick={() => onEditCapitalMovement(entry.id)}
                            title="Editar movimento"
                            aria-label="Editar movimento"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onDeleteCapitalMovement && (
                          <button
                            type="button"
                            className="w-9 h-9 grid place-items-center text-ink-2 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            onClick={() => onDeleteCapitalMovement(entry.id)}
                            title="Excluir movimento"
                            aria-label="Excluir movimento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-line">
        {paginatedData.map((entry) => (
          <div key={entry.id} className={`p-4 ${entry.type === 'initial' ? 'bg-forest-tint/30' : ''}`}>
            <div className="flex justify-between items-start mb-2 gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-ink-2 tabular mb-0.5">{entry.date}</div>
                <div className="text-[13px] font-medium text-ink truncate">{entry.description}</div>
                {entry.type === 'initial' && (
                  <div className="text-[10px] uppercase tracking-[0.1em] text-forest font-semibold mt-0.5">Início do histórico</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 h-5 rounded text-[10px] font-semibold uppercase tracking-[0.06em] ${getTypePill(entry.type)}`}>
                  {(() => { const Icon = getTypeIcon(entry.type); return <Icon className="w-3 h-3" />; })()}
                  {getTypeLabel(entry.type)}
                </span>
                {showActions && isCapitalEntry(entry.type) && (
                  <div className="flex gap-0.5 ml-1">
                    {onEditCapitalMovement && canEdit(entry.id) && (
                      <button
                        type="button"
                        className="w-9 h-9 grid place-items-center text-ink-2 hover:text-ink hover:bg-ink-3/60 rounded transition-colors"
                        onClick={() => onEditCapitalMovement(entry.id)}
                        title="Editar movimento"
                        aria-label="Editar movimento"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onDeleteCapitalMovement && (
                      <button
                        type="button"
                        className="w-9 h-9 grid place-items-center text-ink-2 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                        onClick={() => onDeleteCapitalMovement(entry.id)}
                        title="Excluir movimento"
                        aria-label="Excluir movimento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-end pt-2 border-t border-line">
              <div>
                <div className="text-[9px] uppercase tracking-[0.1em] text-ink-2 font-semibold">Valor</div>
                <div className={`text-[13px] font-semibold tabular ${
                  entry.amount > 0 ? 'text-emerald-700' :
                  entry.amount < 0 ? 'text-rose-700' :
                  'text-ink-2/60'
                }`}>
                  {entry.amount !== 0 ? (
                    <>{entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}</>
                  ) : '—'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.1em] text-ink-2 font-semibold">Saldo</div>
                <div className={`text-[13px] font-semibold tabular ${
                  entry.type === 'initial'
                    ? 'text-ink'
                    : entry.balance > (initialBankroll || 0)
                      ? 'text-emerald-700'
                      : entry.balance < (initialBankroll || 0)
                        ? 'text-rose-700'
                        : 'text-ink'
                }`}>{formatCurrency(entry.balance)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination footer — só aparece se houver mais de 1 página */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-line text-[12px]">
          <div className="text-[11px] text-ink-2 tabular">
            Página {currentPage} de {totalPages} · {cashFlowData.length} lançamentos
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Página anterior"
              className="h-8 w-8 inline-flex items-center justify-center text-ink-2 hover:text-ink hover:bg-ink-3/40 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {(() => {
              const pages: (number | 'ellipsis')[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);
                if (start > 2) pages.push('ellipsis');
                for (let i = start; i <= end; i++) pages.push(i);
                if (end < totalPages - 1) pages.push('ellipsis');
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="text-[11px] text-ink-2 px-1">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePageChange(p)}
                    aria-label={`Página ${p}`}
                    aria-current={p === currentPage ? 'page' : undefined}
                    className={`h-8 w-8 inline-flex items-center justify-center text-[12px] rounded-md font-medium transition-colors ${
                      p === currentPage
                        ? 'bg-forest text-white'
                        : 'text-ink-2 hover:text-ink hover:bg-ink-3/40'
                    }`}
                  >
                    {p}
                  </button>
                )
              );
            })()}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Próxima página"
              className="h-8 w-8 inline-flex items-center justify-center text-ink-2 hover:text-ink hover:bg-ink-3/40 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
