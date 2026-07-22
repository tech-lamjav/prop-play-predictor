import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/use-auth';
import { createClient } from '../integrations/supabase/client';
import { BetsHeader } from '../components/bets/BetsHeader';
import { BetStatsCard } from '../components/bets/BetStatsCard';
import { TagSelector } from '../components/bets/TagSelector';
import { UnitConfigurationModal } from '../components/UnitConfigurationModal';
import { BankrollEvolutionChart } from '@/components/bets/BankrollEvolutionChart';
import { CreateBetModal, CreateBetFormData } from '@/components/bets/CreateBetModal';
import { ShareLinkModal } from '@/components/bets/ShareLinkModal';
import { ReferralModal } from '../components/ReferralModal';
import { useUserUnit } from '@/hooks/use-user-unit';
import { useCapitalMovements } from '@/hooks/use-capital-movements';
import { useBetinhoPremium } from '@/hooks/use-betinho-premium';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { SETTLED } from '@/utils/dashboardAggregations';
import { MultiSelectFilter } from '../components/ui/multi-select-filter';
import { 
  RefreshCw, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  DollarSign,
  Calendar as CalendarIcon,
  X,
  Filter,
  Edit,
  Save,
  Settings,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Plus,
  BarChart3,
  Send,
  Download,
  Share2
} from 'lucide-react';
import { telegramBotUrl } from '../config/environment';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '../components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { useToast } from '../hooks/use-toast';
import { format, parse, isValid, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Bet {
  id: string;
  user_id: string;
  bet_type: string;
  sport: string;
  league?: string;
  betting_market?: string;
  match_description?: string;
  bet_description: string;
  odds: number;
  stake_amount: number;
  potential_return: number;
  is_credit_bet?: boolean;
  status: 'pending' | 'won' | 'lost' | 'void' | 'cashout' | 'half_won' | 'half_lost';
  bet_date: string;
  match_date?: string;
  created_at: string;
  updated_at: string;
  raw_input?: string;
  processed_data?: any;
  cashout_amount?: number;
  cashout_date?: string;
  cashout_odds?: number;
  is_cashout?: boolean;
  channel?: string;
  tags?: Tag[];
}

/** Trunca texto em até maxLength caracteres, mantendo quebras de linha (\n) no resultado. */
function truncateDescription(text: string | undefined, maxLength: number = 50): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

const SPORTS_LIST = [
  'Futebol',
  'Basquete',
  'Atletismo',
  'Automobilismo',
  'Badminton',
  'Beisebol',
  'Biatlo',
  'Boxe',
  'Corrida de Cavalos',
  'Críquete',
  'Ciclismo',
  'Dardos',
  'eSports',
  'Esqui',
  'Futebol Americano',
  'Futsal',
  'Golfe',
  'Handebol',
  'Hóquei no Gelo',
  'MMA/UFC',
  'Natação',
  'Outros',
  'Padel',
  'Rugby',
  'Snooker',
  'Tênis',
  'Tênis de Mesa',
  'Vôlei',
  'Vôlei de Praia',
];

const LEAGUES_LIST = [
  'US - NBA',
  'BR - Série A',
  'EU - Champions League',
  'AL - Bundesliga',
  'AME - Copa Libertadores',
  'AME - Copa Sul-Americana',
  'AU - NBL',
  'BEL - Pro League',
  'BR - Copa do Brasil',
  'BR - Paulistão',
  'Diversos',
  'EN - Premier League',
  'ES - La Liga',
  'EU - Conference League',
  'EU - Eliminatórias UEFA Copa do Mundo',
  'EU - Europa League',
  'Fórmula 1',
  'FR - Ligue 1',
  'Futebol',
  'HOL - Eerste Divisie',
  'ITA - Série A',
  'ME - Liga Premier',
  'Mundial de Clubes FIFA',
  'Outros',
  'PT - Primeira Liga',
  'SAU - Pro League',
  'TUR - Lig 1',
  'US - NFL',
];

const BETTING_MARKETS_LIST = [
  'Múltipla',
  'Money Line',
  'Handicap',
  'Over/Under',
  'Dupla Chance',
  'Ambas Marcam',
];

type BetRowProps = {
  bet: Bet;
  formatValue: (value: number) => string;
  formatBetDate: (dateStr: string) => string;
  translateStatus: (status: string) => string;
  onBetTagsChange: (betId: string, newTags: Tag[], currentTagIds: string[]) => Promise<void>;
  onTagsUpdated: () => void;
  availableTags: Tag[];
  updateBetStatus: (betId: string, newStatus: string) => void;
  openCashoutModal: (bet: Bet) => void;
  openEditModal: (bet: Bet) => void;
  deleteBet: (betId: string) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
};

const BetRow = React.memo(function BetRow({
  bet,
  formatValue,
  formatBetDate,
  translateStatus,
  onBetTagsChange,
  onTagsUpdated,
  availableTags,
  updateBetStatus,
  openCashoutModal,
  openEditModal,
  deleteBet,
  isSelected,
  onToggleSelect,
}: BetRowProps) {
  const handleTagsChange = useCallback((newTags: Tag[]) => {
    onBetTagsChange(bet.id, newTags, (bet.tags || []).map(t => t.id));
  }, [bet.id, bet.tags, onBetTagsChange]);

  const profitTone =
    bet.status === 'won' || bet.status === 'half_won' || (bet.is_cashout && bet.cashout_amount && bet.cashout_amount > bet.stake_amount)
      ? 'text-status-success'
      : bet.status === 'lost' || bet.status === 'half_lost'
        ? 'text-status-danger'
        : 'text-ink-2';

  const statusPillClass =
    bet.status === 'won' ? 'text-status-success bg-status-success/10 border-status-success/20' :
    bet.status === 'lost' ? 'text-status-danger bg-status-danger/10 border-status-danger/20' :
    bet.status === 'half_won' ? 'text-status-success bg-status-success/15 border-status-success/30' :
    bet.status === 'half_lost' ? 'text-status-danger bg-status-danger/15 border-status-danger/30' :
    bet.status === 'pending' ? 'text-status-warning bg-status-warning/10 border-status-warning/20' :
    bet.status === 'cashout' ? 'text-forest bg-forest-tint border-forest/20' :
    'text-ink-2 bg-ink-3 border-line';

  return (
    <tr className="border-b border-line hover:bg-ink-3/30 transition-colors">
      <td className="py-2 px-1.5 w-8">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(bet.id)}
          className="w-3.5 h-3.5 accent-forest cursor-pointer"
        />
      </td>
      <td className="py-2 px-1.5 text-ink-2 tabular">
        {formatBetDate(bet.bet_date)}
      </td>
      <td className="py-2 px-1.5 font-medium min-w-0 overflow-hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default inline-block w-full min-w-0">
              <div className="whitespace-pre-line break-words text-ink">{truncateDescription(bet.bet_description, 50)}</div>
              {bet.match_description && (
                <div className="text-[10px] text-ink-2 break-words">{truncateDescription(bet.match_description, 50)}</div>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="theme-rebrand max-w-xs px-2 py-1 text-xs bg-white border border-line text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
            <div className="whitespace-pre-line">
              {bet.bet_description}
              {bet.match_description && (
                <>
                  {'\n'}
                  <span className="text-ink-2">{bet.match_description}</span>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </td>
      <td className="py-2 px-1.5">
        <TagSelector
          betId={bet.id}
          selectedTags={bet.tags || []}
          onTagsChange={handleTagsChange}
          onTagsUpdated={onTagsUpdated}
          availableTags={availableTags}
        />
      </td>
      <td className="py-2 px-1.5 text-[12px] text-ink-2 min-w-[8rem]">
        <div className="text-ink">{bet.sport || '—'}</div>
        {bet.league && <div className="text-[11px] text-ink-2 mt-0.5">{bet.league}</div>}
      </td>
      <td className="py-2 px-1.5 text-[11px] text-ink-2 uppercase tracking-[0.06em] font-semibold">{bet.betting_market || '-'}</td>
      <td className="text-right py-2 px-1.5 tabular text-ink">{formatValue(bet.stake_amount)}</td>
      <td className="text-right py-2 px-1.5 text-forest font-semibold tabular">{bet.odds.toFixed(2)}</td>
      <td className="text-right py-2 px-1.5 min-w-[5.5rem] overflow-hidden text-ellipsis whitespace-nowrap text-ink-2 tabular">
        {bet.is_cashout && bet.cashout_amount
          ? formatValue(bet.cashout_amount)
          : bet.status === 'half_won'
            ? formatValue((bet.stake_amount + bet.potential_return) / 2)
            : bet.status === 'half_lost'
              ? formatValue(bet.stake_amount / 2)
              : bet.status === 'void'
                ? formatValue(bet.stake_amount)
                : formatValue(bet.potential_return)}
      </td>
      <td className={`text-right py-2 px-1.5 min-w-[5.5rem] font-semibold tabular ${profitTone}`}>
        {bet.status === 'pending'
          ? '—'
          : bet.is_cashout && bet.cashout_amount
            ? formatValue(bet.cashout_amount - bet.stake_amount)
            : bet.status === 'won'
              ? formatValue(bet.potential_return - bet.stake_amount)
              : bet.status === 'lost'
                ? formatValue(-bet.stake_amount)
                : bet.status === 'half_won'
                  ? formatValue((bet.potential_return - bet.stake_amount) / 2)
                  : bet.status === 'half_lost'
                    ? formatValue(-bet.stake_amount / 2)
                    : '—'}
      </td>
      <td className="text-center py-2 px-1.5 whitespace-nowrap min-w-[5rem]">
        <span className={`inline-flex items-center px-2 h-[22px] rounded-md border text-[10px] font-semibold tracking-[0.06em] uppercase ${statusPillClass}`}>
          {translateStatus(bet.status)}
        </span>
      </td>
      <td className="py-2 px-1.5 min-w-[11rem]">
        <div className="flex flex-row items-center gap-1.5 justify-end flex-nowrap">
          {bet.status === 'pending' && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-7 px-2 inline-flex items-center gap-1 text-[10px] font-semibold text-ink-2 border border-line bg-white hover:bg-forest-tint hover:text-forest hover:border-forest/30 rounded transition-colors uppercase tracking-[0.04em] shrink-0"
                  >
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    Result.
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="theme-rebrand bg-white border border-line text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'won')} className="flex items-center gap-2 cursor-pointer focus:bg-status-success/10 focus:text-status-success">
                    <TrendingUp className="w-4 h-4 text-status-success" />
                    <span>Ganhou</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'lost')} className="flex items-center gap-2 cursor-pointer focus:bg-status-danger/10 focus:text-status-danger">
                    <TrendingDown className="w-4 h-4 text-status-danger" />
                    <span>Perdeu</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'half_won')} className="flex items-center gap-2 cursor-pointer focus:bg-status-success/10 focus:text-status-success">
                    <TrendingUp className="w-4 h-4 text-status-success opacity-70" />
                    <span>1/2 Green</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'half_lost')} className="flex items-center gap-2 cursor-pointer focus:bg-status-danger/10 focus:text-status-danger">
                    <TrendingDown className="w-4 h-4 text-status-danger opacity-70" />
                    <span>1/2 Red</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'void')} className="flex items-center gap-2 cursor-pointer focus:bg-ink-3/60">
                    <X className="w-4 h-4 text-ink-2" />
                    <span>Anulada</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={() => openCashoutModal(bet)}
                className="h-7 w-7 inline-flex items-center justify-center text-forest border border-line bg-white hover:bg-forest-tint hover:border-forest/30 rounded transition-colors shrink-0"
                title="Cashout"
              >
                <DollarSign className="w-3.5 h-3.5 shrink-0" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => openEditModal(bet)}
            className="h-7 w-7 inline-flex items-center justify-center text-ink-2 hover:text-ink hover:bg-ink-3/60 rounded transition-colors shrink-0"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => deleteBet(bet.id)}
            className="h-7 w-7 inline-flex items-center justify-center text-ink-2 hover:text-status-danger hover:bg-status-danger/10 rounded transition-colors shrink-0"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

type BetCardProps = BetRowProps;

const BetCard = React.memo(function BetCard({
  bet,
  formatValue,
  formatBetDate,
  translateStatus,
  onBetTagsChange,
  onTagsUpdated,
  availableTags,
  updateBetStatus,
  openCashoutModal,
  openEditModal,
  deleteBet,
  isSelected,
  onToggleSelect,
}: BetCardProps) {
  const handleTagsChange = useCallback((newTags: Tag[]) => {
    onBetTagsChange(bet.id, newTags, (bet.tags || []).map(t => t.id));
  }, [bet.id, bet.tags, onBetTagsChange]);

  const profitTone =
    bet.status === 'won' || bet.status === 'half_won' || (bet.is_cashout && bet.cashout_amount && bet.cashout_amount > bet.stake_amount)
      ? 'text-status-success'
      : bet.status === 'lost' || bet.status === 'half_lost'
        ? 'text-status-danger'
        : 'text-ink-2';

  const statusPillClass =
    bet.status === 'won' ? 'text-status-success bg-status-success/10 border-status-success/20' :
    bet.status === 'lost' ? 'text-status-danger bg-status-danger/10 border-status-danger/20' :
    bet.status === 'half_won' ? 'text-status-success bg-status-success/15 border-status-success/30' :
    bet.status === 'half_lost' ? 'text-status-danger bg-status-danger/15 border-status-danger/30' :
    bet.status === 'pending' ? 'text-status-warning bg-status-warning/10 border-status-warning/20' :
    bet.status === 'cashout' ? 'text-forest bg-forest-tint border-forest/20' :
    'text-ink-2 bg-ink-3 border-line';

  return (
    <div className="bg-white border border-line-2 p-4 rounded-lg space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center justify-center w-9 h-9 -ml-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(bet.id)}
              className="w-4 h-4 accent-forest cursor-pointer shrink-0"
            />
          </label>
          <span className="text-xs text-ink-2 tabular">{formatBetDate(bet.bet_date)}</span>
        </div>
        <span className={`inline-flex items-center px-2 h-[20px] rounded-md border text-[10px] font-semibold tracking-[0.06em] uppercase whitespace-nowrap ${statusPillClass}`}>
          {translateStatus(bet.status)}
        </span>
      </div>
      <div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full text-left font-semibold text-sm text-ink cursor-pointer focus:outline-none focus:ring-0"
            >
              <span className="whitespace-pre-line block">{truncateDescription(bet.bet_description, 50)}</span>
              {bet.match_description && (
                <span className="text-xs text-ink-2 mt-0.5 block font-normal">{truncateDescription(bet.match_description, 50)}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="theme-rebrand max-w-[min(90vw,320px)] p-3 text-xs bg-white border border-line text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
            <div className="whitespace-pre-line">
              {bet.bet_description}
              {bet.match_description && (
                <>
                  {'\n'}
                  <span className="text-ink-2">{bet.match_description}</span>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <div className="text-[10px] text-ink-2 mt-2 uppercase tracking-[0.1em] font-semibold">{bet.sport}</div>
        {bet.league && <div className="text-[10px] text-ink-2 mt-0.5 uppercase tracking-[0.1em] font-semibold">{bet.league}</div>}
        {bet.betting_market && <div className="text-[10px] text-ink-2 mt-0.5 uppercase tracking-[0.1em] font-semibold">{bet.betting_market}</div>}
        <div className="mt-2">
          <TagSelector
            betId={bet.id}
            selectedTags={bet.tags || []}
            onTagsChange={handleTagsChange}
            onTagsUpdated={onTagsUpdated}
            availableTags={availableTags}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-line -mx-4 px-4">
        <div>
          <div className="text-[9px] text-ink-2 uppercase tracking-[0.1em] font-semibold mb-0.5">Stake</div>
          <div className="text-sm tabular text-ink">{formatValue(bet.stake_amount)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-ink-2 uppercase tracking-[0.1em] font-semibold mb-0.5">Odds</div>
          <div className="text-sm tabular text-forest font-semibold">{bet.odds.toFixed(2)}</div>
        </div>
        {bet.status === 'pending' ? (
          <div className="text-right">
            <div className="text-[9px] text-ink-2 uppercase tracking-[0.1em] font-semibold mb-0.5">Retorno</div>
            <div className="text-sm tabular text-ink-2">{formatValue(bet.potential_return)}</div>
          </div>
        ) : (
          <div className="text-right">
            <div className="text-[9px] text-ink-2 uppercase tracking-[0.1em] font-semibold mb-0.5">Lucro</div>
            <div className={`text-sm font-semibold tabular ${profitTone}`}>
              {bet.is_cashout && bet.cashout_amount
                ? formatValue(bet.cashout_amount - bet.stake_amount)
                : bet.status === 'won'
                  ? formatValue(bet.potential_return - bet.stake_amount)
                  : bet.status === 'lost'
                    ? formatValue(-bet.stake_amount)
                    : bet.status === 'half_won'
                      ? formatValue((bet.potential_return - bet.stake_amount) / 2)
                      : bet.status === 'half_lost'
                        ? formatValue(-bet.stake_amount / 2)
                        : '—'}
            </div>
          </div>
        )}
      </div>
      <div>
        {bet.status === 'pending' ? (
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 px-3 rounded-md bg-white border border-line hover:bg-forest-tint hover:text-forest hover:border-forest/30 transition-colors flex items-center gap-2 text-ink-2 w-full sm:w-auto justify-center"
                >
                  <Target className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.04em]">Resultado</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="theme-rebrand bg-white border border-line text-ink min-w-[180px] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'won')} className="flex items-center gap-2 cursor-pointer focus:bg-status-success/10 focus:text-status-success">
                  <TrendingUp className="w-4 h-4 text-status-success" />
                  <span>Ganhou</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'lost')} className="flex items-center gap-2 cursor-pointer focus:bg-status-danger/10 focus:text-status-danger">
                  <TrendingDown className="w-4 h-4 text-status-danger" />
                  <span>Perdeu</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'half_won')} className="flex items-center gap-2 cursor-pointer focus:bg-status-success/10 focus:text-status-success">
                  <TrendingUp className="w-4 h-4 text-status-success opacity-70" />
                  <span>1/2 Green</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'half_lost')} className="flex items-center gap-2 cursor-pointer focus:bg-status-danger/10 focus:text-status-danger">
                  <TrendingDown className="w-4 h-4 text-status-danger opacity-70" />
                  <span>1/2 Red</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'void')} className="flex items-center gap-2 cursor-pointer focus:bg-ink-3/60">
                  <X className="w-4 h-4 text-ink-2" />
                  <span>Anulada</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => openCashoutModal(bet)}
              className="h-9 px-3 rounded-md bg-white border border-line hover:bg-forest-tint hover:border-forest/30 transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-initial min-w-0"
              title="Cashout"
            >
              <DollarSign className="w-4 h-4 text-forest shrink-0" />
              <span className="text-xs font-semibold text-forest uppercase tracking-[0.04em]">Cashout</span>
            </button>
            <button type="button" onClick={() => openEditModal(bet)} className="h-9 w-9 rounded-md bg-white border border-line text-ink-2 hover:text-ink hover:bg-ink-3/60 transition-colors flex items-center justify-center" title="Editar">
              <Edit className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => deleteBet(bet.id)} className="h-9 w-9 rounded-md bg-white border border-line text-ink-2 hover:text-status-danger hover:bg-status-danger/10 hover:border-status-danger/30 transition-colors flex items-center justify-center" title="Excluir">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openEditModal(bet)}
              className="flex-1 h-10 rounded-md bg-white border border-line text-ink-2 hover:text-ink hover:bg-ink-3/60 transition-colors flex items-center justify-center gap-2"
              title="Editar"
            >
              <Edit className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.04em]">Editar</span>
            </button>
            <button
              type="button"
              onClick={() => deleteBet(bet.id)}
              className="h-10 w-10 shrink-0 rounded-md bg-white border border-line text-ink-2 hover:text-status-danger hover:bg-status-danger/10 hover:border-status-danger/30 transition-colors flex items-center justify-center"
              title="Excluir"
              aria-label="Excluir aposta"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

const DAILY_BET_LIMIT = 3;

// Status finais (não-pending): mesma lista canônica dos dashboards (SETTLED) — decide quando
// emitir bet_settled, a métrica central de retenção. Ver docs/plano-metricas-retencao.md.
const FINAL_BET_STATUSES = SETTLED as readonly string[];

// Payload único do bet_settled: um só lugar define o schema do evento para os 4 caminhos de
// liquidação manual da página (linha, lote, edição, cashout) — sem cópias que derivam.
function captureBetSettled(
  posthog: ReturnType<typeof usePostHog>,
  bet: Pick<Bet, 'channel' | 'created_at'>,
  status: string,
  opts?: { batch?: boolean; count?: number },
) {
  posthog?.capture('bet_settled', {
    product: 'betinho',
    channel: bet.channel ?? null,
    status,
    days_to_settle: bet.created_at
      ? Math.round((Date.now() - new Date(bet.created_at).getTime()) / 86400000)
      : null,
    settled_by: 'user_manual',
    batch: opts?.batch ?? false,
    count: opts?.count ?? 1,
  });
}

export default function Bets() {
  const { user, isLoading: authLoading } = useAuth();
  const { isPremium: isBetinhoPremium, isFree: isBetinhoFree } = useBetinhoPremium();
  const { isConfigured, toUnits, formatUnits, config, updateConfig, formatCurrency, refetchConfig } = useUserUnit();
  const { movements: capitalMovements, addMovement } = useCapitalMovements(user?.id);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bets, setBets] = useState<Bet[]>([]);
  // Deep-link do Betinho: o recibo de registro traz [✏️ Editar] → /bets?edit=<id>.
  // Capturamos o id no 1º render (lazy init) porque o efeito de mount limpa os
  // query params logo em seguida; o modal abre quando a lista de apostas carrega.
  const [pendingEditBetId, setPendingEditBetId] = useState<string | null>(() => searchParams.get('edit'));
  // Espelho do estado pros callbacks lerem o valor atual sem `bets` nas deps — mantê-lo nas
  // deps recriava os callbacks a cada update e derrotava o React.memo de BetRow/BetCard.
  const betsRef = useRef<Bet[]>([]);
  useEffect(() => { betsRef.current = bets; }, [bets]);
  const [isLoading, setIsLoading] = useState(true);
  const [unitConfigOpen, setUnitConfigOpen] = useState(false);
  const [showUnitsView, setShowUnitsView] = useState(false);
  const formatValue = showUnitsView
    ? (value: number) => {
        const u = toUnits(value);
        return u !== null ? formatUnits(u) : formatCurrency(value);
      }
    : formatCurrency;
  const [dailyBetCount, setDailyBetCount] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalBets: 0,
    totalStaked: 0,
    totalReturn: 0,
    winRate: 0,
    profit: 0,
    averageStake: 0,
    averageOdd: 0,
    roi: 0
  });
  
  // Modals state
  const [capitalModal, setCapitalModal] = useState<{ isOpen: boolean; type: 'deposit' | 'withdrawal'; amount: string; description: string }>({
    isOpen: false, type: 'deposit', amount: '', description: ''
  });

  const [cashoutModal, setCashoutModal] = useState<{
    isOpen: boolean;
    bet: Bet | null;
    cashoutAmount: string;
    cashoutOdds: string;
  }>({
    isOpen: false,
    bet: null,
    cashoutAmount: '',
    cashoutOdds: ''
  });
  
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    bet: Bet | null;
    formData: {
      bet_description: string;
      match_description: string;
      sport: string;
      league: string;
      betting_market: string;
      odds: string;
      stake_amount: string;
      bet_date: string;
      match_date: string;
      status: 'pending' | 'won' | 'lost' | 'void' | 'cashout' | 'half_won' | 'half_lost';
      is_credit_bet: boolean;
    };
  }>({
    isOpen: false,
    bet: null,
    formData: {
      bet_description: '',
      match_description: '',
      sport: '',
      league: '',
      betting_market: '',
      odds: '',
      stake_amount: '',
      bet_date: '',
      match_date: '',
      status: 'pending',
      is_credit_bet: false
    }
  });
  const [isEditDatePopoverOpen, setIsEditDatePopoverOpen] = useState(false);
  const [isFilterDateFromOpen, setIsFilterDateFromOpen] = useState(false);
  const [isFilterDateToOpen, setIsFilterDateToOpen] = useState(false);

  const [isSportDropdownOpen, setIsSportDropdownOpen] = useState(false);
  const [isSportQueryTouched, setIsSportQueryTouched] = useState(false);
  const [sportHighlightIndex, setSportHighlightIndex] = useState(-1);
  const sportItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  
  const [isLeagueDropdownOpen, setIsLeagueDropdownOpen] = useState(false);
  const [isLeagueQueryTouched, setIsLeagueQueryTouched] = useState(false);
  const [leagueHighlightIndex, setLeagueHighlightIndex] = useState(-1);
  const leagueItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [isBettingMarketDropdownOpen, setIsBettingMarketDropdownOpen] = useState(false);
  const [isBettingMarketQueryTouched, setIsBettingMarketQueryTouched] = useState(false);
  const [bettingMarketHighlightIndex, setBettingMarketHighlightIndex] = useState(-1);
  const bettingMarketItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Filter states — inicializa a partir de query params (?league=X&market=Y&tag=Z)
  // pra suportar deep-link do dashboard (ex.: "Ver todas as N apostas" de uma fatia).
  const [filters, setFilters] = useState(() => {
    const parseList = (key: string) =>
      searchParams.getAll(key).flatMap((v) => v.split(',').filter(Boolean));
    return {
      status: parseList('status'),
      sport: parseList('sport'),
      league: parseList('league'),
      betting_market: parseList('market'),
      searchQuery: '',
      dateFrom: '',
      dateTo: '',
      selectedTags: parseList('tag'),
      stakeMin: '' as string,
      oddsMin: '' as string,
      oddsMax: '' as string,
    };
  });

  // Limpa query params da URL após aplicar (URL fica limpa, filtros permanecem no state)
  useEffect(() => {
    if (searchParams.toString()) {
      const empty = new URLSearchParams();
      setSearchParams(empty, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User tags state
  const [userTags, setUserTags] = useState<Tag[]>([]);

  // Sort state
  type SortDirection = 'asc' | 'desc';
  type SortColumn = 'bet_date' | 'sport' | 'league' | 'betting_market' | 'stake_amount' | 'odds' | 'return' | 'profit' | 'status' | null;
  
  const [sortConfig, setSortConfig] = useState<{
    column: SortColumn;
    direction: SortDirection;
  }>({
    column: 'bet_date',
    direction: 'desc'  // padrão: mais recente primeiro
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Bulk selection state
  const [selectedBetIds, setSelectedBetIds] = useState<Set<string>>(new Set());

  const supabase = useMemo(() => createClient(), []);
  const isMountedRef = useRef(true);

  const fetchBets = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      if (!isMountedRef.current) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!isMountedRef.current) return;

      // Fetch tags for each bet
      const betsWithTags = await Promise.all(
        (data || []).map(async (bet) => {
          if (!isMountedRef.current) return null;
          const { data: tags } = await supabase.rpc('get_bet_tags', { p_bet_id: bet.id });
          return { ...bet, tags: tags || [] };
        })
      );

      if (!isMountedRef.current) return;

      setBets(betsWithTags.filter(Boolean) as any);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error fetching bets:', err);
      toast({
        title: 'Error',
        description: 'Failed to load bets',
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user?.id, supabase, toast]);

  const getDailyBetCount = useCallback(async (): Promise<number> => {
    if (!user?.id) return 0;

    const nowUTC = new Date();
    const gmt3Offset = -3 * 60 * 60 * 1000;
    const nowGMT3 = new Date(nowUTC.getTime() + gmt3Offset);

    const year = nowGMT3.getUTCFullYear();
    const month = String(nowGMT3.getUTCMonth() + 1).padStart(2, '0');
    const day = String(nowGMT3.getUTCDate()).padStart(2, '0');
    const gmt3DateString = `${year}-${month}-${day}`;

    const startOfDayUTC = new Date(`${gmt3DateString}T03:00:00.000Z`);

    const tomorrowGMT3 = new Date(nowGMT3.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowYear = tomorrowGMT3.getUTCFullYear();
    const tomorrowMonth = String(tomorrowGMT3.getUTCMonth() + 1).padStart(2, '0');
    const tomorrowDay = String(tomorrowGMT3.getUTCDate()).padStart(2, '0');
    const gmt3TomorrowDateString = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;
    const startOfTomorrowUTC = new Date(`${gmt3TomorrowDateString}T03:00:00.000Z`);

    const { count, error } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('bet_date', startOfDayUTC.toISOString())
      .lt('bet_date', startOfTomorrowUTC.toISOString());

    if (error) return 0;
    return count ?? 0;
  }, [user?.id, supabase]);

  const fetchDailyBetCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const count = await getDailyBetCount();
      if (isMountedRef.current) {
        setDailyBetCount(count);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setDailyBetCount(0);
      }
    }
  }, [user?.id, getDailyBetCount]);

  const calculateStats = useCallback((betsData: Bet[]) => {
    if (!isMountedRef.current) return;
    
    const totalBets = betsData.length;
    const totalStaked = betsData.reduce((sum, bet) => sum + bet.stake_amount, 0);

    const wonBets = betsData.filter(bet => bet.status === 'won');
    const lostBets = betsData.filter(bet => bet.status === 'lost');
    const cashoutBets = betsData.filter(bet => bet.status === 'cashout');
    const halfWonBets = betsData.filter(bet => bet.status === 'half_won');
    const halfLostBets = betsData.filter(bet => bet.status === 'half_lost');
    const voidBets = betsData.filter(bet => bet.status === 'void');

    const settledStaked =
      wonBets.reduce((sum, bet) => sum + bet.stake_amount, 0) +
      lostBets.reduce((sum, bet) => sum + bet.stake_amount, 0) +
      cashoutBets.reduce((sum, bet) => sum + bet.stake_amount, 0) +
      halfWonBets.reduce((sum, bet) => sum + bet.stake_amount, 0) +
      halfLostBets.reduce((sum, bet) => sum + bet.stake_amount, 0) +
      voidBets.reduce((sum, bet) => sum + bet.stake_amount, 0);

    const totalReturn = wonBets.reduce((sum, bet) => sum + bet.potential_return, 0);
    const totalCashout = cashoutBets.reduce((sum, bet) => sum + (bet.cashout_amount || 0), 0);
    const totalHalfWon = halfWonBets.reduce((sum, bet) => sum + (bet.stake_amount + bet.potential_return) / 2, 0);
    const totalHalfLost = halfLostBets.reduce((sum, bet) => sum + bet.stake_amount / 2, 0);
    const totalVoidReturn = voidBets.reduce((sum, bet) => sum + bet.stake_amount, 0);

    const totalEarnings = totalReturn + totalCashout + totalHalfWon + totalHalfLost + totalVoidReturn;
    const settledCount = wonBets.length + lostBets.length + cashoutBets.length + halfWonBets.length + halfLostBets.length;
    const winEquiv = wonBets.length + cashoutBets.length + halfWonBets.length * 0.5;
    const lossEquiv = lostBets.length + halfLostBets.length * 0.5;
    const winRate = settledCount > 0 ? (winEquiv / (winEquiv + lossEquiv)) * 100 : 0;
    const profit = totalEarnings - settledStaked;
    const averageStake = totalBets > 0 ? totalStaked / totalBets : 0;
    
    const totalOdds = betsData.reduce((sum, bet) => sum + bet.odds, 0);
    const averageOdd = totalBets > 0 ? totalOdds / totalBets : 0;
    
    const roi = settledStaked > 0 ? (profit / settledStaked) * 100 : 0;

    if (isMountedRef.current) {
      setStats({
        totalBets,
        totalStaked,
        totalReturn: totalEarnings,
        winRate,
        profit,
        averageStake,
        averageOdd,
        roi
      });
    }
  }, []);

  // ... (Keep existing updateBetStatus, deleteBet, processCashout, updateBetData logic but adapted if needed)
  // For brevity, I'm keeping the logic but ensuring it uses the toast for notifications instead of local error state where appropriate
  
  const updateBetStatus = useCallback(async (betId: string, newStatus: string) => {
    const prevBet = betsRef.current.find(b => b.id === betId);
    const isSettling = prevBet?.status === 'pending' && FINAL_BET_STATUSES.includes(newStatus);
    if (isMountedRef.current) {
      setBets(prev => prev.map(b => b.id === betId ? { ...b, status: newStatus as Bet['status'] } : b));
    }
    try {
      const { error } = await supabase
        .from('bets')
        .update({ status: newStatus })
        .eq('id', betId);

      if (error) throw error;
      // Analytics: liquidação via mudança de status por linha (pending → status final).
      if (isSettling && prevBet) {
        captureBetSettled(posthog, prevBet, newStatus);
      }
      if (isMountedRef.current) {
        toast({ title: 'Success', description: 'Bet status updated' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setBets(prev => prev.map(b => b.id === betId ? { ...b, status: 'pending' } : b));
        toast({ title: 'Error', description: 'Failed to update bet status', variant: 'destructive' });
      }
    }
  }, [posthog, supabase, toast]);

  // Estado da confirmação de exclusão (single ou bulk).
  // null quando fechado; { type, ... } quando o usuário pede pra excluir.
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: 'single'; betId: string }
    | { type: 'bulk'; count: number }
    | null
  >(null);

  // Apenas dispara o dialog de confirmação. A exclusão real acontece em performDeleteBet.
  const deleteBet = useCallback((betId: string) => {
    setConfirmDelete({ type: 'single', betId });
  }, []);

  const performDeleteBet = useCallback(async (betId: string) => {
    if (isMountedRef.current) {
      setBets(prev => prev.filter(b => b.id !== betId));
    }
    try {
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId);

      if (error) throw error;
      if (isMountedRef.current) {
        toast({ title: 'Aposta excluída', description: 'Removida com sucesso.' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        toast({ title: 'Erro', description: 'Falha ao excluir a aposta.', variant: 'destructive' });
      }
    }
  }, [supabase, toast]);

  const processCashout = async () => {
    if (!cashoutModal.bet || !cashoutModal.cashoutAmount) return;

    const cashoutAmount = parseFloat(cashoutModal.cashoutAmount);
    if (isNaN(cashoutAmount)) {
      toast({ title: 'Error', description: 'Invalid amount', variant: 'destructive' });
      return;
    }

    const betId = cashoutModal.bet.id;
    const cashoutDate = new Date().toISOString();
    if (isMountedRef.current) {
      setBets(prev => prev.map(b => b.id === betId ? {
        ...b,
        status: 'cashout',
        cashout_amount: cashoutAmount,
        cashout_date: cashoutDate,
        is_cashout: true
      } : b));
      setCashoutModal({ isOpen: false, bet: null, cashoutAmount: '', cashoutOdds: '' });
    }

    try {
      const { error } = await supabase
        .from('bets')
        .update({
          status: 'cashout',
          cashout_amount: cashoutAmount,
          cashout_date: cashoutDate,
          is_cashout: true
        })
        .eq('id', betId);

      if (error) throw error;

      // Analytics: cashout é uma forma de liquidação (o modal só abre pra apostas pending).
      captureBetSettled(posthog, cashoutModal.bet, 'cashout');

      if (isMountedRef.current) {
        toast({ title: 'Success', description: 'Cashout processed' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setBets(prev => prev.map(b => b.id === betId ? { ...b, status: 'pending', cashout_amount: undefined, cashout_date: undefined, is_cashout: false } : b));
        toast({ title: 'Error', description: 'Failed to process cashout', variant: 'destructive' });
      }
    }
  };

  const updateBetData = async () => {
    if (!editModal.bet) return;

    const odds = parseFloat(editModal.formData.odds);
    const stakeAmount = parseFloat(editModal.formData.stake_amount);
    const isCreditBet = editModal.formData.is_credit_bet;
    const potentialReturn = isCreditBet ? stakeAmount * (odds - 1) : stakeAmount * odds;
    const updatedAt = new Date().toISOString();

    // Convert yyyy-MM-dd to local midnight ISO so the calendar day is preserved in all timezones
    const dateOnlyToISO = (dateStr: string) => {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toISOString();
    };
    const betDateISO = editModal.formData.bet_date
      ? (dateOnlyToISO(editModal.formData.bet_date) ?? updatedAt)
      : updatedAt;
    const matchDateISO = editModal.formData.match_date
      ? dateOnlyToISO(editModal.formData.match_date)
      : null;

    const updateData: any = {
      bet_description: editModal.formData.bet_description,
      match_description: editModal.formData.match_description || null,
      sport: editModal.formData.sport,
      league: editModal.formData.league || null,
      betting_market: editModal.formData.betting_market || null,
      odds: odds,
      stake_amount: stakeAmount,
      potential_return: potentialReturn,
      is_credit_bet: isCreditBet,
      bet_date: betDateISO,
      match_date: matchDateISO,
      status: editModal.formData.status,
      updated_at: updatedAt
    };

    const betId = editModal.bet.id;
    const updatedBet: Partial<Bet> = {
      ...editModal.bet,
      ...updateData,
      bet_date: betDateISO,
      match_date: matchDateISO ?? undefined,
      status: editModal.formData.status
    };

    if (isMountedRef.current) {
      setBets(prev => prev.map(b => b.id === betId ? { ...b, ...updatedBet } : b));
      setEditModal(prev => ({ ...prev, isOpen: false }));
    }

    try {
      const { error } = await supabase
        .from('bets')
        .update(updateData)
        .eq('id', betId);

      if (error) throw error;

      // Analytics: liquidação via edição individual (pending → status final).
      if (editModal.bet.status === 'pending' && FINAL_BET_STATUSES.includes(editModal.formData.status)) {
        captureBetSettled(posthog, editModal.bet, editModal.formData.status);
      }

      if (isMountedRef.current) {
        toast({ title: 'Success', description: 'Bet updated' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setBets(prev => prev.map(b => b.id === betId ? { ...b, ...editModal.bet } : b));
        toast({ title: 'Error', description: 'Failed to update bet', variant: 'destructive' });
      }
    }
  };

  const createBet = async (data: CreateBetFormData): Promise<boolean> => {
    if (!user?.id) return false;

    if (isBetinhoFree) {
      const currentCount = await getDailyBetCount();
      if (currentCount >= DAILY_BET_LIMIT) {
        navigate('/paywall');
        return false;
      }
    }

    try {
      const odds = parseFloat(data.odds);
      const stakeAmount = parseFloat(data.stake_amount);
      if (isNaN(odds) || isNaN(stakeAmount)) {
        throw new Error('Valores inválidos');
      }
      const isCreditBet = data.is_credit_bet ?? false;
      const potentialReturn = isCreditBet ? stakeAmount * (odds - 1) : stakeAmount * odds;

      const { data: newBet, error } = await supabase
        .from('bets')
        .insert({
          user_id: user.id,
          bet_type: 'single',
          bet_description: data.bet_description,
          match_description: data.match_description || null,
          sport: data.sport || 'Outros',
          league: data.league || null,
          betting_market: data.betting_market || null,
          odds: odds,
          stake_amount: stakeAmount,
          potential_return: potentialReturn,
          is_credit_bet: isCreditBet,
          bet_date: data.bet_date || new Date().toISOString(),
          match_date: data.match_date || null,
          status: 'pending',
          channel: 'web'
        })
        .select('*')
        .single();

      if (error) throw error;

      // Analytics: aposta criada pela web (o webhook do Telegram já emite bet_created;
      // este fecha a lacuna do canal web, antes cego no funil). channel já gravado como 'web'.
      // (sem has_odds: odds inválida lança antes do insert, a prop seria sempre true.)
      posthog?.capture('bet_created', {
        product: 'betinho',
        channel: 'web',
        bet_type: 'single',
        sport: data.sport || 'Outros',
        is_credit_bet: isCreditBet,
      });

      const tagIds = data.selectedTagIds ?? [];
      for (const tagId of tagIds) {
        await supabase.rpc('add_tag_to_bet', {
          p_bet_id: newBet.id,
          p_tag_id: tagId
        });
      }

      const { data: tags } = await supabase.rpc('get_bet_tags', { p_bet_id: newBet.id });
      const betWithTags = { ...newBet, tags: tags ?? [] } as Bet;

      if (isMountedRef.current) {
        setBets(prev => [betWithTags, ...prev]);
        setDailyBetCount(prev => (prev ?? 0) + 1);
        toast({ title: 'Sucesso', description: 'Aposta cadastrada com sucesso' });
      }
      return true;
    } catch (err) {
      if (isMountedRef.current) {
        toast({ title: 'Erro', description: 'Falha ao cadastrar aposta', variant: 'destructive' });
      }
      return false;
    }
  };

  // Helper functions
  const openCashoutModal = useCallback((bet: Bet) => {
    setCashoutModal({
      isOpen: true,
      bet,
      cashoutAmount: bet.cashout_amount?.toString() || '',
      cashoutOdds: bet.cashout_odds?.toString() || ''
    });
  }, []);

  const openEditModal = useCallback((bet: Bet) => {
    setEditModal({
      isOpen: true,
      bet,
      formData: {
        bet_description: bet.bet_description || '',
        match_description: bet.match_description || '',
        sport: bet.sport || '',
        league: bet.league || '',
        betting_market: bet.betting_market || '',
        odds: bet.odds?.toString() || '',
        stake_amount: bet.stake_amount?.toString() || '',
        bet_date: bet.bet_date ? String(bet.bet_date).split('T')[0] : '',
        match_date: bet.match_date ? String(bet.match_date).split('T')[0] : '',
        status: bet.status || 'pending',
        is_credit_bet: bet.is_credit_bet ?? false
      }
    });
    setIsSportDropdownOpen(false);
    setIsSportQueryTouched(false);
    setSportHighlightIndex(-1);
    setIsLeagueDropdownOpen(false);
    setIsLeagueQueryTouched(false);
    setLeagueHighlightIndex(-1);
    setIsBettingMarketDropdownOpen(false);
    setIsBettingMarketQueryTouched(false);
    setBettingMarketHighlightIndex(-1);
  }, []);

  // Deep-link ?edit=<id> (botão Editar do recibo do Betinho): assim que a lista
  // de apostas carrega, abre o modal de edição já preenchido e consome o id.
  useEffect(() => {
    if (!pendingEditBetId || bets.length === 0) return;
    const target = bets.find((b) => b.id === pendingEditBetId);
    if (target) openEditModal(target);
    setPendingEditBetId(null);
  }, [pendingEditBetId, bets, openEditModal]);

  const fetchReferralCode = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      if (isMountedRef.current) {
        setReferralCode((data as any)?.referral_code || null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching referral code:', err);
      }
    }
  }, [user?.id, supabase]);

  const fetchUserTags = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('tags')
        .select('id,name,color,user_id')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      
      if (isMountedRef.current) {
        const tags = Array.isArray(data) ? (data as unknown as Tag[]) : [];
        setUserTags(tags);
        // Sync tag colors across all bets so color changes reflect everywhere immediately.
        setBets(prev => prev.map(bet => ({
          ...bet,
          tags: (bet.tags || []).map(bt => {
            const updated = tags.find(t => t.id === bt.id);
            return updated ? { ...bt, color: updated.color, name: updated.name } : bt;
          })
        })));
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching user tags:', err);
      }
    }
  }, [user?.id, supabase]);

  const handleBetTagsChange = useCallback(async (betId: string, newTags: Tag[], currentTagIds: string[]) => {
    setBets(prev => prev.map(b =>
      b.id === betId ? { ...b, tags: newTags } : b
    ));
    const newTagIds = newTags.map(t => t.id);
    const tagsToRemove = currentTagIds.filter(id => !newTagIds.includes(id));
    for (const tagId of tagsToRemove) {
      await supabase.rpc('remove_tag_from_bet', { p_bet_id: betId, p_tag_id: tagId });
    }
    const tagsToAdd = newTagIds.filter(id => !currentTagIds.includes(id));
    for (const tagId of tagsToAdd) {
      await supabase.rpc('add_tag_to_bet', { p_bet_id: betId, p_tag_id: tagId });
    }
  }, [supabase]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (user?.id) {
      fetchBets();
      fetchDailyBetCount();
      fetchReferralCode();
      fetchUserTags();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id, fetchBets, fetchDailyBetCount, fetchReferralCode, fetchUserTags]);

  // Reset filter if selected tags no longer exist
  useEffect(() => {
    if (filters.selectedTags.length > 0) {
      const validTags = filters.selectedTags.filter(tagId => 
        userTags.some(tag => tag.id === tagId)
      );
      if (validTags.length !== filters.selectedTags.length) {
        setFilters(prev => ({ ...prev, selectedTags: validTags }));
      }
    }
  }, [userTags, filters.selectedTags]);

  // Filter logic
  const uniqueSports = useMemo(() => {
    const sports = Array.from(new Set(bets.map(bet => bet.sport).filter(Boolean)));
    // Ordenar de acordo com a ordem de SPORTS_LIST
    return sports.sort((a, b) => {
      const indexA = SPORTS_LIST.indexOf(a);
      const indexB = SPORTS_LIST.indexOf(b);
      // Se ambos estão na lista, manter a ordem da lista
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // Se apenas A está na lista, A vem primeiro
      if (indexA !== -1) return -1;
      // Se apenas B está na lista, B vem primeiro
      if (indexB !== -1) return 1;
      // Se nenhum está na lista, ordenar alfabeticamente
      return a.localeCompare(b);
    });
  }, [bets]);

  const uniqueLeagues = useMemo(() => {
    const leagues = Array.from(new Set(bets.map(bet => bet.league).filter(Boolean)));
    // Ordenar de acordo com a ordem de LEAGUES_LIST
    return leagues.sort((a, b) => {
      const indexA = LEAGUES_LIST.indexOf(a);
      const indexB = LEAGUES_LIST.indexOf(b);
      // Se ambos estão na lista, manter a ordem da lista
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // Se apenas A está na lista, A vem primeiro
      if (indexA !== -1) return -1;
      // Se apenas B está na lista, B vem primeiro
      if (indexB !== -1) return 1;
      // Se nenhum está na lista, ordenar alfabeticamente
      return a.localeCompare(b);
    });
  }, [bets]);

  const uniqueBettingMarkets = useMemo(() => {
    const markets = Array.from(new Set(bets.map(bet => bet.betting_market).filter(Boolean)));
    return markets.sort((a, b) => {
      const indexA = BETTING_MARKETS_LIST.indexOf(a);
      const indexB = BETTING_MARKETS_LIST.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [bets]);

  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      // Filter by status: if any statuses selected, bet must match one of them
      if (filters.status.length > 0 && !filters.status.includes(bet.status)) return false;
      
      // Filter by sport: if any sports selected, bet must match one of them
      if (filters.sport.length > 0) {
        const includeEmpty = filters.sport.includes('__empty__');
        const sportValues = filters.sport.filter(v => v !== '__empty__');
        const betSport = bet.sport || '';
        
        const matchesEmpty = includeEmpty && !betSport;
        const matchesValue = sportValues.length > 0 && sportValues.includes(betSport);
        
        if (!matchesEmpty && !matchesValue) {
          return false;
        }
      }
      
      // Filter by league: if any leagues selected, bet must match one of them
      if (filters.league.length > 0) {
        const includeEmpty = filters.league.includes('__empty__');
        const leagueValues = filters.league.filter(v => v !== '__empty__');
        const betLeague = bet.league || '';
        
        const matchesEmpty = includeEmpty && !betLeague;
        const matchesValue = leagueValues.length > 0 && leagueValues.includes(betLeague);
        
        if (!matchesEmpty && !matchesValue) {
          return false;
        }
      }
      
      // Filter by betting_market: if any markets selected, bet must match one of them
      if (filters.betting_market.length > 0) {
        const includeEmpty = filters.betting_market.includes('__empty__');
        const marketValues = filters.betting_market.filter(v => v !== '__empty__');
        const betMarket = bet.betting_market || '';
        
        const matchesEmpty = includeEmpty && !betMarket;
        const matchesValue = marketValues.length > 0 && marketValues.includes(betMarket);
        
        if (!matchesEmpty && !matchesValue) {
          return false;
        }
      }
      
      // Filter by date range
      if (filters.dateFrom) {
        const [fy, fm, fd] = filters.dateFrom.split('-').map(Number);
        const fromDate = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
        if (new Date(bet.bet_date) < fromDate) return false;
      }
      if (filters.dateTo) {
        const [ty, tm, td] = filters.dateTo.split('-').map(Number);
        const toDate = new Date(ty, tm - 1, td, 23, 59, 59, 999);
        if (new Date(bet.bet_date) > toDate) return false;
      }
      
      // Filter by search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchDescription = bet.bet_description?.toLowerCase().includes(query);
        const matchMatch = bet.match_description?.toLowerCase().includes(query);
        const matchLeague = bet.league?.toLowerCase().includes(query);
        const matchBettingMarket = bet.betting_market?.toLowerCase().includes(query);
        if (!matchDescription && !matchMatch && !matchLeague && !matchBettingMarket) return false;
      }
      
      // Filter by tags: if any tags selected, bet must have at least one of them
      if (filters.selectedTags.length > 0) {
        const betTagIds = (bet.tags || []).map(tag => tag.id);
        if (!filters.selectedTags.some(tagId => betTagIds.includes(tagId))) return false;
      }

      // Filter by stake mínimo
      if (filters.stakeMin !== '') {
        const min = parseFloat(filters.stakeMin.replace(',', '.'));
        if (!isNaN(min) && bet.stake_amount < min) return false;
      }

      // Filter by odds min/max
      if (filters.oddsMin !== '') {
        const min = parseFloat(filters.oddsMin.replace(',', '.'));
        if (!isNaN(min) && bet.odds < min) return false;
      }
      if (filters.oddsMax !== '') {
        const max = parseFloat(filters.oddsMax.replace(',', '.'));
        if (!isNaN(max) && bet.odds > max) return false;
      }

      return true;
    });
  }, [bets, filters]);

  // Sort logic
  const sortedBets = useMemo(() => {
    if (!sortConfig.column) return filteredBets;
    
    return [...filteredBets].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortConfig.column) {
        case 'bet_date': {
          const aDatePart = String(a.bet_date || '').split('T')[0];
          const bDatePart = String(b.bet_date || '').split('T')[0];
          const dateCmp = aDatePart.localeCompare(bDatePart);
          if (dateCmp !== 0) {
            return sortConfig.direction === 'asc' ? dateCmp : -dateCmp;
          }
          // Mesmo dia: desempate por created_at (mesma direção da ordenação)
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        }
        case 'sport':
          aValue = (a.sport || '').toLowerCase();
          bValue = (b.sport || '').toLowerCase();
          break;
        case 'league':
          aValue = (a.league || '').toLowerCase();
          bValue = (b.league || '').toLowerCase();
          break;
        case 'betting_market':
          aValue = (a.betting_market || '').toLowerCase();
          bValue = (b.betting_market || '').toLowerCase();
          break;
        case 'stake_amount':
          aValue = a.stake_amount || 0;
          bValue = b.stake_amount || 0;
          break;
        case 'odds':
          aValue = a.odds || 0;
          bValue = b.odds || 0;
          break;
        case 'return':
          aValue = a.is_cashout && a.cashout_amount 
            ? a.cashout_amount 
            : a.status === 'half_won' 
              ? (a.stake_amount + a.potential_return) / 2 
              : a.status === 'half_lost' 
                ? a.stake_amount / 2 
                : (a.potential_return || 0);
          bValue = b.is_cashout && b.cashout_amount 
            ? b.cashout_amount 
            : b.status === 'half_won' 
              ? (b.stake_amount + b.potential_return) / 2 
              : b.status === 'half_lost' 
                ? b.stake_amount / 2 
                : (b.potential_return || 0);
          break;
        case 'profit': {
          const getProfit = (bet: Bet) => {
            if (bet.status === 'pending') return 0;
            if (bet.is_cashout && bet.cashout_amount) return bet.cashout_amount - bet.stake_amount;
            if (bet.status === 'won') return bet.potential_return - bet.stake_amount;
            if (bet.status === 'lost') return -bet.stake_amount;
            if (bet.status === 'half_won') return (bet.potential_return - bet.stake_amount) / 2;
            if (bet.status === 'half_lost') return -bet.stake_amount / 2;
            return 0;
          };
          aValue = getProfit(a);
          bValue = getProfit(b);
          break;
        }
        case 'status':
          // Ordem customizada: pending, won, lost, half_won, half_lost, cashout, void
          const statusOrder: Record<string, number> = {
            'pending': 1,
            'won': 2,
            'lost': 3,
            'half_won': 4,
            'half_lost': 5,
            'cashout': 6,
            'void': 7
          };
          aValue = statusOrder[a.status] || 999;
          bValue = statusOrder[b.status] || 999;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredBets, sortConfig]);

  // Pagination: slice sortedBets for current page
  const totalPages = Math.max(1, Math.ceil(sortedBets.length / pageSize));
  const paginatedBets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedBets.slice(start, start + pageSize);
  }, [sortedBets, currentPage, pageSize]);

  const paginationStartIndex = sortedBets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const paginationEndIndex = Math.min(currentPage * pageSize, sortedBets.length);

  const toggleSelectBet = useCallback((betId: string) => {
    setSelectedBetIds(prev => {
      const next = new Set(prev);
      if (next.has(betId)) next.delete(betId); else next.add(betId);
      return next;
    });
  }, []);

  const isAllPageSelected = paginatedBets.length > 0 &&
    paginatedBets.every(b => selectedBetIds.has(b.id));
  const isPageIndeterminate = paginatedBets.some(b => selectedBetIds.has(b.id)) && !isAllPageSelected;

  const toggleSelectAllPage = useCallback(() => {
    const pageIds = paginatedBets.map(b => b.id);
    setSelectedBetIds(prev => {
      const next = new Set(prev);
      if (pageIds.every(id => next.has(id))) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [paginatedBets]);

  const selectAllFiltered = useCallback(() => {
    setSelectedBetIds(new Set(filteredBets.map(b => b.id)));
  }, [filteredBets]);

  const clearSelection = useCallback(() => setSelectedBetIds(new Set()), []);

  const bulkUpdateStatus = useCallback(async (status: string) => {
    const ids = Array.from(selectedBetIds);
    // Apostas que estavam pending e agora vão a um status final = liquidação em lote (o caminho
    // manual que o diagnóstico apontou como gargalo). Lidas do ref pra não depender de `bets`.
    const nowSettled = FINAL_BET_STATUSES.includes(status)
      ? betsRef.current.filter(b => selectedBetIds.has(b.id) && b.status === 'pending')
      : [];
    setBets(prev => prev.map(b => ids.includes(b.id) ? { ...b, status: status as Bet['status'] } : b));
    try {
      const { error } = await supabase.from('bets').update({ status }).in('id', ids);
      if (error) throw error;
      // count = quantas realmente transicionaram pending→final nesta ação (não o tamanho da seleção).
      nowSettled.forEach(b => captureBetSettled(posthog, b, status, { batch: true, count: nowSettled.length }));
      toast({ title: 'Sucesso', description: `${ids.length} apostas atualizadas` });
      clearSelection();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao atualizar apostas', variant: 'destructive' });
      fetchBets();
    }
  }, [selectedBetIds, posthog, supabase, toast, clearSelection, fetchBets]);

  const bulkAddTag = useCallback(async (tag: Tag) => {
    const ids = Array.from(selectedBetIds);
    setBets(prev => prev.map(b =>
      ids.includes(b.id) && !b.tags?.some(t => t.id === tag.id)
        ? { ...b, tags: [...(b.tags || []), tag] } as Bet
        : b
    ));
    try {
      await Promise.all(ids.map(betId => supabase.rpc('add_tag_to_bet', { p_bet_id: betId, p_tag_id: tag.id })));
      toast({ title: 'Sucesso', description: `Tag "${tag.name}" adicionada a ${ids.length} apostas` });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao adicionar tag', variant: 'destructive' });
      fetchBets();
    }
  }, [selectedBetIds, supabase, toast, fetchBets]);

  // bulkDelete dispara o dialog de confirmação. A exclusão real acontece em performBulkDelete.
  const bulkDelete = useCallback(() => {
    if (selectedBetIds.size === 0) return;
    setConfirmDelete({ type: 'bulk', count: selectedBetIds.size });
  }, [selectedBetIds.size]);

  const performBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedBetIds);
    setBets(prev => prev.filter(b => !ids.includes(b.id)));
    try {
      const { error } = await supabase.from('bets').delete().in('id', ids);
      if (error) throw error;
      toast({ title: 'Sucesso', description: `${ids.length} apostas excluídas` });
      clearSelection();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao excluir apostas', variant: 'destructive' });
      fetchBets();
    }
  }, [selectedBetIds, supabase, toast, clearSelection, fetchBets]);

  const filteredSportsList = useMemo(() => {
    if (!isSportQueryTouched) {
      return SPORTS_LIST;
    }
    const query = editModal.formData.sport.trim().toLowerCase();
    if (!query) return SPORTS_LIST;
    return SPORTS_LIST.filter((sport) => sport.toLowerCase().includes(query));
  }, [editModal.formData.sport, isSportQueryTouched]);

  const filteredLeaguesList = useMemo(() => {
    if (!isLeagueQueryTouched) {
      return LEAGUES_LIST;
    }
    const query = editModal.formData.league.trim().toLowerCase();
    if (!query) return LEAGUES_LIST;
    return LEAGUES_LIST.filter((league) => league.toLowerCase().includes(query));
  }, [editModal.formData.league, isLeagueQueryTouched]);

  const filteredBettingMarketsList = useMemo(() => {
    if (!isBettingMarketQueryTouched) {
      return BETTING_MARKETS_LIST;
    }
    const query = editModal.formData.betting_market.trim().toLowerCase();
    if (!query) return BETTING_MARKETS_LIST;
    return BETTING_MARKETS_LIST.filter((market) => market.toLowerCase().includes(query));
  }, [editModal.formData.betting_market, isBettingMarketQueryTouched]);

  useEffect(() => {
    if (!isSportDropdownOpen || filteredSportsList.length === 0) {
      setSportHighlightIndex(-1);
      return;
    }

    setSportHighlightIndex((prev) => {
      if (prev < 0 || prev >= filteredSportsList.length) {
        return 0;
      }
      return prev;
    });
  }, [isSportDropdownOpen, filteredSportsList.length]);

  useEffect(() => {
    if (!editModal.isOpen || !isSportDropdownOpen || sportHighlightIndex < 0) return;
    const currentItem = sportItemRefs.current[sportHighlightIndex];
    if (currentItem?.scrollIntoView) {
      currentItem.scrollIntoView({ block: 'nearest' });
    }
  }, [editModal.isOpen, isSportDropdownOpen, sportHighlightIndex]);

  useEffect(() => {
    if (!isLeagueDropdownOpen || filteredLeaguesList.length === 0) {
      setLeagueHighlightIndex(-1);
      return;
    }

    setLeagueHighlightIndex((prev) => {
      if (prev < 0 || prev >= filteredLeaguesList.length) {
        return 0;
      }
      return prev;
    });
  }, [isLeagueDropdownOpen, filteredLeaguesList.length]);

  useEffect(() => {
    if (!editModal.isOpen || !isLeagueDropdownOpen || leagueHighlightIndex < 0) return;
    const currentItem = leagueItemRefs.current[leagueHighlightIndex];
    if (currentItem?.scrollIntoView) {
      currentItem.scrollIntoView({ block: 'nearest' });
    }
  }, [editModal.isOpen, isLeagueDropdownOpen, leagueHighlightIndex]);

  useEffect(() => {
    if (!isBettingMarketDropdownOpen || filteredBettingMarketsList.length === 0) {
      setBettingMarketHighlightIndex(-1);
      return;
    }
    setBettingMarketHighlightIndex((prev) => {
      if (prev < 0 || prev >= filteredBettingMarketsList.length) {
        return 0;
      }
      return prev;
    });
  }, [isBettingMarketDropdownOpen, filteredBettingMarketsList.length]);

  useEffect(() => {
    if (!editModal.isOpen || !isBettingMarketDropdownOpen || bettingMarketHighlightIndex < 0) return;
    const currentItem = bettingMarketItemRefs.current[bettingMarketHighlightIndex];
    if (currentItem?.scrollIntoView) {
      currentItem.scrollIntoView({ block: 'nearest' });
    }
  }, [editModal.isOpen, isBettingMarketDropdownOpen, bettingMarketHighlightIndex]);

  useEffect(() => {
    if (isMountedRef.current) {
      calculateStats(filteredBets);
    }
  }, [filteredBets, calculateStats]);

  // Reset to page 1 and clear selection when filters, sort, or page size change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedBetIds(new Set());
  }, [filters, sortConfig, pageSize]);

  // Handle sort
  const handleSort = (column: SortColumn) => {
    setSortConfig(prev => {
      if (prev.column === column) {
        // Toggle direction if same column
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      } else {
        // New column, default to ascending
        return {
          column,
          direction: 'asc'
        };
      }
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      status: [],
      sport: [],
      league: [],
      betting_market: [],
      searchQuery: '',
      dateFrom: '',
      dateTo: '',
      selectedTags: [],
      stakeMin: '',
      oddsMin: '',
      oddsMax: '',
    });
    setSelectedBetIds(new Set());
  };

  // Exporta as apostas filtradas pra CSV (download local — sem rede)
  const handleExportCsv = useCallback(() => {
    const rows = filteredBets;
    if (rows.length === 0) {
      toast({ title: 'Nada para exportar', description: 'Ajuste os filtros e tente novamente.' });
      return;
    }
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Data', 'Descrição', 'Partida', 'Esporte', 'Liga', 'Mercado', 'Stake', 'Odds', 'Retorno potencial', 'Status', 'Tags'];
    const lines = rows.map(b => [
      b.bet_date?.split('T')[0] ?? '',
      b.bet_description ?? '',
      b.match_description ?? '',
      b.sport ?? '',
      b.league ?? '',
      b.betting_market ?? '',
      b.stake_amount,
      b.odds,
      b.potential_return,
      b.status,
      (b.tags || []).map(t => t.name).join(' | '),
    ].map(escape).join(','));
    const csv = '﻿' + [header.join(','), ...lines].join('\n'); // BOM pra Excel reconhecer UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apostas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado', description: `${rows.length} aposta${rows.length !== 1 ? 's' : ''} no CSV.` });
  }, [filteredBets, toast]);

  // Helper to translate status
  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'PENDENTE',
      'won': 'GANHOU',
      'lost': 'PERDEU',
      'void': 'ANULADA',
      'cashout': 'CASHOUT',
      'half_won': '1/2 GREEN',
      'half_lost': '1/2 RED'
    };
    return map[status] || status.toUpperCase();
  };

  // Date conversion helpers
  const parseDateString = (dateString: string): Date | undefined => {
    if (!dateString) return undefined;
    const date = parse(dateString, 'yyyy-MM-dd', new Date());
    return isValid(date) ? date : undefined;
  };

  const formatDateToString = (date: Date | undefined): string => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  /** Format bet_date for display using only the date part (avoids timezone shift). */
  const formatBetDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const datePart = String(dateStr).split('T')[0];
    const date = parse(datePart, 'yyyy-MM-dd', new Date());
    return isValid(date) ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : '';
  };

  // Stats derivados de filteredBets — refletem os mesmos dados que stake médio / odd média.
  // Precisa estar DEPOIS de formatBetDateForDisplay pra evitar TDZ na primeira render.
  const secondaryStats = useMemo(() => {
    const total = filteredBets.length;
    const totalStaked = filteredBets.reduce((s, b) => s + b.stake_amount, 0);
    const totalOdds = filteredBets.reduce((s, b) => s + b.odds, 0);
    const avgStake = total > 0 ? totalStaked / total : 0;
    const avgOdds = total > 0 ? totalOdds / total : 0;

    const settledBets = filteredBets.filter(b =>
      ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(b.status)
    );
    let biggestWin: { profit: number; description: string; date: string } | null = null;
    let biggestLoss: { profit: number; description: string; date: string } | null = null;

    settledBets.forEach(bet => {
      let profit = 0;
      if (bet.status === 'won') profit = bet.potential_return - bet.stake_amount;
      else if (bet.status === 'lost') profit = -bet.stake_amount;
      else if (bet.status === 'cashout' && bet.cashout_amount) profit = bet.cashout_amount - bet.stake_amount;
      else if (bet.status === 'half_won') profit = (bet.potential_return - bet.stake_amount) / 2;
      else if (bet.status === 'half_lost') profit = -bet.stake_amount / 2;

      if (profit > 0 && (!biggestWin || profit > biggestWin.profit)) {
        biggestWin = { profit, description: bet.bet_description, date: formatBetDateForDisplay(bet.bet_date) };
      }
      if (profit < 0 && (!biggestLoss || profit < biggestLoss.profit)) {
        biggestLoss = { profit, description: bet.bet_description, date: formatBetDateForDisplay(bet.bet_date) };
      }
    });

    return { avgStake, avgOdds, biggestWin, biggestLoss };
  }, [filteredBets]);

  // Sortable Header Component
  const SortableHeader = ({ column, label, align = 'left', className: extraClassName }: { column: SortColumn; label: string; align?: 'left' | 'right' | 'center'; className?: string }) => {
    const isActive = sortConfig.column === column;
    return (
      <th
        className={`${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} py-2.5 px-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-2 font-semibold cursor-pointer hover:text-ink transition-colors select-none ${extraClassName ?? ''}`}
        onClick={() => handleSort(column)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          {label}
          {isActive ? (
            sortConfig.direction === 'asc' ? (
              <ChevronUp className="w-3 h-3 text-forest" />
            ) : (
              <ChevronDown className="w-3 h-3 text-forest" />
            )
          ) : (
            <ChevronUp className="w-3 h-3 opacity-30" />
          )}
        </div>
      </th>
    );
  };

  const desktopRows = useMemo(() => {
    return paginatedBets.map((bet) => (
      <BetRow
        key={bet.id}
        bet={bet}
        formatValue={formatValue}
        formatBetDate={formatBetDateForDisplay}
        translateStatus={translateStatus}
        onBetTagsChange={handleBetTagsChange}
        onTagsUpdated={fetchUserTags}
        availableTags={userTags}
        updateBetStatus={updateBetStatus}
        openCashoutModal={openCashoutModal}
        openEditModal={openEditModal}
        deleteBet={deleteBet}
        isSelected={selectedBetIds.has(bet.id)}
        onToggleSelect={toggleSelectBet}
      />
    ));
  }, [paginatedBets, formatValue, formatBetDateForDisplay, translateStatus, handleBetTagsChange, fetchUserTags, userTags, updateBetStatus, openCashoutModal, openEditModal, deleteBet, selectedBetIds, toggleSelectBet]);

  const mobileCards = useMemo(() => {
    return paginatedBets.map((bet) => (
      <BetCard
        key={bet.id}
        bet={bet}
        formatValue={formatValue}
        formatBetDate={formatBetDateForDisplay}
        translateStatus={translateStatus}
        onBetTagsChange={handleBetTagsChange}
        onTagsUpdated={fetchUserTags}
        availableTags={userTags}
        updateBetStatus={updateBetStatus}
        openCashoutModal={openCashoutModal}
        openEditModal={openEditModal}
        deleteBet={deleteBet}
        isSelected={selectedBetIds.has(bet.id)}
        onToggleSelect={toggleSelectBet}
      />
    ));
  }, [paginatedBets, formatValue, formatBetDateForDisplay, translateStatus, handleBetTagsChange, fetchUserTags, userTags, updateBetStatus, openCashoutModal, openEditModal, deleteBet, selectedBetIds, toggleSelectBet]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    clearSelection();
  }, [totalPages, clearSelection]);

  // Mapeia status → classes do mockup quando ativo (cor por status)
  const statusActiveClass = (value: string): string => {
    if (value === 'won' || value === 'half_won') return 'bg-status-success/10 text-status-success border-status-success/30';
    if (value === 'lost' || value === 'half_lost') return 'bg-status-danger/10 text-status-danger border-status-danger/30';
    if (value === 'pending') return 'bg-status-warning/10 text-status-warning border-status-warning/30';
    if (value === 'cashout') return 'bg-forest-tint text-forest border-forest/30';
    return 'bg-ink-3 text-ink-2 border-line';
  };

  // Conta total de filtros ativos no botão "Mais filtros" / "Filtros"
  const advancedFiltersTotal =
    filters.status.length +
    filters.sport.length +
    filters.league.length +
    filters.betting_market.length +
    filters.selectedTags.length +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.stakeMin !== '' ? 1 : 0) +
    ((filters.oddsMin !== '' || filters.oddsMax !== '') ? 1 : 0);

  // Detecta qual preset de período está ativo (ou Custom/Tudo)
  const activePeriodPreset: '7d' | '30d' | '90d' | 'all' | 'custom' | null = (() => {
    if (!filters.dateFrom && !filters.dateTo) return 'all';
    const fromDate = parseDateString(filters.dateFrom);
    if (!fromDate) return 'custom';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const p of [{ k: '7d' as const, days: 7 }, { k: '30d' as const, days: 30 }, { k: '90d' as const, days: 90 }]) {
      const target = new Date(today);
      target.setDate(today.getDate() - p.days);
      if (Math.abs(fromDate.getTime() - target.getTime()) < 24 * 60 * 60 * 1000) {
        return p.k;
      }
    }
    return 'custom';
  })();

  const advancedFiltersContent = (
    <>
      {/* Header */}
      <div className="px-5 py-4 border-b border-line -mx-6 -mt-6 mb-0">
        <div className="text-[11px] uppercase tracking-[0.16em] text-forest font-semibold">Filtros avançados</div>
        <DialogTitle className="text-[16px] font-semibold tracking-tight text-ink mt-0.5">Refinar minhas apostas</DialogTitle>
      </div>

      {/* Body — 2-col grid */}
      <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6 text-[12px]">
        {/* Período — segmented control + popover de calendário em "Personalizado" */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Período</label>
          <div className="mt-2 grid grid-cols-3 gap-1 p-1 bg-ink-3/60 rounded-md text-[11px] font-medium">
            {([
              { k: '7d', l: '7d' },
              { k: '30d', l: '30d' },
              { k: '90d', l: '90d' },
              { k: 'all', l: 'Tudo' },
            ] as const).map(p => {
              const active = activePeriodPreset === p.k;
              return (
                <button
                  key={p.k}
                  type="button"
                  onClick={() => {
                    if (p.k === 'all') {
                      setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }));
                    } else {
                      const days = p.k === '7d' ? 7 : p.k === '30d' ? 30 : 90;
                      const today = new Date();
                      const from = new Date();
                      from.setDate(today.getDate() - days);
                      setFilters(prev => ({
                        ...prev,
                        dateFrom: formatDateToString(from),
                        dateTo: formatDateToString(today),
                      }));
                    }
                  }}
                  className={`h-7 rounded transition-colors ${
                    active ? 'bg-white border border-line text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {p.l}
                </button>
              );
            })}
            {/* Personalizado — popover com calendário */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`h-7 rounded transition-colors col-span-2 ${
                    activePeriodPreset === 'custom'
                      ? 'bg-white border border-line text-ink shadow-sm'
                      : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {activePeriodPreset === 'custom' && filters.dateFrom && filters.dateTo
                    ? `${format(parseDateString(filters.dateFrom)!, 'dd MMM', { locale: ptBR })} – ${format(parseDateString(filters.dateTo)!, 'dd MMM', { locale: ptBR })}`
                    : 'Personalizado'}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="theme-rebrand w-auto p-0 bg-white border border-line text-ink rounded-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)] z-[60]"
              >
                <CalendarComponent
                  mode="range"
                  selected={{
                    from: parseDateString(filters.dateFrom) || undefined,
                    to: parseDateString(filters.dateTo) || undefined,
                  }}
                  onSelect={(range) => {
                    setFilters(prev => ({
                      ...prev,
                      dateFrom: formatDateToString(range?.from),
                      dateTo: formatDateToString(range?.to),
                    }));
                  }}
                  numberOfMonths={2}
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
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Status</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { value: 'won', label: 'Ganhou' },
              { value: 'lost', label: 'Perdeu' },
              { value: 'pending', label: 'Pendente' },
              { value: 'half_won', label: '½ Green' },
              { value: 'half_lost', label: '½ Red' },
              { value: 'cashout', label: 'Cashout' },
              { value: 'void', label: 'Anulada' },
            ].map(s => {
              const active = filters.status.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    status: active ? prev.status.filter(v => v !== s.value) : [...prev.status, s.value],
                  }))}
                  className={`px-2.5 h-7 rounded-md border text-[11px] font-semibold transition-colors ${
                    active ? statusActiveClass(s.value) : 'bg-white text-ink-2 border-line hover:border-forest/30 hover:text-ink'
                  }`}
                >
                  {active && '✓ '}{s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Esporte (full row) */}
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Esporte</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ...uniqueSports.map(s => ({ value: s, label: s })),
              { value: '__empty__', label: 'Sem classificação' },
            ].map(s => {
              const active = filters.sport.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    sport: active ? prev.sport.filter(v => v !== s.value) : [...prev.sport, s.value],
                  }))}
                  className={`inline-flex items-center px-3 h-8 rounded-full border text-[11px] font-medium transition-colors ${
                    active ? 'bg-forest-tint text-forest border-forest' : 'bg-white text-ink-2 border-line hover:border-forest/30 hover:text-ink'
                  }`}
                >
                  {s.label}
                  {active && ' ✓'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Liga */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Liga</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ...uniqueLeagues.map(l => ({ value: l, label: l })),
              { value: '__empty__', label: 'Sem classificação' },
            ].map(opt => {
              const active = filters.league.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    league: active ? prev.league.filter(v => v !== opt.value) : [...prev.league, opt.value],
                  }))}
                  className={`px-2.5 h-7 rounded-md border text-[11px] font-medium transition-colors ${
                    active ? 'bg-forest-tint text-forest border-forest' : 'bg-white text-ink-2 border-line hover:border-forest/30 hover:text-ink'
                  }`}
                >
                  {opt.label}{active && ' ✓'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mercado */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Mercado</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ...uniqueBettingMarkets.map(m => ({ value: m, label: m })),
              { value: '__empty__', label: 'Sem classificação' },
            ].map(opt => {
              const active = filters.betting_market.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    betting_market: active ? prev.betting_market.filter(v => v !== opt.value) : [...prev.betting_market, opt.value],
                  }))}
                  className={`px-2.5 h-7 rounded-md border text-[11px] font-medium transition-colors ${
                    active ? 'bg-forest-tint text-forest border-forest' : 'bg-white text-ink-2 border-line hover:border-forest/30 hover:text-ink'
                  }`}
                >
                  {opt.label}{active && ' ✓'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stake mínimo */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Stake mínimo</label>
          <div className="mt-2 flex items-center h-10 bg-white border border-line rounded-md focus-within:border-forest/40">
            <span className="pl-3 text-[12px] text-ink-2">R$</span>
            <input
              type="number"
              inputMode="decimal"
              value={filters.stakeMin}
              onChange={(e) => setFilters(prev => ({ ...prev, stakeMin: e.target.value }))}
              placeholder="50"
              className="flex-1 bg-transparent px-3 text-[13px] outline-none tabular text-ink min-w-0"
            />
          </div>
        </div>

        {/* Odd mínima / máxima */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Odd mínima / máxima</label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={filters.oddsMin}
              onChange={(e) => setFilters(prev => ({ ...prev, oddsMin: e.target.value }))}
              placeholder="1,50"
              className="flex-1 h-10 bg-white border border-line rounded-md px-3 text-[13px] outline-none tabular text-ink min-w-0 focus:border-forest/40"
            />
            <span className="text-ink-2">→</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={filters.oddsMax}
              onChange={(e) => setFilters(prev => ({ ...prev, oddsMax: e.target.value }))}
              placeholder="5,00"
              className="flex-1 h-10 bg-white border border-line rounded-md px-3 text-[13px] outline-none tabular text-ink min-w-0 focus:border-forest/40"
            />
          </div>
        </div>

        {/* Tags (full row) */}
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Tags</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {userTags.length === 0 ? (
              <p className="text-[12px] text-ink-2">Nenhuma tag criada ainda.</p>
            ) : (
              userTags.map(tag => {
                const active = filters.selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      selectedTags: active
                        ? prev.selectedTags.filter(id => id !== tag.id)
                        : [...prev.selectedTags, tag.id],
                    }))}
                    className={`inline-flex items-center gap-1 px-2 h-7 rounded-md border text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-white border-forest text-ink shadow-[0_0_0_2px_rgba(10,61,46,0.08)]'
                        : 'bg-white border-line text-ink-2 hover:border-forest/30 hover:text-ink'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: tag.color }} />
                    {tag.name}
                    {active && ' ✓'}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-line bg-canvas/50 -mx-6 -mb-6 mt-0 flex items-center justify-between">
        <button
          type="button"
          onClick={clearAllFilters}
          className="text-[12px] font-semibold text-ink-2 hover:text-ink"
        >
          Limpar tudo
        </button>
        <DialogClose asChild>
          <button
            type="button"
            className="h-9 px-4 text-[12px] font-semibold text-white bg-forest hover:bg-forest-soft rounded-md transition-colors"
          >
            {advancedFiltersTotal > 0 ? `Aplicar ${advancedFiltersTotal} filtro${advancedFiltersTotal > 1 ? 's' : ''}` : 'Fechar'}
          </button>
        </DialogClose>
      </div>
    </>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-terminal-green"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center text-terminal-text">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-terminal-red" />
          <p>Por favor, faça login para ver suas apostas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-rebrand w-full min-h-screen bg-canvas text-ink">
      <BetsHeader
        showBack
        onReferralClick={() => setReferralModalOpen(true)}
      />

      {/* Page Header */}
      <div className="bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.2em] text-ink-2 uppercase">Apostas</div>
            <h1 className="text-[28px] font-semibold tracking-tight text-ink mt-1">Minhas apostas</h1>
            <p className="text-[13px] text-ink-2 mt-1 tabular">
              {stats.totalBets} {stats.totalBets === 1 ? 'aposta registrada' : 'apostas registradas'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle R$ / u */}
            <div className="h-9 inline-flex items-center p-0.5 bg-ink-3 border border-line rounded-md">
              <button
                type="button"
                onClick={() => setShowUnitsView(false)}
                className={`h-7 px-3 text-[12px] font-semibold rounded transition-colors ${
                  !showUnitsView ? 'bg-white text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
                }`}
              >
                R$
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isConfigured()) {
                    setUnitConfigOpen(true);
                    return;
                  }
                  setShowUnitsView(true);
                }}
                title={!isConfigured() ? 'Configure sua unidade pra ver apostas em u' : undefined}
                className={`h-7 px-3 text-[12px] font-semibold rounded transition-colors ${
                  showUnitsView ? 'bg-white text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
                }`}
              >
                u
              </button>
            </div>

            {/* 1u = R$ X chip — desktop mostra chip completo, mobile só ícone Settings */}
            <button
              type="button"
              onClick={() => setUnitConfigOpen(true)}
              className="h-9 px-2 md:px-2.5 inline-flex items-center gap-1.5 text-[11px] text-ink-2 hover:text-ink border border-line bg-white hover:bg-ink-3/40 rounded-md transition-colors"
              title={isConfigured() && config.unit_value ? `1u = ${formatCurrency(config.unit_value)}` : 'Configurar unidade'}
            >
              {isConfigured() && config.unit_value ? (
                <>
                  <span className="hidden md:inline text-[10px] uppercase tracking-[0.1em] font-semibold">1u =</span>
                  <span className="hidden md:inline tabular text-ink font-semibold">{formatCurrency(config.unit_value)}</span>
                  <Edit className="w-3.5 h-3.5 md:w-3 md:h-3 text-ink-2" />
                </>
              ) : (
                <>
                  <Settings className="w-3.5 h-3.5 text-forest" />
                  <span className="hidden md:inline text-forest font-semibold">Configurar unidade</span>
                </>
              )}
            </button>

            {/* Exportar — ícone-only no mobile, ícone+texto no desktop */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="h-9 px-2 md:px-3 inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink border border-line bg-white hover:bg-ink-3/40 rounded-md transition-colors"
              title="Exportar CSV"
              aria-label="Exportar CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Exportar</span>
            </button>

            {/* Compartilhar — ícone-only no mobile */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="h-9 px-2 md:px-3 inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink border border-line bg-white hover:bg-ink-3/40 rounded-md transition-colors"
              title="Compartilhar"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden md:inline">Compartilhar</span>
            </button>

            {/* Nova aposta — só desktop. Mobile usa o FAB. */}
            <button
              type="button"
              onClick={() => {
                if (isBetinhoFree && (dailyBetCount ?? 0) >= DAILY_BET_LIMIT) {
                  navigate('/paywall');
                  return;
                }
                setIsCreateModalOpen(true);
              }}
              className="hidden md:inline-flex h-9 px-4 items-center gap-2 text-[13px] font-semibold text-white bg-forest hover:bg-forest-soft rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nova aposta</span>
            </button>
          </div>
        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 py-6 focus:outline-none">
        {/* Onboarding cards — usuário sem nenhuma aposta. Aparecem ACIMA do conteúdo regular */}
        {!isLoading && bets.length === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* Primary CTA — Telegram */}
            <div className="bg-forest text-white rounded-xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-[10px] uppercase tracking-[0.16em] font-semibold text-amber-400 bg-white/5 border border-amber-400/20 px-2 py-1 rounded">
                Recomendado
              </div>
              <div className="w-12 h-12 rounded-md bg-amber-400 text-forest grid place-items-center mb-5">
                <Send className="w-6 h-6" />
              </div>
              <h2 className="text-[22px] md:text-[24px] font-semibold tracking-tight">Comece pelo Telegram.</h2>
              <p className="text-[13px] md:text-[14px] text-white/70 mt-2 leading-relaxed">
                Abra o Betinho, mande seu primeiro bilhete por texto ou print — e essa tela enche sozinha.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <a href={telegramBotUrl} target="_blank" rel="noopener noreferrer"
                  className="h-10 px-4 inline-flex items-center gap-2 text-[13px] font-semibold text-forest bg-amber-400 hover:bg-amber-500 rounded-md transition-colors">
                  <Send className="w-4 h-4" />
                  <span>Abrir bot</span>
                </a>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="text-[10px] uppercase tracking-[0.14em] text-amber-400 font-semibold mb-3">3 formatos aceitos</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-white/80">
                  <div className="border-l-2 border-amber-400 pl-2.5">Texto livre — "apostei R$ 150 LeBron 25+"</div>
                  <div className="border-l-2 border-amber-400 pl-2.5">Áudio — fale o bilhete</div>
                  <div className="border-l-2 border-amber-400 pl-2.5">Print — foto do cupom</div>
                </div>
              </div>
            </div>
            {/* Secondary — manual */}
            <div className="bg-white border border-line rounded-xl p-6 md:p-8">
              <h2 className="text-[18px] md:text-[20px] font-semibold tracking-tight text-ink">Ou cadastre manualmente.</h2>
              <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">
                Se preferir tela e formulário, dá pra cadastrar pelo painel — leva uns 30 segundos.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (isBetinhoFree && (dailyBetCount ?? 0) >= DAILY_BET_LIMIT) {
                    navigate('/paywall');
                    return;
                  }
                  setIsCreateModalOpen(true);
                }}
                className="mt-5 h-10 px-4 inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-ink hover:bg-ink/90 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar primeira aposta</span>
              </button>
            </div>
          </div>
        )}

        <>
        {/* Stats Grid — 4 slots: 2 Hero + 2 Pair (desktop) */}
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* ROI - HeroKPI */}
          <div className="bg-white border border-line rounded-lg p-5">
            <div className="text-[10px] font-semibold tracking-[0.16em] text-ink-2 uppercase">ROI</div>
            <div className={`text-[28px] md:text-[34px] font-semibold tabular leading-none mt-2 tracking-tight ${
              stats.roi >= 0 ? 'text-status-success' : 'text-status-danger'
            }`}>
              {stats.roi.toFixed(1)}%
            </div>
          </div>

          {/* Lucro Líquido - HeroKPI */}
          <div className="bg-white border border-line rounded-lg p-5">
            <div className="text-[10px] font-semibold tracking-[0.16em] text-ink-2 uppercase">Lucro líquido</div>
            <div className={`text-[28px] md:text-[34px] font-semibold tabular leading-none mt-2 tracking-tight ${
              stats.profit >= 0 ? 'text-status-success' : 'text-status-danger'
            }`}>
              {formatValue(stats.profit)}
            </div>
          </div>

          {/* Total Apostado + Retorno Bruto - PairKPI */}
          <div className="bg-white border border-line rounded-lg overflow-hidden divide-y divide-line">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Total apostado</div>
              <div className="text-[15px] tabular font-semibold text-ink">{formatValue(stats.totalStaked)}</div>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Retorno bruto</div>
              <div className="text-[15px] tabular font-semibold text-ink">{formatValue(stats.totalReturn)}</div>
            </div>
          </div>

          {/* Total Apostas + Taxa de Acerto - PairKPI */}
          <div className="bg-white border border-line rounded-lg overflow-hidden divide-y divide-line">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Total apostas</div>
              <div className="text-[15px] tabular font-semibold text-ink">{stats.totalBets}</div>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Taxa de acerto</div>
              <div className={`text-[15px] tabular font-semibold ${
                stats.winRate >= 50 ? 'text-status-success' : 'text-ink'
              }`}>
                {stats.winRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {!isMobile && (
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 mb-6">
          <BankrollEvolutionChart
            bets={bets}
            initialBankroll={config.bank_amount}
            capitalMovements={capitalMovements}
            onUpdateBankroll={async (amount) => {
              if (config.unit_calculation_method === 'direct') {
                return await updateConfig({
                  method: 'direct',
                  unitValue: config.unit_value || 10,
                  bankAmount: amount
                });
              }
              const currentDivisor = config.bank_amount && config.unit_value
                ? config.bank_amount / config.unit_value
                : 100;
              return await updateConfig({
                method: 'division',
                bankAmount: amount,
                divisor: currentDivisor
              });
            }}
            onAporte={() => setCapitalModal({ isOpen: true, type: 'deposit', amount: '', description: '' })}
            onResgate={() => setCapitalModal({ isOpen: true, type: 'withdrawal', amount: '', description: '' })}
            formatValue={formatValue}
          />

          {/* Coluna direita: Telegram banner + Limite Diário */}
          <div className="flex flex-col gap-4">
            {/* Telegram banner */}
            <a
              href={telegramBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-forest text-white rounded-lg p-5 flex items-start gap-4 hover:bg-forest-soft transition-colors"
            >
              <div className="w-12 h-12 rounded-md bg-white/10 border border-white/20 grid place-items-center text-amber-400 shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-400">Betinho · Telegram</div>
                <div className="text-[14px] font-semibold mt-1 leading-tight">Cadastre apostas em segundos pelo Telegram.</div>
                <div className="text-[12px] text-white/70 mt-1 leading-snug">Texto ou print do bilhete — a IA registra e este painel atualiza sozinho.</div>
                <div className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-forest bg-amber-400 hover:bg-amber-500 rounded-md transition-colors">
                  <Send className="w-3.5 h-3.5" />
                  <span>Abrir bot</span>
                </div>
              </div>
            </a>

            {/* Dashboard CTA — atalho pra análise */}
            <button
              type="button"
              onClick={() => navigate('/betting-dashboard')}
              className="bg-white border border-line rounded-lg p-5 text-left hover:border-forest/30 hover:bg-forest-tint/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-md bg-forest-tint border border-forest/20 grid place-items-center text-forest shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-ink-2 group-hover:text-forest transition-colors" />
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-2 font-semibold mt-3">Análise</div>
              <div className="text-[15px] font-semibold text-ink mt-1">Dashboard</div>
              <div className="text-[12px] text-ink-2 mt-1 leading-snug">
                Onde você ganha e onde perde — desempenho por liga, mercado e tag.
              </div>
            </button>
          </div>
        </div>
        )}

        {/* Mobile hero — banca atual + sparkline + mini stats */}
        <div className="md:hidden mb-4">
          {(() => {
            const movementsNet = capitalMovements
              .filter(m => m.affects_balance)
              .reduce((s, m) => s + (m.type === 'deposit' ? m.amount : -m.amount), 0);
            const currentBankroll = (config.bank_amount ?? 0) + stats.profit + movementsNet;
            return (
          <div className="bg-forest text-white rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-amber-400">Banca atual</div>
            <div className="text-[28px] font-semibold tabular tracking-tight mt-1">
              {formatValue(currentBankroll)}
            </div>
            <div className={`text-[11px] tabular font-semibold mt-0.5 ${stats.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {stats.profit >= 0 ? '+' : ''}{formatValue(stats.profit)} · {stats.profit >= 0 ? '+' : ''}{stats.roi.toFixed(1)}% no período
            </div>
            {/* mini sparkline em amber — 8 pontos derivados do profit acumulado */}
            <svg viewBox="0 0 300 50" className="w-full h-[40px] mt-3" preserveAspectRatio="none">
              <defs>
                <linearGradient id="m-bk-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const settled = bets.filter(b => ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(b.status))
                  .sort((a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime());
                if (settled.length === 0) return <path d="M0,40 L300,40" stroke="#fbbf24" strokeWidth="2" fill="none" />;
                const start = config.bank_amount ?? 0;
                let acc = start;
                const points = [{ x: 0, v: start }];
                settled.forEach((b, i) => {
                  let p = 0;
                  if (b.status === 'won') p = b.potential_return - b.stake_amount;
                  else if (b.status === 'lost') p = -b.stake_amount;
                  else if (b.status === 'cashout' && b.cashout_amount) p = b.cashout_amount - b.stake_amount;
                  else if (b.status === 'half_won') p = (b.potential_return - b.stake_amount) / 2;
                  else if (b.status === 'half_lost') p = -b.stake_amount / 2;
                  acc += p;
                  points.push({ x: ((i + 1) / settled.length) * 300, v: acc });
                });
                const min = Math.min(...points.map(p => p.v));
                const max = Math.max(...points.map(p => p.v));
                const range = max - min || 1;
                const ys = points.map(p => 45 - ((p.v - min) / range) * 40);
                const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${ys[i]}`).join(' ');
                const areaPath = `${linePath} L300,50 L0,50 Z`;
                return (
                  <>
                    <path d={areaPath} fill="url(#m-bk-grad)" />
                    <path d={linePath} fill="none" stroke="#fbbf24" strokeWidth="2" />
                  </>
                );
              })()}
            </svg>
            <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-white/15">
              <div>
                <div className="text-[9px] uppercase tracking-[0.1em] text-white/50 font-semibold">Taxa de acerto</div>
                <div className="text-[14px] font-semibold tabular mt-0.5">{stats.winRate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.1em] text-white/50 font-semibold">ROI</div>
                <div className="text-[14px] font-semibold tabular mt-0.5">{stats.roi.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.1em] text-white/50 font-semibold">Apostas</div>
                <div className="text-[14px] font-semibold tabular mt-0.5">{stats.totalBets}</div>
              </div>
            </div>
          </div>
            );
          })()}
        </div>

        {/* Mobile: TG banner + Dashboard CTA */}
        <div className="md:hidden mb-4 grid grid-cols-1 gap-3">
          <a
            href={telegramBotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-forest text-white rounded-lg p-4 flex items-center gap-3 hover:bg-forest-soft transition-colors"
          >
            <div className="w-10 h-10 rounded-md bg-white/10 border border-white/20 grid place-items-center text-amber-400 shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-amber-400">Betinho · Telegram</div>
              <div className="text-[13px] font-semibold mt-0.5 leading-tight">Cadastre apostas pelo bot</div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/50 shrink-0" />
          </a>
          <button
            type="button"
            onClick={() => navigate('/betting-dashboard')}
            className="bg-white border border-line rounded-lg p-4 flex items-center gap-3 text-left hover:border-forest/30 hover:bg-forest-tint/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-md bg-forest-tint border border-forest/20 grid place-items-center text-forest shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-2">Análise</div>
              <div className="text-[13px] font-semibold text-ink mt-0.5 leading-tight">Dashboard de KPIs</div>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-2 shrink-0" />
          </button>
        </div>

        {/* Mobile filter chips — Status quick filter + Período (rola horizontal) + botão Filtros (fixo) */}
        <div className="md:hidden mb-3 grid grid-cols-[1fr_auto] gap-2 items-center">
          <div
            className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
            style={{
              scrollbarWidth: 'none',
              maskImage: 'linear-gradient(to right, black calc(100% - 16px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 16px), transparent)',
            }}
          >
          {[
            { l: 'Todas', value: null },
            { l: 'Pendentes', value: 'pending' },
            { l: 'Ganhas', value: 'won' },
            { l: 'Perdidas', value: 'lost' },
          ].map((c) => {
            const active = c.value === null ? filters.status.length === 0 : filters.status.length === 1 && filters.status[0] === c.value;
            return (
              <button
                key={c.l}
                type="button"
                onClick={() => {
                  if (c.value === null) {
                    setFilters(prev => ({ ...prev, status: [] }));
                  } else {
                    setFilters(prev => ({ ...prev, status: [c.value] }));
                  }
                }}
                className={`shrink-0 h-9 px-3.5 text-[12px] font-medium rounded-full border transition-colors ${
                  active ? 'bg-ink text-white border-ink' : 'bg-white text-ink-2 border-line'
                }`}
              >
                {c.l}
              </button>
            );
          })}

          {/* Chip Período — abre popover com presets + calendário */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`shrink-0 h-9 px-3.5 text-[12px] font-medium rounded-full border inline-flex items-center gap-1.5 transition-colors ${
                  filters.dateFrom || filters.dateTo
                    ? 'bg-forest-tint text-forest border-forest/30'
                    : 'bg-white text-ink-2 border-line'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                {(() => {
                  const from = parseDateString(filters.dateFrom);
                  const to = parseDateString(filters.dateTo);
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
                ].map(p => (
                  <button
                    key={p.l}
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const from = new Date();
                      from.setDate(today.getDate() - p.days);
                      setFilters(prev => ({
                        ...prev,
                        dateFrom: formatDateToString(from),
                        dateTo: formatDateToString(today),
                      }));
                    }}
                    className="h-7 px-3 text-[11px] font-semibold border border-line text-ink-2 hover:bg-forest-tint hover:text-forest hover:border-forest/30 rounded-md transition-colors"
                  >
                    Últimos {p.l}
                  </button>
                ))}
              </div>
              <CalendarComponent
                mode="range"
                selected={{
                  from: parseDateString(filters.dateFrom) || undefined,
                  to: parseDateString(filters.dateTo) || undefined,
                }}
                onSelect={(range) => {
                  setFilters(prev => ({
                    ...prev,
                    dateFrom: formatDateToString(range?.from),
                    dateTo: formatDateToString(range?.to),
                  }));
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
              {/* Limpar — rodapé esquerdo, só aparece quando há range selecionado */}
              {(filters.dateFrom || filters.dateTo) && (
                <div className="px-3 py-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }))}
                    className="text-[11px] font-semibold text-ink-2 hover:text-status-danger transition-colors"
                  >
                    Limpar período
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          </div>
          {/* Botão Filtros — abre dialog com filtros completos (mesmo do desktop). Fora do scroller para nunca sumir. */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className={`shrink-0 h-9 px-3.5 text-[12px] font-semibold rounded-full border inline-flex items-center gap-1.5 transition-colors ${
                  advancedFiltersTotal > 0
                    ? 'bg-forest-tint text-forest border-forest/30'
                    : 'bg-white text-ink-2 border-line'
                }`}
                aria-label="Abrir filtros"
              >
                <Filter className="w-3.5 h-3.5" />
                Filtros
                {advancedFiltersTotal > 0 && (
                  <span className="px-1 text-[9px] font-bold bg-forest text-white rounded-full leading-tight">
                    {advancedFiltersTotal}
                  </span>
                )}
              </button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined} className="theme-rebrand bg-white border-line text-ink sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              {advancedFiltersContent}
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters Bar (desktop) */}
        <div className="hidden md:block bg-white border border-line rounded-lg p-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="flex items-center gap-2 px-2.5 h-9 bg-ink-3/40 border border-line rounded-md w-[200px]">
                <Search className="w-4 h-4 text-ink-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar aposta…"
                  className="bg-transparent text-[13px] text-ink placeholder:text-ink-2 flex-1 outline-none min-w-0"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                />
              </div>

              <MultiSelectFilter
                variant="rebrand"
                label="STATUS"
                placeholder="Todos"
                options={[
                  { value: 'pending', label: 'PENDENTE' },
                  { value: 'won', label: 'GANHOU' },
                  { value: 'lost', label: 'PERDEU' },
                  { value: 'half_won', label: '1/2 GREEN' },
                  { value: 'half_lost', label: '1/2 RED' },
                  { value: 'cashout', label: 'CASHOUT' },
                  { value: 'void', label: 'ANULADA' },
                ]}
                selected={filters.status}
                onChange={(values) => setFilters(prev => ({ ...prev, status: values }))}
              />

              <MultiSelectFilter
                variant="rebrand"
                label="ESPORTE"
                placeholder="Todos"
                options={[
                  ...uniqueSports.map(sport => ({
                    value: sport,
                    label: sport.toUpperCase()
                  })),
                  { value: '__empty__', label: 'SEM CLASSIFICAÇÃO' }
                ]}
                selected={filters.sport}
                onChange={(values) => setFilters(prev => ({ ...prev, sport: values }))}
              />

              <MultiSelectFilter
                variant="rebrand"
                label="LIGA"
                placeholder="Todas"
                options={[
                  ...uniqueLeagues.map(league => ({
                    value: league,
                    label: league.toUpperCase()
                  })),
                  { value: '__empty__', label: 'SEM CLASSIFICAÇÃO' }
                ]}
                selected={filters.league}
                onChange={(values) => setFilters(prev => ({ ...prev, league: values }))}
              />

              <MultiSelectFilter
                variant="rebrand"
                label="MERCADO"
                placeholder="Todos"
                options={[
                  ...uniqueBettingMarkets.map(market => ({
                    value: market,
                    label: market.toUpperCase()
                  })),
                  { value: '__empty__', label: 'SEM CLASSIFICAÇÃO' }
                ]}
                selected={filters.betting_market}
                onChange={(values) => setFilters(prev => ({ ...prev, betting_market: values }))}
              />

              {/* Date range — single button opens range calendar */}
              <Popover open={isFilterDateFromOpen} onOpenChange={setIsFilterDateFromOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-9 px-3 inline-flex items-center gap-2 text-[12px] text-ink-2 border border-line bg-white hover:bg-ink-3/40 rounded-md transition-colors font-medium"
                  >
                    <span className="font-semibold uppercase tracking-[0.08em] text-[10px] text-ink-2">PERÍODO</span>
                    {(() => {
                      const from = parseDateString(filters.dateFrom);
                      const to = parseDateString(filters.dateTo);
                      if (from && to) {
                        return (
                          <span className="text-ink font-medium tabular">
                            {format(from, 'dd MMM', { locale: ptBR })} – {format(to, 'dd MMM', { locale: ptBR })}
                          </span>
                        );
                      }
                      if (from) return <span className="text-ink font-medium tabular">Desde {format(from, 'dd MMM', { locale: ptBR })}</span>;
                      if (to) return <span className="text-ink font-medium tabular">Até {format(to, 'dd MMM', { locale: ptBR })}</span>;
                      return <span className="text-ink font-medium">Todo</span>;
                    })()}
                    <ChevronDown className="ml-auto w-3 h-3 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="theme-rebrand w-auto p-0 bg-white border border-line text-ink rounded-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]" align="start">
                  <div className="p-3 border-b border-line flex flex-wrap gap-1.5">
                    {[
                      { l: '7d', days: 7 },
                      { l: '30d', days: 30 },
                      { l: '90d', days: 90 },
                    ].map(p => (
                      <button
                        key={p.l}
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          const from = new Date();
                          from.setDate(today.getDate() - p.days);
                          setFilters(prev => ({
                            ...prev,
                            dateFrom: formatDateToString(from),
                            dateTo: formatDateToString(today),
                          }));
                          setIsFilterDateFromOpen(false);
                        }}
                        className="h-7 px-3 text-[11px] font-semibold border border-line text-ink-2 hover:bg-forest-tint hover:text-forest hover:border-forest/30 rounded-md transition-colors"
                      >
                        Últimos {p.l}
                      </button>
                    ))}
                  </div>
                  <CalendarComponent
                    mode="range"
                    selected={{
                      from: parseDateString(filters.dateFrom) || undefined,
                      to: parseDateString(filters.dateTo) || undefined,
                    }}
                    onSelect={(range) => {
                      setFilters(prev => ({
                        ...prev,
                        dateFrom: formatDateToString(range?.from),
                        dateTo: formatDateToString(range?.to),
                      }));
                      if (range?.from && range?.to) {
                        setIsFilterDateFromOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                    initialFocus
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
                  {(filters.dateFrom || filters.dateTo) && (
                    <div className="px-3 py-2 border-t border-line">
                      <button
                        type="button"
                        onClick={() => {
                          setFilters(prev => ({ ...prev, dateFrom: '', dateTo: '' }));
                          setIsFilterDateFromOpen(false);
                        }}
                        className="text-[11px] font-semibold text-ink-2 hover:text-status-danger transition-colors"
                      >
                        Limpar período
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Mais filtros — dialog centralizado com TODOS os filtros */}
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className={`h-9 px-3 inline-flex items-center gap-2 text-[12px] font-semibold border rounded-md transition-colors ${
                      advancedFiltersTotal > 0
                        ? 'text-forest border-forest/30 bg-forest-tint hover:bg-forest-tint/80'
                        : 'text-ink-2 border-line bg-white hover:bg-ink-3/40 hover:text-ink'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Mais filtros</span>
                    {advancedFiltersTotal > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-forest text-white rounded-full">
                        {advancedFiltersTotal}
                      </span>
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent aria-describedby={undefined} className="theme-rebrand bg-white border-line text-ink sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  {advancedFiltersContent}
                </DialogContent>
              </Dialog>

              <button
                type="button"
                onClick={clearAllFilters}
                className="h-9 px-3 text-[12px] flex items-center justify-center gap-1.5 text-ink-2 hover:bg-status-danger/10 hover:text-status-danger transition-colors rounded-md whitespace-nowrap font-medium"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>Limpar filtros</span>
              </button>
          </div>
        </div>

        {/* Bets Table — wrapper card só no desktop. Mobile cards ficam standalone na canvas */}
        <div className="md:bg-white md:border md:border-line md:rounded-lg md:overflow-hidden">
          <div className="flex justify-between items-center px-1 md:px-5 py-3 md:border-b md:border-line">
            <div className="flex items-baseline gap-3">
              <h3 className="text-[11px] md:text-[13px] uppercase md:normal-case tracking-[0.12em] md:tracking-normal font-semibold text-ink-2 md:text-ink">Apostas</h3>
              <span className="text-[11px] text-ink-2 tabular">
                Mostrando {paginatedBets.length} de {sortedBets.length}
                {sortedBets.length !== bets.length && ` · ${bets.length} total`}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchBets}
              className="h-8 w-8 inline-flex items-center justify-center text-ink-2 hover:text-ink hover:bg-ink-3/40 rounded-md transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-ink-3" />
              ))}
            </div>
          ) : filteredBets.length === 0 ? (
            <div className="text-center py-12 text-ink-2">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-[12px] uppercase tracking-[0.14em] font-semibold">Nenhuma aposta encontrada</p>
              <p className="text-[11px] mt-1">Tente ajustar os filtros</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[12px] min-w-[960px] table-auto">
                  <thead className="bg-ink-3/40">
                    <tr>
                      <th className="py-2.5 px-1.5 w-8 text-left">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          ref={el => { if (el) el.indeterminate = isPageIndeterminate; }}
                          onChange={toggleSelectAllPage}
                          className="w-3.5 h-3.5 accent-forest cursor-pointer"
                        />
                      </th>
                      <SortableHeader column="bet_date" label="DATA" />
                      <th className="text-left py-2.5 px-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-2 font-semibold">DESCRIÇÃO</th>
                      <th className="text-left py-2.5 px-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-2 font-semibold">TAGS</th>
                      <SortableHeader column="sport" label="ESPORTE / LIGA" />
                      <SortableHeader column="betting_market" label="MERCADO" />
                      <SortableHeader column="stake_amount" label="STAKE" align="right" />
                      <SortableHeader column="odds" label="ODDS" align="right" />
                      <SortableHeader column="return" label="RETORNO" align="right" className="min-w-[5.5rem]" />
                      <SortableHeader column="profit" label="LUCRO" align="right" className="min-w-[5.5rem]" />
                      <SortableHeader column="status" label="STATUS" align="center" className="min-w-[5rem]" />
                      <th className="text-right py-2.5 px-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-2 font-semibold min-w-[11rem]">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desktopRows}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked View */}
              <div className="md:hidden space-y-4">
                {mobileCards}
              </div>

              {/* Pagination footer */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-line text-[12px]">
                <div className="text-[11px] text-ink-2 tabular">
                  Página {currentPage} de {totalPages}
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
            </>
          )}
        </div>

        {/* Secondary stats — abaixo da tabela */}
        {!isLoading && filteredBets.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <div className="bg-white border border-line rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Stake médio</div>
                <div className="text-[10px] text-ink-2 mt-1 truncate">por aposta</div>
              </div>
              <div className="text-[15px] tabular font-semibold text-ink shrink-0 ml-2">{formatValue(secondaryStats.avgStake)}</div>
            </div>
            <div className="bg-white border border-line rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Odd média</div>
                <div className="text-[10px] text-ink-2 mt-1 truncate tabular">prob. implícita {secondaryStats.avgOdds > 0 ? (100 / secondaryStats.avgOdds).toFixed(0) : '0'}%</div>
              </div>
              <div className="text-[15px] tabular font-semibold text-forest shrink-0 ml-2">{secondaryStats.avgOdds.toFixed(2)}</div>
            </div>
            <div className="bg-white border border-line rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Maior vitória</div>
                <div className="text-[10px] text-ink-2 mt-1 truncate">
                  {secondaryStats.biggestWin
                    ? `${truncateDescription(secondaryStats.biggestWin.description, 28)} · ${secondaryStats.biggestWin.date}`
                    : '—'}
                </div>
              </div>
              <div className="text-[15px] tabular font-semibold text-status-success shrink-0 ml-2">
                {secondaryStats.biggestWin ? `+${formatValue(secondaryStats.biggestWin.profit)}` : '—'}
              </div>
            </div>
            <div className="bg-white border border-line rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase">Maior derrota</div>
                <div className="text-[10px] text-ink-2 mt-1 truncate">
                  {secondaryStats.biggestLoss
                    ? `${truncateDescription(secondaryStats.biggestLoss.description, 28)} · ${secondaryStats.biggestLoss.date}`
                    : '—'}
                </div>
              </div>
              <div className="text-[15px] tabular font-semibold text-status-danger shrink-0 ml-2">
                {secondaryStats.biggestLoss ? formatValue(secondaryStats.biggestLoss.profit) : '—'}
              </div>
            </div>
          </div>
        )}
        </>
      </main>

      {/* Mobile FAB — Nova aposta */}
      {selectedBetIds.size === 0 && (
        <button
          type="button"
          onClick={() => {
            if (isBetinhoFree && (dailyBetCount ?? 0) >= DAILY_BET_LIMIT) {
              navigate('/paywall');
              return;
            }
            setIsCreateModalOpen(true);
          }}
          className="md:hidden theme-rebrand fixed right-5 bottom-6 z-40 w-14 h-14 rounded-full bg-forest text-white grid place-items-center shadow-[0_10px_30px_-5px_rgba(10,61,46,0.5)] hover:bg-forest-soft transition-colors"
          aria-label="Nova aposta"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Bulk Action Bar - fixed at bottom like ClickUp */}
      {selectedBetIds.size > 0 && (
        <div className="theme-rebrand fixed bottom-0 left-0 right-0 z-50 flex justify-center px-3 pb-3 pointer-events-none">
          <div className="max-w-7xl w-full flex items-center gap-2 px-4 py-3 bg-white border border-line rounded-lg shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.15)] pointer-events-auto">
            <div className="flex items-center gap-1.5 border border-forest/20 bg-forest-tint rounded-md px-2 py-1">
              <span className="text-[12px] text-forest font-semibold whitespace-nowrap">
                {selectedBetIds.size} Aposta{selectedBetIds.size !== 1 ? 's' : ''} selecionada{selectedBetIds.size !== 1 ? 's' : ''}
              </span>
              <button type="button" onClick={clearSelection}
                className="text-sm text-ink-2 hover:text-ink transition-colors leading-none ml-1">
                ×
              </button>
            </div>
            <div className="flex-1" />

            {/* Mobile: single "Ações" button opening a bottom sheet */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <button type="button"
                    className="h-9 px-4 text-[12px] font-semibold border border-forest/30 text-forest bg-white hover:bg-forest-tint rounded-md transition-colors flex items-center gap-1.5">
                    <ChevronUp className="w-3.5 h-3.5" /> Ações
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="theme-rebrand bg-white border-t border-line px-4 pb-8 pt-4 rounded-t-xl">
                  <p className="text-[11px] text-ink-2 mb-3 pr-8 uppercase tracking-[0.1em] font-semibold">
                    {selectedBetIds.size} Aposta{selectedBetIds.size !== 1 ? 's' : ''} selecionada{selectedBetIds.size !== 1 ? 's' : ''}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => bulkUpdateStatus('won')}
                      className="h-11 text-[12px] font-semibold border border-status-success/30 text-status-success bg-white hover:bg-status-success/10 rounded-md transition-colors flex items-center justify-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Ganhou
                    </button>
                    <button type="button" onClick={() => bulkUpdateStatus('lost')}
                      className="h-11 text-[12px] font-semibold border border-status-danger/30 text-status-danger bg-white hover:bg-status-danger/10 rounded-md transition-colors flex items-center justify-center gap-2">
                      <TrendingDown className="w-4 h-4" /> Perdeu
                    </button>
                    <button type="button" onClick={() => bulkUpdateStatus('half_won')}
                      className="h-11 text-[12px] font-semibold border border-status-success/20 text-status-success/80 bg-white hover:bg-status-success/10 rounded-md transition-colors flex items-center justify-center gap-2">
                      <TrendingUp className="w-4 h-4 opacity-70" /> ½ Green
                    </button>
                    <button type="button" onClick={() => bulkUpdateStatus('half_lost')}
                      className="h-11 text-[12px] font-semibold border border-status-danger/20 text-status-danger/80 bg-white hover:bg-status-danger/10 rounded-md transition-colors flex items-center justify-center gap-2">
                      <TrendingDown className="w-4 h-4 opacity-70" /> ½ Red
                    </button>
                    <button type="button" onClick={() => bulkUpdateStatus('void')}
                      className="h-11 text-[12px] font-semibold border border-line text-ink-2 bg-white hover:bg-ink-3/40 rounded-md transition-colors flex items-center justify-center gap-2">
                      <X className="w-4 h-4" /> Anulada
                    </button>
                    <button type="button" onClick={bulkDelete}
                      className="h-11 text-[12px] font-semibold border border-status-danger/30 text-status-danger bg-white hover:bg-status-danger/10 rounded-md transition-colors flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                  </div>
                  {userTags.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] text-ink-2 mb-2 uppercase tracking-[0.1em] font-semibold">Adicionar tag</p>
                      <div className="flex flex-wrap gap-2">
                        {userTags.map(tag => (
                          <button key={tag.id} type="button"
                            onClick={() => bulkAddTag(tag)}
                            className="h-8 px-3 text-[11px] border border-line bg-white text-ink hover:bg-ink-3/40 rounded-md transition-colors flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop: inline buttons */}
            <div className="hidden md:flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button"
                    className="h-8 px-3 text-[11px] font-semibold border border-line text-ink-2 bg-white hover:bg-ink-3/40 hover:text-ink rounded-md transition-colors flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> TAG
                  </button>
                </PopoverTrigger>
                <PopoverContent className="theme-rebrand w-48 p-1 bg-white border-line text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]" align="start" side="top">
                  {userTags.length === 0 ? (
                    <p className="text-[11px] text-ink-2 p-2">Nenhuma tag criada</p>
                  ) : (
                    userTags.map(tag => (
                      <button key={tag.id} type="button"
                        onClick={() => bulkAddTag(tag)}
                        className="w-full text-left px-2 py-1.5 text-[11px] text-ink hover:bg-ink-3/40 rounded flex items-center gap-2 transition-colors">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </button>
                    ))
                  )}
                </PopoverContent>
              </Popover>
              <button type="button" onClick={() => bulkUpdateStatus('won')}
                className="h-8 px-3 text-[11px] font-semibold border border-status-success/30 text-status-success bg-white hover:bg-status-success/10 rounded-md transition-colors flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Ganhou
              </button>
              <button type="button" onClick={() => bulkUpdateStatus('lost')}
                className="h-8 px-3 text-[11px] font-semibold border border-status-danger/30 text-status-danger bg-white hover:bg-status-danger/10 rounded-md transition-colors flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> Perdeu
              </button>
              <button type="button" onClick={() => bulkUpdateStatus('half_won')}
                className="h-8 px-3 text-[11px] font-semibold border border-status-success/20 text-status-success/80 bg-white hover:bg-status-success/10 rounded-md transition-colors flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 opacity-70" /> ½ Green
              </button>
              <button type="button" onClick={() => bulkUpdateStatus('half_lost')}
                className="h-8 px-3 text-[11px] font-semibold border border-status-danger/20 text-status-danger/80 bg-white hover:bg-status-danger/10 rounded-md transition-colors flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 opacity-70" /> ½ Red
              </button>
              <button type="button" onClick={() => bulkUpdateStatus('void')}
                className="h-8 px-3 text-[11px] font-semibold border border-line text-ink-2 bg-white hover:bg-ink-3/40 hover:text-ink rounded-md transition-colors flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" /> Anulada
              </button>
              <button type="button" onClick={bulkDelete}
                className="h-8 px-3 text-[11px] font-semibold border border-status-danger/30 text-status-danger bg-white hover:bg-status-danger/10 rounded-md transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Cashout Modal */}
      <Dialog open={cashoutModal.isOpen} onOpenChange={(open) =>
        setCashoutModal(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="theme-rebrand bg-white border-line text-ink sm:max-w-md">
          <DialogHeader>
            <div className="text-[11px] uppercase tracking-[0.16em] text-forest font-semibold">Cashout</div>
            <DialogTitle className="text-[18px] font-semibold tracking-tight text-ink">
              {cashoutModal.bet?.is_cashout ? 'Editar cashout' : 'Encerrar antes do fim'}
            </DialogTitle>
            <DialogDescription className="text-ink-2 text-[13px]">
              {cashoutModal.bet?.is_cashout
                ? 'Atualize o valor do cashout para esta aposta.'
                : 'Insira o valor do cashout para esta aposta.'
              }
            </DialogDescription>
          </DialogHeader>

          {cashoutModal.bet && (() => {
            const bet = cashoutModal.bet;
            const cashoutValue = parseFloat(cashoutModal.cashoutAmount) || 0;
            const guaranteedProfit = cashoutValue - bet.stake_amount;
            const potentialIfWin = bet.potential_return - cashoutValue;
            return (
            <div className="space-y-4">
              <div className="bg-canvas border border-line rounded-lg p-4">
                <div className="text-[11px] text-ink-2">Aposta</div>
                <p className="text-[14px] font-semibold text-ink mt-0.5">{bet.bet_description}</p>
                {bet.match_description && (
                  <p className="text-[11px] text-ink-2 mt-0.5">{bet.match_description}</p>
                )}
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-line">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Stake</div>
                    <div className="text-[13px] tabular text-ink mt-0.5">{formatValue(bet.stake_amount)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Odd</div>
                    <div className="text-[13px] tabular text-forest font-semibold mt-0.5">{bet.odds}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Retorno se ganhar</div>
                    <div className="text-[13px] tabular text-ink mt-0.5">{formatValue(bet.potential_return)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Valor do cashout</Label>
                <div className="flex items-center h-12 bg-white border-2 border-forest/30 focus-within:border-forest rounded-md">
                  <span className="pl-4 text-[14px] text-ink-2 font-medium">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={cashoutModal.cashoutAmount}
                    onChange={(e) => setCashoutModal(prev => ({ ...prev, cashoutAmount: e.target.value }))}
                    placeholder="0,00"
                    className="flex-1 bg-transparent px-3 text-[20px] font-semibold tabular text-ink outline-none"
                  />
                </div>
              </div>

              {/* Resumo de lucro garantido vs potencial — só aparece quando há valor digitado */}
              {cashoutValue > 0 && (
                <div className={`p-3 rounded-md border flex items-start gap-2 text-[12px] ${
                  guaranteedProfit >= 0
                    ? 'bg-status-success/10 border-status-success/20 text-status-success'
                    : 'bg-status-danger/10 border-status-danger/20 text-status-danger'
                }`}>
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">
                    {guaranteedProfit >= 0
                      ? <>Lucro garantido de <span className="font-semibold tabular">+{formatValue(guaranteedProfit)}</span>.</>
                      : <>Prejuízo limitado a <span className="font-semibold tabular">{formatValue(guaranteedProfit)}</span>.</>
                    }{' '}Você abre mão de potencial <span className="font-semibold tabular">{formatValue(potentialIfWin)}</span> se acertar.
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2 justify-end">
                <Button
                  onClick={() => setCashoutModal({ isOpen: false, bet: null, cashoutAmount: '', cashoutOdds: '' })}
                  variant="ghost"
                  className="h-10 px-4 text-[13px] font-medium text-ink-2 hover:bg-ink-3/40 hover:text-ink"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={processCashout}
                  disabled={!cashoutModal.cashoutAmount}
                  className="h-10 px-5 text-[13px] font-semibold bg-forest hover:bg-forest-soft text-white"
                >
                  Confirmar cashout
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Capital Movement Modal (Aporte/Resgate) */}
      <Dialog open={capitalModal.isOpen} onOpenChange={(open) => setCapitalModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent aria-describedby={undefined} className="theme-rebrand bg-white border-line text-ink sm:max-w-md">
          <DialogHeader>
            <div className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${capitalModal.type === 'deposit' ? 'text-status-success' : 'text-status-danger'}`}>
              {capitalModal.type === 'deposit' ? 'Aporte' : 'Resgate'}
            </div>
            <DialogTitle className="text-[18px] font-semibold tracking-tight text-ink">
              {capitalModal.type === 'deposit' ? 'Adicionar à banca' : 'Retirar da banca'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Valor</Label>
              <Input
                type="number"
                value={capitalModal.amount}
                onChange={(e) => setCapitalModal(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="h-10 bg-canvas border-line text-ink tabular"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Descrição (opcional)</Label>
              <Input
                value={capitalModal.description}
                onChange={(e) => setCapitalModal(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Ex: Depósito via PIX"
                className="h-10 bg-canvas border-line text-ink"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => setCapitalModal(prev => ({ ...prev, isOpen: false }))}
                variant="outline"
                className="flex-1 h-10 border-line bg-white hover:bg-ink-3/40 text-ink-2 hover:text-ink"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  const amount = parseFloat(capitalModal.amount);
                  if (isNaN(amount) || amount <= 0) return;
                  await addMovement({
                    type: capitalModal.type,
                    amount,
                    description: capitalModal.description || undefined,
                    affects_balance: true,
                  });
                  setCapitalModal({ isOpen: false, type: 'deposit', amount: '', description: '' });
                  toast({ title: 'Sucesso', description: capitalModal.type === 'deposit' ? 'Aporte registrado' : 'Resgate registrado' });
                }}
                disabled={!capitalModal.amount || parseFloat(capitalModal.amount) <= 0}
                className="flex-1 h-10 bg-forest hover:bg-forest-soft text-white font-semibold"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModal.isOpen} onOpenChange={(open) => 
        {
          setEditModal(prev => ({ ...prev, isOpen: open }));
          if (!open) {
            setIsEditDatePopoverOpen(false);
            setIsSportDropdownOpen(false);
            setIsSportQueryTouched(false);
            setSportHighlightIndex(-1);
            setIsLeagueDropdownOpen(false);
            setIsLeagueQueryTouched(false);
            setLeagueHighlightIndex(-1);
            setIsBettingMarketDropdownOpen(false);
            setIsBettingMarketQueryTouched(false);
            setBettingMarketHighlightIndex(-1);
            sportItemRefs.current = [];
            leagueItemRefs.current = [];
            bettingMarketItemRefs.current = [];
          }
        }
      }>
        <DialogContent aria-describedby={undefined} className="theme-rebrand bg-white border-line text-ink sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)]">
          <DialogHeader>
            <div className="text-[11px] uppercase tracking-[0.16em] text-forest font-semibold">Aposta</div>
            <DialogTitle className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-ink">
              <Edit className="w-4 h-4 text-forest" />
              Editar aposta
            </DialogTitle>
          </DialogHeader>

          {editModal.bet && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Descrição</Label>
                <Input
                  value={editModal.formData.bet_description}
                  onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, bet_description: e.target.value } }))}
                  className="h-10 bg-canvas border-line text-ink rounded-md focus:border-forest focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Esporte</Label>
                  <div className="relative">
                    <Input
                      value={editModal.formData.sport}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditModal(prev => ({ ...prev, formData: { ...prev.formData, sport: value } }));
                        setIsSportQueryTouched(true);
                        setIsSportDropdownOpen(true);
                        setSportHighlightIndex(0);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab') {
                          setIsSportDropdownOpen(false);
                          setIsSportQueryTouched(false);
                          setSportHighlightIndex(-1);
                          return;
                        }

                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          if (!isSportDropdownOpen) {
                            setIsSportDropdownOpen(true);
                            setIsSportQueryTouched(true);
                          }
                          setSportHighlightIndex((prev) => {
                            if (filteredSportsList.length === 0) return -1;
                            const next = prev < filteredSportsList.length - 1 ? prev + 1 : 0;
                            return next;
                          });
                          return;
                        }

                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          if (!isSportDropdownOpen) {
                            setIsSportDropdownOpen(true);
                            setIsSportQueryTouched(true);
                          }
                          setSportHighlightIndex((prev) => {
                            if (filteredSportsList.length === 0) return -1;
                            const next = prev > 0 ? prev - 1 : filteredSportsList.length - 1;
                            return next;
                          });
                          return;
                        }

                        if (event.key === 'Enter') {
                          if (sportHighlightIndex >= 0 && filteredSportsList[sportHighlightIndex]) {
                            event.preventDefault();
                            const selectedSport = filteredSportsList[sportHighlightIndex];
                            setEditModal(prev => ({ ...prev, formData: { ...prev.formData, sport: selectedSport } }));
                            setIsSportDropdownOpen(false);
                            setIsSportQueryTouched(false);
                            setSportHighlightIndex(-1);
                          }
                          return;
                        }

                        if (event.key === 'Escape') {
                          setIsSportDropdownOpen(false);
                          setSportHighlightIndex(-1);
                        }
                      }}
                      onFocus={() => {
                        setIsSportDropdownOpen(true);
                        setIsSportQueryTouched(false);
                      }}
                      onBlur={() => setIsSportDropdownOpen(false)}
                      placeholder="Selecione ou digite o esporte"
                      className="h-10 bg-canvas border-line text-ink rounded-md focus:border-forest focus:bg-white"
                    />
                    {isSportDropdownOpen && (
                      <div className="theme-rebrand absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-line bg-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                        {filteredSportsList.length > 0 ? (
                          filteredSportsList.map((sport, index) => (
                            <button
                              key={sport}
                              type="button"
                              tabIndex={-1}
                              ref={(element) => {
                                sportItemRefs.current[index] = element;
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setEditModal(prev => ({ ...prev, formData: { ...prev.formData, sport } }));
                                setIsSportDropdownOpen(false);
                                setIsSportQueryTouched(false);
                                setSportHighlightIndex(-1);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm text-ink hover:bg-ink-3/40 ${
                                index === sportHighlightIndex ? 'bg-ink-3/40' : ''
                              }`}
                            >
                              {sport}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-ink-2">
                            Nenhum esporte encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Liga</Label>
                  <div className="relative">
                    <Input
                      value={editModal.formData.league}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditModal(prev => ({ ...prev, formData: { ...prev.formData, league: value } }));
                        setIsLeagueQueryTouched(true);
                        setIsLeagueDropdownOpen(true);
                        setLeagueHighlightIndex(0);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab') {
                          setIsLeagueDropdownOpen(false);
                          setIsLeagueQueryTouched(false);
                          setLeagueHighlightIndex(-1);
                          return;
                        }

                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          if (!isLeagueDropdownOpen) {
                            setIsLeagueDropdownOpen(true);
                            setIsLeagueQueryTouched(true);
                          }
                          setLeagueHighlightIndex((prev) => {
                            if (filteredLeaguesList.length === 0) return -1;
                            const next = prev < filteredLeaguesList.length - 1 ? prev + 1 : 0;
                            return next;
                          });
                          return;
                        }

                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          if (!isLeagueDropdownOpen) {
                            setIsLeagueDropdownOpen(true);
                            setIsLeagueQueryTouched(true);
                          }
                          setLeagueHighlightIndex((prev) => {
                            if (filteredLeaguesList.length === 0) return -1;
                            const next = prev > 0 ? prev - 1 : filteredLeaguesList.length - 1;
                            return next;
                          });
                          return;
                        }

                        if (event.key === 'Enter') {
                          if (leagueHighlightIndex >= 0 && filteredLeaguesList[leagueHighlightIndex]) {
                            event.preventDefault();
                            const selectedLeague = filteredLeaguesList[leagueHighlightIndex];
                            setEditModal(prev => ({ ...prev, formData: { ...prev.formData, league: selectedLeague } }));
                            setIsLeagueDropdownOpen(false);
                            setIsLeagueQueryTouched(false);
                            setLeagueHighlightIndex(-1);
                          }
                          return;
                        }

                        if (event.key === 'Escape') {
                          setIsLeagueDropdownOpen(false);
                          setLeagueHighlightIndex(-1);
                        }
                      }}
                      onFocus={() => {
                        setIsLeagueDropdownOpen(true);
                        setIsLeagueQueryTouched(false);
                      }}
                      onBlur={() => setIsLeagueDropdownOpen(false)}
                      placeholder="Selecione ou digite a liga"
                      className="h-10 bg-canvas border-line text-ink rounded-md focus:border-forest focus:bg-white"
                    />
                    {isLeagueDropdownOpen && (
                      <div className="theme-rebrand absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-line bg-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                        {filteredLeaguesList.length > 0 ? (
                          filteredLeaguesList.map((league, index) => (
                            <button
                              key={league}
                              type="button"
                              tabIndex={-1}
                              ref={(element) => {
                                leagueItemRefs.current[index] = element;
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setEditModal(prev => ({ ...prev, formData: { ...prev.formData, league } }));
                                setIsLeagueDropdownOpen(false);
                                setIsLeagueQueryTouched(false);
                                setLeagueHighlightIndex(-1);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm text-ink hover:bg-ink-3/40 ${
                                index === leagueHighlightIndex ? 'bg-ink-3/40' : ''
                              }`}
                            >
                              {league}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-ink-2">
                            Nenhuma liga encontrada
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Mercado</Label>
                  <div className="relative">
                    <Input
                      value={editModal.formData.betting_market}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditModal(prev => ({ ...prev, formData: { ...prev.formData, betting_market: value } }));
                        setIsBettingMarketQueryTouched(true);
                        setIsBettingMarketDropdownOpen(true);
                        setBettingMarketHighlightIndex(0);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab') {
                          setIsBettingMarketDropdownOpen(false);
                          setIsBettingMarketQueryTouched(false);
                          setBettingMarketHighlightIndex(-1);
                          return;
                        }
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          if (!isBettingMarketDropdownOpen) {
                            setIsBettingMarketDropdownOpen(true);
                            setIsBettingMarketQueryTouched(true);
                          }
                          setBettingMarketHighlightIndex((prev) => {
                            if (filteredBettingMarketsList.length === 0) return -1;
                            const next = prev < filteredBettingMarketsList.length - 1 ? prev + 1 : 0;
                            return next;
                          });
                          return;
                        }
                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          if (!isBettingMarketDropdownOpen) {
                            setIsBettingMarketDropdownOpen(true);
                            setIsBettingMarketQueryTouched(true);
                          }
                          setBettingMarketHighlightIndex((prev) => {
                            if (filteredBettingMarketsList.length === 0) return -1;
                            const next = prev > 0 ? prev - 1 : filteredBettingMarketsList.length - 1;
                            return next;
                          });
                          return;
                        }
                        if (event.key === 'Enter') {
                          if (bettingMarketHighlightIndex >= 0 && filteredBettingMarketsList[bettingMarketHighlightIndex]) {
                            event.preventDefault();
                            const selectedMarket = filteredBettingMarketsList[bettingMarketHighlightIndex];
                            setEditModal(prev => ({ ...prev, formData: { ...prev.formData, betting_market: selectedMarket } }));
                            setIsBettingMarketDropdownOpen(false);
                            setIsBettingMarketQueryTouched(false);
                            setBettingMarketHighlightIndex(-1);
                          }
                          return;
                        }
                        if (event.key === 'Escape') {
                          setIsBettingMarketDropdownOpen(false);
                          setBettingMarketHighlightIndex(-1);
                        }
                      }}
                      onFocus={() => {
                        setIsBettingMarketDropdownOpen(true);
                        setIsBettingMarketQueryTouched(false);
                      }}
                      onBlur={() => setIsBettingMarketDropdownOpen(false)}
                      placeholder="Selecione ou digite o mercado"
                      className="h-10 bg-canvas border-line text-ink rounded-md focus:border-forest focus:bg-white"
                    />
                    {isBettingMarketDropdownOpen && (
                      <div className="theme-rebrand absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-line bg-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                        {filteredBettingMarketsList.length > 0 ? (
                          filteredBettingMarketsList.map((market, index) => (
                            <button
                              key={market}
                              type="button"
                              tabIndex={-1}
                              ref={(element) => {
                                bettingMarketItemRefs.current[index] = element;
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setEditModal(prev => ({ ...prev, formData: { ...prev.formData, betting_market: market } }));
                                setIsBettingMarketDropdownOpen(false);
                                setIsBettingMarketQueryTouched(false);
                                setBettingMarketHighlightIndex(-1);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm text-ink hover:bg-ink-3/40 ${
                                index === bettingMarketHighlightIndex ? 'bg-ink-3/40' : ''
                              }`}
                            >
                              {market}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-ink-2">
                            Nenhum mercado encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Valor</Label>
                  <Input
                    type="number"
                    value={editModal.formData.stake_amount}
                    onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, stake_amount: e.target.value } }))}
                    className="h-10 bg-canvas border-line text-ink rounded-md focus:border-forest focus:bg-white tabular"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Odds</Label>
                  <Input
                    type="number"
                    value={editModal.formData.odds}
                    onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, odds: e.target.value } }))}
                    className="h-10 bg-canvas border-line text-ink rounded-md focus:border-forest focus:bg-white tabular"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Crédito de apostas</Label>
                <button
                  type="button"
                  onClick={() => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, is_credit_bet: !prev.formData.is_credit_bet } }))}
                  style={{ backgroundColor: editModal.formData.is_credit_bet ? 'var(--forest)' : '#d1d5db' }}
                  className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                >
                  <span style={{ transform: editModal.formData.is_credit_bet ? 'translateX(22px)' : 'translateX(2px)' }} className="absolute top-0.5 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform" />
                </button>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Data da Aposta</Label>
                <Popover open={isEditDatePopoverOpen} onOpenChange={setIsEditDatePopoverOpen} modal>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-10 bg-canvas border-line text-ink rounded-md hover:bg-ink-3/40 hover:text-ink"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-forest" />
                      {(() => {
                        const date = parseDateString(editModal.formData.bet_date);
                        return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data';
                      })()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="theme-rebrand w-auto p-0 bg-white border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                    <CalendarComponent
                      mode="single"
                      selected={parseDateString(editModal.formData.bet_date) || undefined}
                      onSelect={(date) => {
                        setEditModal(prev => ({
                          ...prev,
                          formData: {
                            ...prev.formData,
                            bet_date: formatDateToString(date)
                          }
                        }));
                        setIsEditDatePopoverOpen(false);
                      }}
                      initialFocus
                      className="bg-white"
                      classNames={{
                        caption_label: 'text-sm font-semibold text-ink',
                        nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-ink-3/40 hover:text-ink rounded-md inline-flex items-center justify-center',
                        head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                        day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-ink-3/40 rounded-md aria-selected:opacity-100',
                        day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                        day_today: 'bg-ink-3 text-ink font-semibold',
                        day_outside: 'text-ink-2 opacity-40',
                        day_disabled: 'text-ink-2 opacity-30',
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Status</Label>
                <Select
                  value={editModal.formData.status}
                  onValueChange={(value: any) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, status: value } }))}
                >
                  <SelectTrigger className="h-10 bg-canvas border-line text-ink rounded-md focus:border-forest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="theme-rebrand bg-white border-line text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="won">Ganhou</SelectItem>
                    <SelectItem value="lost">Perdeu</SelectItem>
                    <SelectItem value="half_won">1/2 Green</SelectItem>
                    <SelectItem value="half_lost">1/2 Red</SelectItem>
                    <SelectItem value="void">Anulada</SelectItem>
                    <SelectItem value="cashout">Cashout</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  variant="outline"
                  className="flex-1 h-10 border-line bg-white hover:bg-ink-3/40 text-ink-2 hover:text-ink"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={updateBetData}
                  className="flex-1 h-10 bg-forest hover:bg-forest-soft text-white font-semibold"
                >
                  Salvar alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateBetModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreate={createBet}
        sportsList={SPORTS_LIST}
        leaguesList={LEAGUES_LIST}
        bettingMarketsList={BETTING_MARKETS_LIST}
        userTags={userTags}
        onTagsUpdated={fetchUserTags}
      />

      <ShareLinkModal
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        filters={filters}
        userTags={userTags}
      />

      <UnitConfigurationModal 
        open={unitConfigOpen} 
        onOpenChange={(open) => {
          setUnitConfigOpen(open);
          if (!open) refetchConfig();
        }} 
      />

      {user?.id && (
        <ReferralModal
          open={referralModalOpen}
          onOpenChange={setReferralModalOpen}
          userId={user.id}
          referralCode={referralCode}
        />
      )}

      {/* Confirmação de exclusão (single ou bulk) — substitui o window.confirm nativo */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
      >
        <AlertDialogContent className="theme-rebrand bg-white border-line text-ink sm:max-w-md">
          <AlertDialogHeader>
            <div className="text-[11px] uppercase tracking-[0.16em] text-status-danger font-semibold">Excluir aposta{confirmDelete?.type === 'bulk' && confirmDelete.count > 1 ? 's' : ''}</div>
            <AlertDialogTitle className="text-[18px] font-semibold tracking-tight text-ink">
              {confirmDelete?.type === 'bulk'
                ? `Excluir ${confirmDelete.count} aposta${confirmDelete.count !== 1 ? 's' : ''}?`
                : 'Excluir esta aposta?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ink-2 text-[13px]">
              Essa ação não pode ser desfeita. {confirmDelete?.type === 'bulk' ? 'As apostas serão removidas permanentemente.' : 'A aposta será removida permanentemente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="h-10 px-4 text-[13px] font-medium text-ink-2 hover:text-ink border-line bg-white hover:bg-ink-3/40">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete?.type === 'single') {
                  performDeleteBet(confirmDelete.betId);
                } else if (confirmDelete?.type === 'bulk') {
                  performBulkDelete();
                }
                setConfirmDelete(null);
              }}
              className="h-10 px-4 text-[13px] font-semibold text-white bg-status-danger hover:bg-status-danger/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
