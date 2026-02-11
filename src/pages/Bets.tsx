import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/use-auth';
import { createClient } from '../integrations/supabase/client';
import { BetsHeader } from '../components/bets/BetsHeader';
import { BetStatsCard } from '../components/bets/BetStatsCard';
import { TagSelector } from '../components/bets/TagSelector';
import { UnitConfigurationModal } from '../components/UnitConfigurationModal';
import { BankrollEvolutionChart } from '@/components/bets/BankrollEvolutionChart';
import { CreateBetModal, CreateBetFormData } from '@/components/bets/CreateBetModal';
import { ReferralModal } from '../components/ReferralModal';
import { useUserUnit } from '@/hooks/use-user-unit';
import { useBetinhoPremium } from '@/hooks/use-betinho-premium';
import { useNavigate } from 'react-router-dom';
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
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Plus,
  BarChart3
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
  updateBetStatus: (betId: string, newStatus: string) => void;
  openCashoutModal: (bet: Bet) => void;
  openEditModal: (bet: Bet) => void;
  deleteBet: (betId: string) => void;
};

const BetRow = React.memo(function BetRow({
  bet,
  formatValue,
  formatBetDate,
  translateStatus,
  onBetTagsChange,
  onTagsUpdated,
  updateBetStatus,
  openCashoutModal,
  openEditModal,
  deleteBet,
}: BetRowProps) {
  const handleTagsChange = useCallback((newTags: Tag[]) => {
    onBetTagsChange(bet.id, newTags, (bet.tags || []).map(t => t.id));
  }, [bet.id, bet.tags, onBetTagsChange]);

  return (
    <tr className="border-b border-terminal-border-subtle hover:bg-terminal-light-gray transition-colors">
      <td className="py-1.5 px-1.5 opacity-70">
        {formatBetDate(bet.bet_date)}
      </td>
      <td className="py-1.5 px-1.5 font-medium min-w-0 overflow-hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default inline-block w-full min-w-0">
              <div className="whitespace-pre-line break-words">{truncateDescription(bet.bet_description, 50)}</div>
              {bet.match_description && (
                <div className="text-[10px] opacity-50 break-words">{truncateDescription(bet.match_description, 50)}</div>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs px-2 py-1 text-xs bg-terminal-black border-terminal-border text-terminal-text">
            <div className="whitespace-pre-line">
              {bet.bet_description}
              {bet.match_description && (
                <>
                  {'\n'}
                  <span className="opacity-70">{bet.match_description}</span>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </td>
      <td className="py-1.5 px-1.5">
        <TagSelector
          betId={bet.id}
          selectedTags={bet.tags || []}
          onTagsChange={handleTagsChange}
          onTagsUpdated={onTagsUpdated}
        />
      </td>
      <td className="py-1.5 px-1.5 opacity-70">{bet.sport}</td>
      <td className="py-1.5 px-1.5 opacity-70">{bet.league || '-'}</td>
      <td className="py-1.5 px-1.5 opacity-70">{bet.betting_market || '-'}</td>
      <td className="text-right py-1.5 px-1.5">{formatValue(bet.stake_amount)}</td>
      <td className="text-right py-1.5 px-1.5 text-terminal-blue">{bet.odds.toFixed(2)}</td>
      <td className={`text-right py-1.5 px-1.5 min-w-[5.5rem] overflow-hidden text-ellipsis whitespace-nowrap ${
        bet.status === 'won' || bet.status === 'half_won' ? 'text-terminal-green' :
        bet.status === 'lost' || bet.status === 'half_lost' ? 'text-terminal-red' : 'opacity-70'
      }`}>
        {bet.is_cashout && bet.cashout_amount
          ? formatValue(bet.cashout_amount)
          : bet.status === 'half_won'
            ? formatValue((bet.stake_amount + bet.potential_return) / 2)
            : bet.status === 'half_lost'
              ? formatValue(bet.stake_amount / 2)
              : formatValue(bet.potential_return)}
      </td>
      <td className="text-center py-1.5 px-1.5 whitespace-nowrap min-w-[5rem]">
        <span className={`inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold whitespace-nowrap ${
          bet.status === 'won' ? 'text-terminal-green bg-terminal-green/10' :
          bet.status === 'lost' ? 'text-terminal-red bg-terminal-red/10' :
          bet.status === 'half_won' ? 'text-terminal-green bg-terminal-green/20' :
          bet.status === 'half_lost' ? 'text-terminal-red bg-terminal-red/20' :
          bet.status === 'pending' ? 'text-terminal-yellow bg-terminal-yellow/10' :
          bet.status === 'cashout' ? 'text-terminal-blue bg-terminal-blue/10' :
          'text-terminal-text bg-terminal-text/10'
        }`}>
          {translateStatus(bet.status)}
        </span>
      </td>
      <td className="py-1.5 px-1.5 min-w-[11rem]">
        <div className="flex flex-row items-center gap-1.5 justify-end flex-nowrap">
          {bet.status === 'pending' && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="px-2 py-1.5 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-gray/80 transition-all flex items-center gap-1.5 text-terminal-text shrink-0 text-[10px] font-bold uppercase"
                  >
                    <Target className="w-3.5 h-3.5 opacity-70 shrink-0" />
                    Resultado
                    <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-terminal-dark-gray border-terminal-border text-terminal-text">
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'won')} className="flex items-center gap-2 cursor-pointer">
                    <TrendingUp className="w-4 h-4 text-terminal-green" />
                    <span>Ganhou</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'lost')} className="flex items-center gap-2 cursor-pointer">
                    <TrendingDown className="w-4 h-4 text-terminal-red" />
                    <span>Perdeu</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'half_won')} className="flex items-center gap-2 cursor-pointer">
                    <TrendingUp className="w-4 h-4 text-terminal-green opacity-70" />
                    <span>1/2 Green</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'half_lost')} className="flex items-center gap-2 cursor-pointer">
                    <TrendingDown className="w-4 h-4 text-terminal-red opacity-70" />
                    <span>1/2 Red</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={() => openCashoutModal(bet)}
                className="px-2 py-1.5 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all flex items-center gap-1.5 shrink-0 text-[10px] font-bold text-terminal-blue hover:text-terminal-black"
                title="Cashout"
              >
                <DollarSign className="w-3.5 h-3.5 shrink-0" />
                CASHOUT
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => openEditModal(bet)}
            className="p-1.5 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all shrink-0"
            title="Editar"
          >
            <Edit className="w-4 h-4 text-terminal-blue hover:text-terminal-black" />
          </button>
          <button
            type="button"
            onClick={() => deleteBet(bet.id)}
            className="p-1.5 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-red hover:text-terminal-black hover:border-terminal-red transition-all shrink-0"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4 text-terminal-red hover:text-terminal-black" />
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
  updateBetStatus,
  openCashoutModal,
  openEditModal,
  deleteBet,
}: BetCardProps) {
  const handleTagsChange = useCallback((newTags: Tag[]) => {
    onBetTagsChange(bet.id, newTags, (bet.tags || []).map(t => t.id));
  }, [bet.id, bet.tags, onBetTagsChange]);

  return (
    <div className="bg-terminal-black border border-terminal-border-subtle p-4 rounded-md space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs opacity-50">{formatBetDate(bet.bet_date)}</span>
        <span className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold rounded whitespace-nowrap ${
          bet.status === 'won' ? 'text-terminal-green bg-terminal-green/10' :
          bet.status === 'lost' ? 'text-terminal-red bg-terminal-red/10' :
          bet.status === 'half_won' ? 'text-terminal-green bg-terminal-green/20' :
          bet.status === 'half_lost' ? 'text-terminal-red bg-terminal-red/20' :
          bet.status === 'pending' ? 'text-terminal-yellow bg-terminal-yellow/10' :
          bet.status === 'cashout' ? 'text-terminal-blue bg-terminal-blue/10' :
          'text-terminal-text bg-terminal-text/10'
        }`}>
          {translateStatus(bet.status)}
        </span>
      </div>
      <div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full text-left font-medium text-sm text-terminal-text cursor-pointer focus:outline-none focus:ring-0"
            >
              <span className="whitespace-pre-line block">{truncateDescription(bet.bet_description, 50)}</span>
              {bet.match_description && (
                <span className="text-xs opacity-60 mt-0.5 block">{truncateDescription(bet.match_description, 50)}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="max-w-[min(90vw,320px)] p-3 text-xs bg-terminal-black border-terminal-border text-terminal-text">
            <div className="whitespace-pre-line">
              {bet.bet_description}
              {bet.match_description && (
                <>
                  {'\n'}
                  <span className="opacity-70">{bet.match_description}</span>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <div className="text-xs text-terminal-blue mt-1 uppercase tracking-wider">{bet.sport}</div>
        {bet.league && <div className="text-xs text-terminal-blue mt-0.5 uppercase tracking-wider">{bet.league}</div>}
        {bet.betting_market && <div className="text-xs text-terminal-blue mt-0.5 uppercase tracking-wider">{bet.betting_market}</div>}
        <div className="mt-2">
          <TagSelector
            betId={bet.id}
            selectedTags={bet.tags || []}
            onTagsChange={handleTagsChange}
            onTagsUpdated={onTagsUpdated}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-terminal-border-subtle bg-terminal-dark-gray/30 -mx-4 px-4">
        <div className="text-center">
          <div className="text-[10px] opacity-50 uppercase mb-0.5">Valor</div>
          <div className="text-sm">{formatValue(bet.stake_amount)}</div>
        </div>
        <div className="text-center border-l border-terminal-border-subtle">
          <div className="text-[10px] opacity-50 uppercase mb-0.5">Odds</div>
          <div className="text-sm text-terminal-blue">{bet.odds.toFixed(2)}</div>
        </div>
        <div className="text-center border-l border-terminal-border-subtle">
          <div className="text-[10px] opacity-50 uppercase mb-0.5">Retorno</div>
          <div className={`text-sm ${
            bet.status === 'won' || bet.status === 'half_won' ? 'text-terminal-green' :
            bet.status === 'lost' || bet.status === 'half_lost' ? 'text-terminal-red' : 'opacity-70'
          }`}>
            {bet.is_cashout && bet.cashout_amount
              ? formatValue(bet.cashout_amount)
              : bet.status === 'half_won'
                ? formatValue((bet.stake_amount + bet.potential_return) / 2)
                : bet.status === 'half_lost'
                  ? formatValue(bet.stake_amount / 2)
                  : formatValue(bet.potential_return)}
          </div>
        </div>
      </div>
      <div className="pt-2">
        {bet.status === 'pending' ? (
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-3 py-2.5 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-gray/80 transition-all flex items-center gap-2 text-terminal-text w-full sm:w-auto justify-center"
                >
                  <Target className="w-4 h-4 opacity-70" />
                  <span className="text-xs font-bold uppercase">Resultado</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-terminal-dark-gray border-terminal-border text-terminal-text min-w-[180px]">
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'won')} className="flex items-center gap-2 cursor-pointer">
                  <TrendingUp className="w-4 h-4 text-terminal-green" />
                  <span>Ganhou</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'lost')} className="flex items-center gap-2 cursor-pointer">
                  <TrendingDown className="w-4 h-4 text-terminal-red" />
                  <span>Perdeu</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'half_won')} className="flex items-center gap-2 cursor-pointer">
                  <TrendingUp className="w-4 h-4 text-terminal-green opacity-70" />
                  <span>1/2 Green</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateBetStatus(bet.id, 'half_lost')} className="flex items-center gap-2 cursor-pointer">
                  <TrendingDown className="w-4 h-4 text-terminal-red opacity-70" />
                  <span>1/2 Red</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => openCashoutModal(bet)}
              className="px-3 py-2.5 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial min-w-0"
              title="Cashout"
            >
              <DollarSign className="w-4 h-4 text-terminal-blue hover:text-terminal-black shrink-0" />
              <span className="text-xs font-bold text-terminal-blue hover:text-terminal-black">CASHOUT</span>
            </button>
            <button type="button" onClick={() => openEditModal(bet)} className="p-2.5 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all flex items-center justify-center" title="Editar">
              <Edit className="w-5 h-5 text-terminal-blue hover:text-terminal-black" />
            </button>
            <button type="button" onClick={() => deleteBet(bet.id)} className="p-2.5 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-red hover:text-terminal-black hover:border-terminal-red transition-all flex items-center justify-center" title="Excluir">
              <Trash2 className="w-5 h-5 text-terminal-red hover:text-terminal-black" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => openEditModal(bet)} className="flex-1 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all flex justify-center items-center" title="Editar">
              <Edit className="w-5 h-5 text-terminal-blue hover:text-terminal-black" />
            </button>
            <button type="button" onClick={() => deleteBet(bet.id)} className="flex-1 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-red hover:text-terminal-black hover:border-terminal-red transition-all flex justify-center items-center" title="Excluir">
              <Trash2 className="w-5 h-5 text-terminal-red hover:text-terminal-black" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

const DAILY_BET_LIMIT = 3;

export default function Bets() {
  const { user, isLoading: authLoading } = useAuth();
  const { isPremium: isBetinhoPremium, isFree: isBetinhoFree } = useBetinhoPremium();
  const { isConfigured, toUnits, formatUnits, config, updateConfig, formatCurrency, refetchConfig } = useUserUnit();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [bets, setBets] = useState<Bet[]>([]);
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
      status: 'pending'
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

  // Filter states
  const [filters, setFilters] = useState({
    status: [] as string[],
    sport: [] as string[],
    league: [] as string[],
    betting_market: [] as string[],
    searchQuery: '',
    dateFrom: '',
    dateTo: '',
    selectedTags: [] as string[]
  });

  // User tags state
  const [userTags, setUserTags] = useState<Tag[]>([]);

  // Sort state
  type SortDirection = 'asc' | 'desc';
  type SortColumn = 'bet_date' | 'sport' | 'league' | 'betting_market' | 'stake_amount' | 'odds' | 'return' | 'status' | null;
  
  const [sortConfig, setSortConfig] = useState<{
    column: SortColumn;
    direction: SortDirection;
  }>({
    column: 'bet_date',
    direction: 'desc'  // padrão: mais recente primeiro
  });

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
    
    const totalReturn = wonBets.reduce((sum, bet) => sum + bet.potential_return, 0);
    const totalCashout = cashoutBets.reduce((sum, bet) => sum + (bet.cashout_amount || 0), 0);
    const totalHalfWon = halfWonBets.reduce((sum, bet) => sum + (bet.stake_amount + bet.potential_return) / 2, 0);
    const totalHalfLost = halfLostBets.reduce((sum, bet) => sum + bet.stake_amount / 2, 0);
    
    const totalEarnings = totalReturn + totalCashout + totalHalfWon + totalHalfLost;
    const settledCount = wonBets.length + lostBets.length + cashoutBets.length + halfWonBets.length + halfLostBets.length;
    const winEquiv = wonBets.length + cashoutBets.length + halfWonBets.length * 0.5;
    const lossEquiv = lostBets.length + halfLostBets.length * 0.5;
    const winRate = settledCount > 0 ? (winEquiv / (winEquiv + lossEquiv)) * 100 : 0;
    const profit = totalEarnings - totalStaked;
    const averageStake = totalBets > 0 ? totalStaked / totalBets : 0;
    
    const totalOdds = betsData.reduce((sum, bet) => sum + bet.odds, 0);
    const averageOdd = totalBets > 0 ? totalOdds / totalBets : 0;
    
    const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;

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
    if (isMountedRef.current) {
      setBets(prev => prev.map(b => b.id === betId ? { ...b, status: newStatus as Bet['status'] } : b));
    }
    try {
      const { error } = await supabase
        .from('bets')
        .update({ status: newStatus })
        .eq('id', betId);

      if (error) throw error;
      if (isMountedRef.current) {
        toast({ title: 'Success', description: 'Bet status updated' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setBets(prev => prev.map(b => b.id === betId ? { ...b, status: 'pending' } : b));
        toast({ title: 'Error', description: 'Failed to update bet status', variant: 'destructive' });
      }
    }
  }, [supabase, toast]);

  const deleteBet = useCallback(async (betId: string) => {
    if (!window.confirm('Are you sure you want to delete this bet?')) return;

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
        toast({ title: 'Success', description: 'Bet deleted' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        toast({ title: 'Error', description: 'Failed to delete bet', variant: 'destructive' });
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
    const potentialReturn = stakeAmount * odds;
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
      const potentialReturn = stakeAmount * odds;

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
          bet_date: data.bet_date || new Date().toISOString(),
          match_date: data.match_date || null,
          status: 'pending',
          channel: 'web'
        })
        .select('*')
        .single();

      if (error) throw error;

      const tagIds = data.selectedTagIds ?? [];
      for (const tagId of tagIds) {
        await supabase.rpc('add_tag_to_bet', {
          p_bet_id: newBet.id,
          p_tag_id: tagId
        });
      }

      const { data: tags } = await supabase.rpc('get_bet_tags', { p_bet_id: newBet.id });
      const betWithTags = { ...newBet, tags: tags ?? [] };

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
        status: bet.status || 'pending'
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
        if (new Date(bet.bet_date) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        const filterDate = new Date(filters.dateTo);
        filterDate.setHours(23, 59, 59, 999);
        if (new Date(bet.bet_date) > filterDate) return false;
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
      selectedTags: []
    });
  };

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

  // Sortable Header Component
  const SortableHeader = ({ column, label, align = 'left', className: extraClassName }: { column: SortColumn; label: string; align?: 'left' | 'right' | 'center'; className?: string }) => {
    const isActive = sortConfig.column === column;
    return (
      <th 
        className={`${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} py-1.5 px-1.5 data-label cursor-pointer hover:text-terminal-green transition-colors select-none ${extraClassName ?? ''}`}
        onClick={() => handleSort(column)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          {label}
          {isActive ? (
            sortConfig.direction === 'asc' ? (
              <ChevronUp className="w-3 h-3 text-terminal-green" />
            ) : (
              <ChevronDown className="w-3 h-3 text-terminal-green" />
            )
          ) : (
            <ChevronUp className="w-3 h-3 opacity-30" />
          )}
        </div>
      </th>
    );
  };

  const desktopRows = useMemo(() => {
    return sortedBets.map((bet) => (
      <BetRow
        key={bet.id}
        bet={bet}
        formatValue={formatValue}
        formatBetDate={formatBetDateForDisplay}
        translateStatus={translateStatus}
        onBetTagsChange={handleBetTagsChange}
        onTagsUpdated={fetchUserTags}
        updateBetStatus={updateBetStatus}
        openCashoutModal={openCashoutModal}
        openEditModal={openEditModal}
        deleteBet={deleteBet}
      />
    ));
  }, [sortedBets, formatValue, formatBetDateForDisplay, translateStatus, handleBetTagsChange, fetchUserTags, updateBetStatus, openCashoutModal, openEditModal, deleteBet]);

  const mobileCards = useMemo(() => {
    return sortedBets.map((bet) => (
      <BetCard
        key={bet.id}
        bet={bet}
        formatValue={formatValue}
        formatBetDate={formatBetDateForDisplay}
        translateStatus={translateStatus}
        onBetTagsChange={handleBetTagsChange}
        onTagsUpdated={fetchUserTags}
        updateBetStatus={updateBetStatus}
        openCashoutModal={openCashoutModal}
        openEditModal={openEditModal}
        deleteBet={deleteBet}
      />
    ));
  }, [sortedBets, formatValue, formatBetDateForDisplay, translateStatus, handleBetTagsChange, fetchUserTags, updateBetStatus, openCashoutModal, openEditModal, deleteBet]);

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
    <div className="w-full min-h-screen bg-terminal-black text-terminal-text">
      <BetsHeader
        onReferralClick={() => setReferralModalOpen(true)}
        showUnitsView={showUnitsView}
        onShowUnitsViewChange={setShowUnitsView}
        onUnitConfigClick={() => setUnitConfigOpen(true)}
        unitsConfigured={isConfigured()}
      />
      
      <main className="container mx-auto px-3 py-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <BetStatsCard 
            label="TOTAL APOSTAS" 
            value={stats.totalBets}
            valueColor="text-terminal-text"
          />
          <BetStatsCard 
            label="TAXA DE ACERTO" 
            value={`${stats.winRate.toFixed(1)}%`}
            trend={
              stats.winRate > 50
                ? 'up'
                : stats.winRate < 50
                  ? 'down'
                  : undefined
            }
          />
          <BetStatsCard 
            label="LUCRO" 
            value={formatValue(stats.profit)}
            valueColor={stats.profit >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
            trend={
              stats.profit > 0
                ? 'up'
                : stats.profit < 0
                  ? 'down'
                  : undefined
            }
          />
          <BetStatsCard 
            label="ROI" 
            value={`${stats.roi.toFixed(1)}%`}
            valueColor={stats.roi >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
            trend={
              stats.roi > 0
                ? 'up'
                : stats.roi < 0
                  ? 'down'
                  : undefined
            }
          />
          <BetStatsCard 
            label="TOTAL APOSTADO" 
            value={formatValue(stats.totalStaked)}
            valueColor="text-terminal-text"
          />
          <BetStatsCard 
            label="RETORNO TOTAL" 
            value={formatValue(stats.totalReturn)}
            valueColor="text-terminal-green"
          />
          <BetStatsCard 
            label="MÉDIA APOSTA" 
            value={formatValue(stats.averageStake)}
            valueColor="text-terminal-text"
          />
          <BetStatsCard 
            label="MÉDIA ODDS" 
            value={stats.averageOdd.toFixed(2)}
            valueColor="text-terminal-blue"
          />
        </div>

        <BankrollEvolutionChart 
          bets={bets} 
          initialBankroll={config.bank_amount}
          onUpdateBankroll={async (amount) => {
            if (config.unit_calculation_method === 'direct') {
               return await updateConfig({
                 method: 'direct',
                 unitValue: config.unit_value || 10,
                 bankAmount: amount
               });
            } else {
               const currentDivisor = config.bank_amount && config.unit_value 
                  ? config.bank_amount / config.unit_value 
                  : 100;
               
               return await updateConfig({
                 method: 'division',
                 bankAmount: amount,
                 divisor: currentDivisor
               });
            }
          }}
        />

        {/* Dashboard + Cash Flow Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate('/betting-dashboard')}
            className="w-full terminal-container p-4 flex items-center justify-between hover:bg-terminal-dark-gray/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-terminal-green/10 flex items-center justify-center group-hover:bg-terminal-green/20 transition-colors">
                <BarChart3 className="w-5 h-5 text-terminal-green" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-terminal-green">DASHBOARD</div>
                <div className="text-xs opacity-60">KPIs e gráficos por período</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-terminal-green opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/bankroll')}
            className="w-full terminal-container p-4 flex items-center justify-between hover:bg-terminal-dark-gray/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-blue-400">FLUXO DE CAIXA</div>
                <div className="text-xs opacity-60">Histórico detalhado de transações</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-400 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="terminal-container p-3 mb-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-col gap-3 w-full">
            {/* Primeira linha: Filtros principais */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 w-full">
              <div className="relative col-span-2 md:w-auto md:min-w-[200px]">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-terminal-text opacity-50" />
                <input 
                  type="text" 
                  placeholder="BUSCAR APOSTAS..." 
                  className="terminal-input w-full pl-8 pr-3 py-1.5 text-xs rounded-sm"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                />
              </div>
              
              <MultiSelectFilter
                label="STATUS"
                placeholder="TODOS STATUS"
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
                label="ESPORTES"
                placeholder="TODOS ESPORTES"
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
                label="LIGAS"
                placeholder="TODAS LIGAS"
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
                label="MERCADOS"
                placeholder="TODOS MERCADOS"
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

              <MultiSelectFilter
                label="TAGS"
                placeholder="TODAS AS TAGS"
                options={userTags.map(tag => ({
                  value: tag.id,
                  label: tag.name.toUpperCase()
                }))}
                selected={filters.selectedTags}
                onChange={(values) => setFilters(prev => ({ ...prev, selectedTags: values }))}
              />
            </div>

            {/* Segunda linha: Filtros de data */}
            <div className="flex gap-3">
              <Popover open={isFilterDateFromOpen} onOpenChange={setIsFilterDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="terminal-input w-full md:w-auto text-xs px-3 py-1.5 rounded-sm justify-start text-left font-normal flex items-center h-auto"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {(() => {
                      const date = parseDateString(filters.dateFrom);
                      return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'DATA INICIAL';
                    })()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border">
                  <CalendarComponent
                    mode="single"
                    selected={parseDateString(filters.dateFrom) || undefined}
                    onSelect={(date) => {
                      const formatted = formatDateToString(date);
                      setFilters(prev => {
                        const next = { ...prev, dateFrom: formatted };
                        const fromDate = parseDateString(formatted);
                        const toDate = parseDateString(prev.dateTo);
                        if (fromDate && toDate && isBefore(toDate, fromDate)) {
                          next.dateTo = '';
                        }
                        return next;
                      });
                      setIsFilterDateFromOpen(false);
                      setIsFilterDateToOpen(true);
                    }}
                    initialFocus
                    className="bg-terminal-dark-gray"
                  />
                </PopoverContent>
              </Popover>

              <Popover open={isFilterDateToOpen} onOpenChange={setIsFilterDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="terminal-input w-full md:w-auto text-xs px-3 py-1.5 rounded-sm justify-start text-left font-normal flex items-center h-auto"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {(() => {
                      const date = parseDateString(filters.dateTo);
                      return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'DATA FINAL';
                    })()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border">
                  <CalendarComponent
                    mode="single"
                    selected={parseDateString(filters.dateTo) || undefined}
                    disabled={(date) => {
                      const fromDate = parseDateString(filters.dateFrom);
                      return fromDate ? isBefore(date, fromDate) : false;
                    }}
                    onSelect={(date) => {
                      const fromDate = parseDateString(filters.dateFrom);
                      if (fromDate && date && isBefore(date, fromDate)) {
                        return;
                      }
                      setFilters(prev => ({ 
                        ...prev, 
                        dateTo: formatDateToString(date) 
                      }));
                      setIsFilterDateToOpen(false);
                    }}
                    initialFocus
                    className="bg-terminal-dark-gray"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button 
              type="button"
              onClick={clearAllFilters}
              className="terminal-button px-4 py-2.5 text-sm flex items-center justify-center gap-2 border-terminal-border hover:border-terminal-red hover:text-terminal-red transition-colors min-h-[40px]"
            >
              <X className="w-4 h-4 shrink-0" />
              <span>LIMPAR FILTROS</span>
            </button>
            <button 
              type="button"
              onClick={fetchBets}
              className="terminal-button px-4 py-2.5 text-sm flex items-center justify-center gap-2 border-terminal-border hover:border-terminal-green transition-colors min-h-[40px]"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <span>ATUALIZAR</span>
            </button>
          </div>
        </div>

        {/* Bets Table */}
        <div className="terminal-container p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="section-title">APOSTAS RECENTES</h3>
            <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (isBetinhoFree && (dailyBetCount ?? 0) >= DAILY_BET_LIMIT) {
                  navigate('/paywall');
                  return;
                }
                setIsCreateModalOpen(true);
              }}
                className="terminal-button px-4 py-2 text-sm flex items-center gap-2 border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-terminal-black transition-colors"
              >
                <Plus className="w-4 h-4" />
                NOVA APOSTA
              </button>
              {isBetinhoFree && dailyBetCount !== null && (
                <span className="text-[10px] opacity-50">
                  {dailyBetCount}/{DAILY_BET_LIMIT} apostas hoje
                </span>
              )}
              <span className="text-[10px] opacity-50">MOSTRANDO {sortedBets.length} APOSTAS</span>
            </div>
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-terminal-gray" />
              ))}
            </div>
          ) : filteredBets.length === 0 ? (
            <div className="text-center py-12 opacity-50">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>NENHUMA APOSTA ENCONTRADA</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - table-auto para min-width das células (RETORNO/STATUS/AÇÕES) serem respeitados */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs min-w-[960px] table-auto">
                  <thead>
                    <tr className="border-b border-terminal-border-subtle">
                      <SortableHeader column="bet_date" label="DATA" />
                      <th className="text-left py-1.5 px-1.5 data-label">DESCRIÇÃO</th>
                      <th className="text-left py-1.5 px-1.5 data-label">TAGS</th>
                      <SortableHeader column="sport" label="ESPORTE" />
                      <SortableHeader column="league" label="LIGA" />
                      <SortableHeader column="betting_market" label="MERCADO" />
                      <SortableHeader column="stake_amount" label="VALOR" align="right" />
                      <SortableHeader column="odds" label="ODDS" align="right" />
                      <SortableHeader column="return" label="RETORNO" align="right" className="min-w-[5.5rem]" />
                      <SortableHeader column="status" label="STATUS" align="center" className="min-w-[5rem]" />
                      <th className="text-right py-1.5 px-1.5 data-label min-w-[11rem]">AÇÕES</th>
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
            </>
          )}
        </div>
      </main>

      {/* Keep existing Modals but wrap them or style them if possible. 
          For now, using the existing Shadcn dialogs is fine as they are overlays.
          I will just ensure they are rendered.
      */}
      
      {/* Cashout Modal */}
      <Dialog open={cashoutModal.isOpen} onOpenChange={(open) => 
        setCashoutModal(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-terminal-green">
              <DollarSign className="w-4 h-4" />
              {cashoutModal.bet?.is_cashout ? 'EDITAR CASHOUT' : 'CASHOUT'}
            </DialogTitle>
            <DialogDescription className="text-terminal-text opacity-60">
              {cashoutModal.bet?.is_cashout 
                ? 'Atualize o valor do cashout para esta aposta.'
                : 'Insira o valor do cashout para esta aposta.'
              }
            </DialogDescription>
          </DialogHeader>
          
          {cashoutModal.bet && (
            <div className="space-y-4">
              <div className="p-3 bg-terminal-black rounded border border-terminal-border-subtle">
                <p className="font-medium text-sm">{cashoutModal.bet.bet_description}</p>
                <div className="flex justify-between text-xs mt-2 opacity-70">
                  <span>VALOR: {formatValue(cashoutModal.bet.stake_amount)}</span>
                  <span>ODDS: {cashoutModal.bet.odds}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-70">Valor do Cashout (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashoutModal.cashoutAmount}
                  onChange={(e) => setCashoutModal(prev => ({ ...prev, cashoutAmount: e.target.value }))}
                  className="bg-terminal-black border-terminal-border text-terminal-text"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setCashoutModal({ isOpen: false, bet: null, cashoutAmount: '', cashoutOdds: '' })}
                  variant="outline"
                  className="flex-1 border-terminal-border hover:bg-terminal-gray text-terminal-text"
                >
                  CANCELAR
                </Button>
                <Button
                  onClick={processCashout}
                  disabled={!cashoutModal.cashoutAmount}
                  className="flex-1 bg-terminal-green hover:bg-terminal-green-bright text-white"
                >
                  CONFIRMAR
                </Button>
              </div>
            </div>
          )}
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
        <DialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-terminal-blue">
              <Edit className="w-4 h-4" />
              EDITAR APOSTA
            </DialogTitle>
          </DialogHeader>
          
          {editModal.bet && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-70">Descrição</Label>
                <Input
                  value={editModal.formData.bet_description}
                  onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, bet_description: e.target.value } }))}
                  className="bg-terminal-black border-terminal-border text-terminal-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase opacity-70">Esporte</Label>
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
                      className="bg-terminal-black border-terminal-border text-terminal-text"
                    />
                    {isSportDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded border border-terminal-border bg-terminal-dark-gray">
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
                              className={`w-full text-left px-3 py-2 text-sm text-terminal-text hover:bg-terminal-black ${
                                index === sportHighlightIndex ? 'bg-terminal-black' : ''
                              }`}
                            >
                              {sport}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs opacity-60">
                            Nenhum esporte encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase opacity-70">Liga</Label>
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
                      className="bg-terminal-black border-terminal-border text-terminal-text"
                    />
                    {isLeagueDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded border border-terminal-border bg-terminal-dark-gray">
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
                              className={`w-full text-left px-3 py-2 text-sm text-terminal-text hover:bg-terminal-black ${
                                index === leagueHighlightIndex ? 'bg-terminal-black' : ''
                              }`}
                            >
                              {league}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs opacity-60">
                            Nenhuma liga encontrada
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase opacity-70">Mercado</Label>
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
                      className="bg-terminal-black border-terminal-border text-terminal-text"
                    />
                    {isBettingMarketDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded border border-terminal-border bg-terminal-dark-gray">
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
                              className={`w-full text-left px-3 py-2 text-sm text-terminal-text hover:bg-terminal-black ${
                                index === bettingMarketHighlightIndex ? 'bg-terminal-black' : ''
                              }`}
                            >
                              {market}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs opacity-60">
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
                  <Label className="text-xs uppercase opacity-70">Valor</Label>
                  <Input
                    type="number"
                    value={editModal.formData.stake_amount}
                    onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, stake_amount: e.target.value } }))}
                    className="bg-terminal-black border-terminal-border text-terminal-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase opacity-70">Odds</Label>
                  <Input
                    type="number"
                    value={editModal.formData.odds}
                    onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, odds: e.target.value } }))}
                    className="bg-terminal-black border-terminal-border text-terminal-text"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-70">Data da Aposta</Label>
                <Popover open={isEditDatePopoverOpen} onOpenChange={setIsEditDatePopoverOpen} modal>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-terminal-black border-terminal-border text-terminal-text hover:bg-terminal-gray"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {(() => {
                        const date = parseDateString(editModal.formData.bet_date);
                        return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data';
                      })()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border">
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
                      className="bg-terminal-dark-gray"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-70">Status</Label>
                <Select 
                  value={editModal.formData.status} 
                  onValueChange={(value: any) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, status: value } }))}
                >
                  <SelectTrigger className="bg-terminal-black border-terminal-border text-terminal-text">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text">
                    <SelectItem value="pending">PENDENTE</SelectItem>
                    <SelectItem value="won">GANHOU</SelectItem>
                    <SelectItem value="lost">PERDEU</SelectItem>
                    <SelectItem value="half_won">1/2 GREEN</SelectItem>
                    <SelectItem value="half_lost">1/2 RED</SelectItem>
                    <SelectItem value="void">ANULADA</SelectItem>
                    <SelectItem value="cashout">CASHOUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  variant="outline"
                  className="flex-1 border-terminal-border hover:bg-terminal-gray text-terminal-text"
                >
                  CANCELAR
                </Button>
                <Button
                  onClick={updateBetData}
                  className="flex-1 bg-terminal-blue hover:bg-blue-600 text-white"
                >
                  SALVAR ALTERAÇÕES
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
    </div>
  );
}
