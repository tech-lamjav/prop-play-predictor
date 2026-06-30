import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parse, isValid, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagSelector } from '@/components/bets/TagSelector';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { telegramBotUrl } from '@/config/environment';

export interface CreateBetTag {
  id: string;
  name: string;
  color: string;
}

export interface CreateBetFormData {
  bet_description: string;
  match_description: string;
  sport: string;
  league: string;
  betting_market: string;
  odds: string;
  stake_amount: string;
  bet_date: string;
  match_date: string;
  selectedTagIds: string[];
  is_credit_bet: boolean;
}

interface CreateBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: CreateBetFormData) => Promise<boolean>;
  sportsList: string[];
  leaguesList: string[];
  bettingMarketsList: string[];
  userTags: CreateBetTag[];
  onTagsUpdated?: () => void;
}

const getDefaultFormData = (): CreateBetFormData => ({
  bet_description: '',
  match_description: '',
  sport: '',
  league: '',
  betting_market: '',
  odds: '',
  stake_amount: '',
  bet_date: new Date().toISOString().split('T')[0],
  match_date: '',
  selectedTagIds: [],
  is_credit_bet: false,
});

const parseDateString = (dateString: string): Date | undefined => {
  if (!dateString) return undefined;
  const date = parse(dateString, 'yyyy-MM-dd', new Date());
  return isValid(date) ? date : undefined;
};

const formatDateToString = (date: Date | undefined): string => {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
};

type CreateBetFormState = Omit<CreateBetFormData, 'selectedTagIds'> & {
  selectedTags: CreateBetTag[];
  is_credit_bet: boolean;
  status: string;
  bookmaker: string;
};

const getDefaultFormState = (): CreateBetFormState => {
  const { selectedTagIds: _, ...rest } = getDefaultFormData();
  return { ...rest, selectedTags: [], is_credit_bet: false, status: 'pending', bookmaker: '' };
};

export const CreateBetModal: React.FC<CreateBetModalProps> = ({
  open,
  onOpenChange,
  onCreate,
  sportsList,
  leaguesList,
  bettingMarketsList,
  userTags: _userTags,
  onTagsUpdated,
}) => {
  const [formData, setFormData] = useState<CreateBetFormState>(getDefaultFormState());
  const [stayOpen, setStayOpen] = useState(false);
  const [isCreateDatePopoverOpen, setIsCreateDatePopoverOpen] = useState(false);
  const [isCreateMatchDatePopoverOpen, setIsCreateMatchDatePopoverOpen] = useState(false);
  const [isCreateSportDropdownOpen, setIsCreateSportDropdownOpen] = useState(false);
  const [isCreateSportQueryTouched, setIsCreateSportQueryTouched] = useState(false);
  const [createSportHighlightIndex, setCreateSportHighlightIndex] = useState(-1);
  const createSportItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isCreateLeagueDropdownOpen, setIsCreateLeagueDropdownOpen] = useState(false);
  const [isCreateLeagueQueryTouched, setIsCreateLeagueQueryTouched] = useState(false);
  const [createLeagueHighlightIndex, setCreateLeagueHighlightIndex] = useState(-1);
  const createLeagueItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isCreateBettingMarketDropdownOpen, setIsCreateBettingMarketDropdownOpen] = useState(false);
  const [isCreateBettingMarketQueryTouched, setIsCreateBettingMarketQueryTouched] = useState(false);
  const [createBettingMarketHighlightIndex, setCreateBettingMarketHighlightIndex] = useState(-1);
  const createBettingMarketItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const resetForm = useCallback(() => {
    setFormData(getDefaultFormState());
    setIsCreateDatePopoverOpen(false);
    setIsCreateMatchDatePopoverOpen(false);
    setIsCreateSportDropdownOpen(false);
    setIsCreateSportQueryTouched(false);
    setCreateSportHighlightIndex(-1);
    setIsCreateLeagueDropdownOpen(false);
    setIsCreateLeagueQueryTouched(false);
    setCreateLeagueHighlightIndex(-1);
    setIsCreateBettingMarketDropdownOpen(false);
    setIsCreateBettingMarketQueryTouched(false);
    setCreateBettingMarketHighlightIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const filteredCreateSportsList = useMemo(() => {
    if (!isCreateSportQueryTouched) {
      return sportsList;
    }
    const query = formData.sport.trim().toLowerCase();
    if (!query) {
      return sportsList;
    }
    return sportsList.filter((sport) => sport.toLowerCase().includes(query));
  }, [formData.sport, isCreateSportQueryTouched, sportsList]);

  const filteredCreateLeaguesList = useMemo(() => {
    if (!isCreateLeagueQueryTouched) {
      return leaguesList;
    }
    const query = formData.league.trim().toLowerCase();
    if (!query) return leaguesList;
    return leaguesList.filter((league) => league.toLowerCase().includes(query));
  }, [formData.league, isCreateLeagueQueryTouched, leaguesList]);

  const filteredCreateBettingMarketsList = useMemo(() => {
    if (!isCreateBettingMarketQueryTouched) {
      return bettingMarketsList;
    }
    const query = formData.betting_market.trim().toLowerCase();
    if (!query) return bettingMarketsList;
    return bettingMarketsList.filter((market) => market.toLowerCase().includes(query));
  }, [formData.betting_market, isCreateBettingMarketQueryTouched, bettingMarketsList]);

  useEffect(() => {
    if (!isCreateSportDropdownOpen || filteredCreateSportsList.length === 0) {
      setCreateSportHighlightIndex(-1);
      return;
    }

    setCreateSportHighlightIndex((prev) => {
      if (prev < 0 || prev >= filteredCreateSportsList.length) {
        return 0;
      }
      return prev;
    });
  }, [isCreateSportDropdownOpen, filteredCreateSportsList.length]);

  useEffect(() => {
    if (!isCreateSportDropdownOpen || createSportHighlightIndex < 0) return;
    const currentItem = createSportItemRefs.current[createSportHighlightIndex];
    if (currentItem?.scrollIntoView) {
      currentItem.scrollIntoView({ block: 'nearest' });
    }
  }, [isCreateSportDropdownOpen, createSportHighlightIndex]);

  useEffect(() => {
    if (!isCreateLeagueDropdownOpen || filteredCreateLeaguesList.length === 0) {
      setCreateLeagueHighlightIndex(-1);
      return;
    }

    setCreateLeagueHighlightIndex((prev) => {
      if (prev < 0 || prev >= filteredCreateLeaguesList.length) {
        return 0;
      }
      return prev;
    });
  }, [isCreateLeagueDropdownOpen, filteredCreateLeaguesList.length]);

  useEffect(() => {
    if (!isCreateLeagueDropdownOpen || createLeagueHighlightIndex < 0) return;
    const currentItem = createLeagueItemRefs.current[createLeagueHighlightIndex];
    if (currentItem?.scrollIntoView) {
      currentItem.scrollIntoView({ block: 'nearest' });
    }
  }, [isCreateLeagueDropdownOpen, createLeagueHighlightIndex]);

  useEffect(() => {
    if (!isCreateBettingMarketDropdownOpen || filteredCreateBettingMarketsList.length === 0) {
      setCreateBettingMarketHighlightIndex(-1);
      return;
    }
    setCreateBettingMarketHighlightIndex((prev) => {
      if (prev < 0 || prev >= filteredCreateBettingMarketsList.length) {
        return 0;
      }
      return prev;
    });
  }, [isCreateBettingMarketDropdownOpen, filteredCreateBettingMarketsList.length]);

  useEffect(() => {
    if (!isCreateBettingMarketDropdownOpen || createBettingMarketHighlightIndex < 0) return;
    const currentItem = createBettingMarketItemRefs.current[createBettingMarketHighlightIndex];
    if (currentItem?.scrollIntoView) {
      currentItem.scrollIntoView({ block: 'nearest' });
    }
  }, [isCreateBettingMarketDropdownOpen, createBettingMarketHighlightIndex]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleCreate = async () => {
    const payload: CreateBetFormData = {
      bet_description: formData.bet_description,
      match_description: formData.match_description,
      sport: formData.sport,
      league: formData.league,
      betting_market: formData.betting_market,
      odds: formData.odds,
      stake_amount: formData.stake_amount,
      bet_date: formData.bet_date,
      match_date: formData.match_date,
      is_credit_bet: formData.is_credit_bet,
      selectedTagIds: formData.selectedTags.map((t) => t.id),
    };
    const success = await onCreate(payload);
    if (success) {
      if (stayOpen) {
        // mantém modal aberto, apenas reseta form pro próximo cadastro
        resetForm();
      } else {
        handleOpenChange(false);
      }
    }
  };

  // TODO: integrar com user unit config (config.unit_value); por ora default 100
  const handleUseOneUnit = () => {
    setFormData((prev) => ({ ...prev, stake_amount: '100' }));
  };

  // Cálculo do summary card
  const summary = useMemo(() => {
    const oddsNum = parseFloat(formData.odds);
    const stakeNum = parseFloat(formData.stake_amount);
    if (isNaN(oddsNum) || isNaN(stakeNum) || oddsNum <= 0 || stakeNum <= 0) {
      return null;
    }
    const retorno = formData.is_credit_bet ? stakeNum * (oddsNum - 1) : stakeNum * oddsNum;
    const lucro = retorno - stakeNum;
    return {
      stake: stakeNum,
      retorno,
      lucro,
    };
  }, [formData.odds, formData.stake_amount, formData.is_credit_bet]);

  const formatCurrency = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="theme-rebrand bg-white border-line text-ink sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-forest font-semibold">Nova aposta</div>
            <DialogTitle className="text-[20px] font-semibold tracking-tight text-ink mt-0.5">Cadastrar aposta</DialogTitle>
          </div>
        </div>

        {/* Subheader: "Cadastro manual" + Telegram pill */}
        <div className="px-6 pt-5 flex items-center justify-between gap-3">
          <div className="text-[12px] text-ink-2">Cadastro manual da aposta</div>
          <a
            href={telegramBotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 inline-flex items-center gap-2 text-[12px] font-semibold text-forest border border-forest/30 hover:bg-forest-tint rounded-md transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Cadastrar pelo Telegram</span>
            <span className="text-[9px] uppercase tracking-[0.1em] bg-amber-400 text-forest px-1.5 py-0.5 rounded">+ rápido</span>
          </a>
        </div>

        {/* Form body */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Descrição (col-span-2) */}
          <div className="col-span-1 sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Descrição *</label>
            </div>
            <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
              <input
                value={formData.bet_description}
                onChange={(e) => setFormData((prev) => ({ ...prev, bet_description: e.target.value }))}
                className="flex-1 bg-transparent px-3 text-[13px] text-ink outline-none tabular"
                placeholder="Ex: LeBron 25+ pontos"
              />
            </div>
          </div>

          {/* Esporte | Liga */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Esporte *</label>
            </div>
            <div className="relative">
              <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10 hover:border-forest/30">
                <input
                  value={formData.sport}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData((prev) => ({ ...prev, sport: value }));
                    setIsCreateSportQueryTouched(true);
                    setIsCreateSportDropdownOpen(true);
                    setCreateSportHighlightIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Tab') {
                      setIsCreateSportDropdownOpen(false);
                      setIsCreateSportQueryTouched(false);
                      setCreateSportHighlightIndex(-1);
                      return;
                    }

                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      if (!isCreateSportDropdownOpen) {
                        setIsCreateSportDropdownOpen(true);
                        setIsCreateSportQueryTouched(true);
                      }
                      setCreateSportHighlightIndex((prev) => {
                        if (filteredCreateSportsList.length === 0) return -1;
                        const next = prev < filteredCreateSportsList.length - 1 ? prev + 1 : 0;
                        return next;
                      });
                      return;
                    }

                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      if (!isCreateSportDropdownOpen) {
                        setIsCreateSportDropdownOpen(true);
                        setIsCreateSportQueryTouched(true);
                      }
                      setCreateSportHighlightIndex((prev) => {
                        if (filteredCreateSportsList.length === 0) return -1;
                        const next = prev > 0 ? prev - 1 : filteredCreateSportsList.length - 1;
                        return next;
                      });
                      return;
                    }

                    if (event.key === 'Enter') {
                      if (createSportHighlightIndex >= 0 && filteredCreateSportsList[createSportHighlightIndex]) {
                        event.preventDefault();
                        const selectedSport = filteredCreateSportsList[createSportHighlightIndex];
                        setFormData((prev) => ({ ...prev, sport: selectedSport }));
                        setIsCreateSportDropdownOpen(false);
                        setIsCreateSportQueryTouched(false);
                        setCreateSportHighlightIndex(-1);
                      }
                      return;
                    }

                    if (event.key === 'Escape') {
                      setIsCreateSportDropdownOpen(false);
                      setCreateSportHighlightIndex(-1);
                    }
                  }}
                  onFocus={() => {
                    setIsCreateSportDropdownOpen(true);
                    setIsCreateSportQueryTouched(false);
                  }}
                  onBlur={() => setIsCreateSportDropdownOpen(false)}
                  placeholder="Selecione ou digite"
                  className="flex-1 bg-transparent px-3 text-[13px] text-ink outline-none"
                />
                <ChevronDown className="w-3.5 h-3.5 text-ink-2 mr-3" />
              </div>
              {isCreateSportDropdownOpen && formData.sport && (
                <div className="theme-rebrand absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-line bg-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                  {filteredCreateSportsList.length > 0 ? (
                    filteredCreateSportsList.map((sport, index) => (
                      <button
                        key={sport}
                        type="button"
                        tabIndex={-1}
                        ref={(element) => {
                          createSportItemRefs.current[index] = element;
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setFormData((prev) => ({ ...prev, sport }));
                          setIsCreateSportDropdownOpen(false);
                          setIsCreateSportQueryTouched(false);
                          setCreateSportHighlightIndex(-1);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm text-ink hover:bg-ink-3/40 ${
                          index === createSportHighlightIndex ? 'bg-ink-3/40' : ''
                        }`}
                      >
                        {sport}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-ink-2">Nenhum esporte encontrado</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Liga / competição</label>
            </div>
            <div className="relative">
              <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10 hover:border-forest/30">
                <input
                  value={formData.league}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData((prev) => ({ ...prev, league: value }));
                    setIsCreateLeagueQueryTouched(true);
                    setIsCreateLeagueDropdownOpen(true);
                    setCreateLeagueHighlightIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Tab') {
                      setIsCreateLeagueDropdownOpen(false);
                      setIsCreateLeagueQueryTouched(false);
                      setCreateLeagueHighlightIndex(-1);
                      return;
                    }

                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      if (!isCreateLeagueDropdownOpen) {
                        setIsCreateLeagueDropdownOpen(true);
                        setIsCreateLeagueQueryTouched(true);
                      }
                      setCreateLeagueHighlightIndex((prev) => {
                        if (filteredCreateLeaguesList.length === 0) return -1;
                        const next = prev < filteredCreateLeaguesList.length - 1 ? prev + 1 : 0;
                        return next;
                      });
                      return;
                    }

                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      if (!isCreateLeagueDropdownOpen) {
                        setIsCreateLeagueDropdownOpen(true);
                        setIsCreateLeagueQueryTouched(true);
                      }
                      setCreateLeagueHighlightIndex((prev) => {
                        if (filteredCreateLeaguesList.length === 0) return -1;
                        const next = prev > 0 ? prev - 1 : filteredCreateLeaguesList.length - 1;
                        return next;
                      });
                      return;
                    }

                    if (event.key === 'Enter') {
                      if (createLeagueHighlightIndex >= 0 && filteredCreateLeaguesList[createLeagueHighlightIndex]) {
                        event.preventDefault();
                        const selectedLeague = filteredCreateLeaguesList[createLeagueHighlightIndex];
                        setFormData((prev) => ({ ...prev, league: selectedLeague }));
                        setIsCreateLeagueDropdownOpen(false);
                        setIsCreateLeagueQueryTouched(false);
                        setCreateLeagueHighlightIndex(-1);
                      }
                      return;
                    }

                    if (event.key === 'Escape') {
                      setIsCreateLeagueDropdownOpen(false);
                      setCreateLeagueHighlightIndex(-1);
                    }
                  }}
                  onFocus={() => {
                    setIsCreateLeagueDropdownOpen(true);
                    setIsCreateLeagueQueryTouched(false);
                  }}
                  onBlur={() => setIsCreateLeagueDropdownOpen(false)}
                  placeholder="Selecione ou digite"
                  className="flex-1 bg-transparent px-3 text-[13px] text-ink outline-none"
                />
                <ChevronDown className="w-3.5 h-3.5 text-ink-2 mr-3" />
              </div>
              {isCreateLeagueDropdownOpen && formData.league && (
                <div className="theme-rebrand absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-line bg-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                  {filteredCreateLeaguesList.length > 0 ? (
                    filteredCreateLeaguesList.map((league, index) => (
                      <button
                        key={league}
                        type="button"
                        tabIndex={-1}
                        ref={(element) => {
                          createLeagueItemRefs.current[index] = element;
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setFormData((prev) => ({ ...prev, league }));
                          setIsCreateLeagueDropdownOpen(false);
                          setIsCreateLeagueQueryTouched(false);
                          setCreateLeagueHighlightIndex(-1);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm text-ink hover:bg-ink-3/40 ${
                          index === createLeagueHighlightIndex ? 'bg-ink-3/40' : ''
                        }`}
                      >
                        {league}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-ink-2">Nenhuma liga encontrada</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tipo de aposta | Status inicial */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Tipo de aposta</label>
            </div>
            <div className="relative">
              <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10 hover:border-forest/30">
                <input
                  value={formData.betting_market}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData((prev) => ({ ...prev, betting_market: value }));
                    setIsCreateBettingMarketQueryTouched(true);
                    setIsCreateBettingMarketDropdownOpen(true);
                    setCreateBettingMarketHighlightIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Tab') {
                      setIsCreateBettingMarketDropdownOpen(false);
                      setIsCreateBettingMarketQueryTouched(false);
                      setCreateBettingMarketHighlightIndex(-1);
                      return;
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      if (!isCreateBettingMarketDropdownOpen) {
                        setIsCreateBettingMarketDropdownOpen(true);
                        setIsCreateBettingMarketQueryTouched(true);
                      }
                      setCreateBettingMarketHighlightIndex((prev) => {
                        if (filteredCreateBettingMarketsList.length === 0) return -1;
                        const next = prev < filteredCreateBettingMarketsList.length - 1 ? prev + 1 : 0;
                        return next;
                      });
                      return;
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      if (!isCreateBettingMarketDropdownOpen) {
                        setIsCreateBettingMarketDropdownOpen(true);
                        setIsCreateBettingMarketQueryTouched(true);
                      }
                      setCreateBettingMarketHighlightIndex((prev) => {
                        if (filteredCreateBettingMarketsList.length === 0) return -1;
                        const next = prev > 0 ? prev - 1 : filteredCreateBettingMarketsList.length - 1;
                        return next;
                      });
                      return;
                    }
                    if (event.key === 'Enter') {
                      if (createBettingMarketHighlightIndex >= 0 && filteredCreateBettingMarketsList[createBettingMarketHighlightIndex]) {
                        event.preventDefault();
                        const selectedMarket = filteredCreateBettingMarketsList[createBettingMarketHighlightIndex];
                        setFormData((prev) => ({ ...prev, betting_market: selectedMarket }));
                        setIsCreateBettingMarketDropdownOpen(false);
                        setIsCreateBettingMarketQueryTouched(false);
                        setCreateBettingMarketHighlightIndex(-1);
                      }
                      return;
                    }
                    if (event.key === 'Escape') {
                      setIsCreateBettingMarketDropdownOpen(false);
                      setCreateBettingMarketHighlightIndex(-1);
                    }
                  }}
                  onFocus={() => {
                    setIsCreateBettingMarketDropdownOpen(true);
                    setIsCreateBettingMarketQueryTouched(false);
                  }}
                  onBlur={() => setIsCreateBettingMarketDropdownOpen(false)}
                  placeholder="Selecione ou digite"
                  className="flex-1 bg-transparent px-3 text-[13px] text-ink outline-none"
                />
                <ChevronDown className="w-3.5 h-3.5 text-ink-2 mr-3" />
              </div>
              {isCreateBettingMarketDropdownOpen && formData.betting_market && (
                <div className="theme-rebrand absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-line bg-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                  {filteredCreateBettingMarketsList.length > 0 ? (
                    filteredCreateBettingMarketsList.map((market, index) => (
                      <button
                        key={market}
                        type="button"
                        tabIndex={-1}
                        ref={(element) => {
                          createBettingMarketItemRefs.current[index] = element;
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setFormData((prev) => ({ ...prev, betting_market: market }));
                          setIsCreateBettingMarketDropdownOpen(false);
                          setIsCreateBettingMarketQueryTouched(false);
                          setCreateBettingMarketHighlightIndex(-1);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm text-ink hover:bg-ink-3/40 ${
                          index === createBettingMarketHighlightIndex ? 'bg-ink-3/40' : ''
                        }`}
                      >
                        {market}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-ink-2">Nenhum mercado encontrado</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status inicial — visual-only; TODO: wire status to onCreate */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Status inicial</label>
            </div>
            <div className="relative">
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full h-10 px-3 pr-8 appearance-none bg-canvas border border-line rounded-md text-[13px] text-ink hover:border-forest/30 focus:border-forest/50 focus:ring-2 focus:ring-forest/10 outline-none"
              >
                <option value="pending">Pendente</option>
                <option value="won">Ganhou</option>
                <option value="lost">Perdeu</option>
                <option value="void">Cancelada</option>
                <option value="cashout">Cashout</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-ink-2 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Stake (com link "Usar 1 unidade" no right) | Odd */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Stake *</label>
              <button
                type="button"
                onClick={handleUseOneUnit}
                className="text-[10px] text-forest font-semibold uppercase tracking-[0.08em] hover:underline"
              >
                Usar 1 unidade
              </button>
            </div>
            <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
              <span className="pl-3 text-[12px] text-ink-2 font-medium">R$</span>
              <input
                type="number"
                step="0.01"
                value={formData.stake_amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, stake_amount: e.target.value }))}
                className="flex-1 bg-transparent px-3 text-[13px] text-ink outline-none tabular"
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Odd *</label>
            </div>
            <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
              <input
                type="number"
                step="0.01"
                value={formData.odds}
                onChange={(e) => setFormData((prev) => ({ ...prev, odds: e.target.value }))}
                className="flex-1 bg-transparent px-3 text-[13px] text-ink outline-none tabular"
                placeholder="1,00"
              />
            </div>
          </div>

          {/* Casa de apostas | Data e hora */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Casa de apostas</label>
            </div>
            {/* TODO: wire bookmaker to onCreate */}
            <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
              <input
                value={formData.bookmaker}
                onChange={(e) => setFormData((prev) => ({ ...prev, bookmaker: e.target.value }))}
                className="flex-1 bg-transparent px-3 text-[13px] text-ink outline-none"
                placeholder="Ex: Bet365"
              />
            </div>
          </div>

          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Data da Aposta *</label>
            </div>
            <Popover open={isCreateDatePopoverOpen} onOpenChange={setIsCreateDatePopoverOpen} modal>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full h-10 px-3 inline-flex items-center justify-between bg-canvas border border-line rounded-md text-[13px] text-ink hover:border-forest/30"
                >
                  <span className="inline-flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-forest" />
                    {(() => {
                      const date = parseDateString(formData.bet_date);
                      return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data';
                    })()}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-ink-2" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="theme-rebrand w-auto p-0 bg-white border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                <CalendarComponent
                  mode="single"
                  selected={parseDateString(formData.bet_date) || undefined}
                  onSelect={(date) => {
                    setFormData((prev) => ({ ...prev, bet_date: formatDateToString(date) }));
                    setIsCreateDatePopoverOpen(false);
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

          {/* Partida (opcional) | Data da partida (opcional) */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Partida (opcional)</label>
            </div>
            <div className="flex items-center h-10 bg-canvas border border-line rounded-md focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
              <input
                value={formData.match_description}
                onChange={(e) => setFormData((prev) => ({ ...prev, match_description: e.target.value }))}
                className="flex-1 bg-transparent px-3 text-[13px] text-ink outline-none"
                placeholder="Ex: Lakers x Celtics"
              />
            </div>
          </div>

          <div className="col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Data da partida (opcional)</label>
            </div>
            <Popover open={isCreateMatchDatePopoverOpen} onOpenChange={setIsCreateMatchDatePopoverOpen} modal>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full h-10 px-3 inline-flex items-center justify-between bg-canvas border border-line rounded-md text-[13px] text-ink hover:border-forest/30"
                >
                  <span className="inline-flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-forest" />
                    {(() => {
                      const date = parseDateString(formData.match_date);
                      return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data';
                    })()}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-ink-2" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="theme-rebrand w-auto p-0 bg-white border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                <CalendarComponent
                  mode="single"
                  selected={parseDateString(formData.match_date) || undefined}
                  onSelect={(date) => {
                    const betDate = parseDateString(formData.bet_date);
                    if (betDate && date && isBefore(date, betDate)) {
                      return;
                    }
                    setFormData((prev) => ({ ...prev, match_date: formatDateToString(date) }));
                    setIsCreateMatchDatePopoverOpen(false);
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

          {/* Tags (col-span-2) */}
          <div className="col-span-1 sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Tags</label>
            </div>
            <TagSelector
              selectedTags={formData.selectedTags}
              onTagsChange={(tags) => setFormData((prev) => ({ ...prev, selectedTags: tags }))}
              onTagsUpdated={onTagsUpdated}
              className="w-full"
            />
          </div>

          {/* Credit bet toggle (compacto) */}
          <div className="col-span-1 sm:col-span-2 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">Crédito de apostas</span>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, is_credit_bet: !prev.is_credit_bet }))}
              style={{ backgroundColor: formData.is_credit_bet ? 'var(--forest)' : '#d1d5db' }}
              className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
              aria-pressed={formData.is_credit_bet}
            >
              <span
                style={{ transform: formData.is_credit_bet ? 'translateX(22px)' : 'translateX(2px)' }}
                className="absolute top-0.5 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform"
              />
            </button>
          </div>

          {/* Summary card (col-span-2 bg-forest-tint) */}
          <div className="col-span-1 sm:col-span-2 mt-2 grid grid-cols-3 gap-3 p-4 bg-forest-tint border border-forest/15 rounded-lg">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-forest/70 font-semibold">Stake</div>
              <div className="text-[16px] font-semibold tabular text-ink mt-0.5">
                {summary ? `R$ ${formatCurrency(summary.stake)}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-forest/70 font-semibold">Retorno potencial</div>
              <div className="text-[16px] font-semibold tabular text-forest mt-0.5">
                {summary ? `R$ ${formatCurrency(summary.retorno)}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-forest/70 font-semibold">Lucro potencial</div>
              <div className="text-[16px] font-semibold tabular text-status-success mt-0.5">
                {summary ? `+ R$ ${formatCurrency(summary.lucro)}` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line flex items-center justify-between bg-canvas/50">
          <label className="inline-flex items-center gap-2 text-[12px] text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-forest"
              checked={stayOpen}
              onChange={(e) => setStayOpen(e.target.checked)}
            />
            Cadastrar outra após salvar
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              className="h-10 px-4 text-[13px] font-medium text-ink-2 hover:bg-ink-3/60 hover:text-ink rounded-md"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!formData.bet_description || !formData.sport || !formData.odds || !formData.stake_amount}
              className="h-10 px-5 text-[13px] font-semibold text-white bg-forest hover:bg-forest-soft rounded-md"
            >
              Salvar aposta
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
