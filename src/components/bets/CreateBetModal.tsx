import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parse, isValid, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagSelector } from '@/components/bets/TagSelector';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

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
  odds: string;
  stake_amount: string;
  bet_date: string;
  match_date: string;
  selectedTagIds: string[];
}

interface CreateBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: CreateBetFormData) => Promise<boolean>;
  sportsList: string[];
  leaguesList: string[];
  userTags: CreateBetTag[];
  onTagsUpdated?: () => void;
}

const getDefaultFormData = (): CreateBetFormData => ({
  bet_description: '',
  match_description: '',
  sport: '',
  league: '',
  odds: '',
  stake_amount: '',
  bet_date: new Date().toISOString().split('T')[0],
  match_date: '',
  selectedTagIds: [],
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

type CreateBetFormState = Omit<CreateBetFormData, 'selectedTagIds'> & { selectedTags: CreateBetTag[] };

const getDefaultFormState = (): CreateBetFormState => {
  const { selectedTagIds: _, ...rest } = getDefaultFormData();
  return { ...rest, selectedTags: [] };
};

export const CreateBetModal: React.FC<CreateBetModalProps> = ({
  open,
  onOpenChange,
  onCreate,
  sportsList,
  leaguesList,
  userTags: _userTags,
  onTagsUpdated,
}) => {
  const [formData, setFormData] = useState<CreateBetFormState>(getDefaultFormState());
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

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleCreate = async () => {
    const payload: CreateBetFormData = {
      ...formData,
      selectedTagIds: formData.selectedTags.map((t) => t.id),
    };
    const success = await onCreate(payload);
    if (success) {
      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-terminal-green">
            <Plus className="w-4 h-4" />
            NOVA APOSTA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase opacity-70">Descrição *</Label>
            <Input
              value={formData.bet_description}
              onChange={(e) => setFormData((prev) => ({ ...prev, bet_description: e.target.value }))}
              className="bg-terminal-black border-terminal-border text-terminal-text"
              placeholder="Ex: Over 2.5 gols"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase opacity-70">Partida (opcional)</Label>
            <Input
              value={formData.match_description}
              onChange={(e) => setFormData((prev) => ({ ...prev, match_description: e.target.value }))}
              className="bg-terminal-black border-terminal-border text-terminal-text"
              placeholder="Ex: Flamengo x Palmeiras"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase opacity-70">Esporte *</Label>
              <div className="relative">
                <Input
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
                  placeholder="Selecione ou digite o esporte"
                  className="bg-terminal-black border-terminal-border text-terminal-text"
                />
                {isCreateSportDropdownOpen && formData.sport && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded border border-terminal-border bg-terminal-dark-gray">
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
                          className={`w-full text-left px-3 py-2 text-sm text-terminal-text hover:bg-terminal-black ${
                            index === createSportHighlightIndex ? 'bg-terminal-black' : ''
                          }`}
                        >
                          {sport}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs opacity-60">Nenhum esporte encontrado</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase opacity-70">Liga (opcional)</Label>
              <div className="relative">
                <Input
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
                  placeholder="Selecione ou digite a liga"
                  className="bg-terminal-black border-terminal-border text-terminal-text"
                />
                {isCreateLeagueDropdownOpen && formData.league && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded border border-terminal-border bg-terminal-dark-gray">
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
                          className={`w-full text-left px-3 py-2 text-sm text-terminal-text hover:bg-terminal-black ${
                            index === createLeagueHighlightIndex ? 'bg-terminal-black' : ''
                          }`}
                        >
                          {league}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs opacity-60">Nenhuma liga encontrada</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase opacity-70">Valor *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.stake_amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, stake_amount: e.target.value }))}
                className="bg-terminal-black border-terminal-border text-terminal-text"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase opacity-70">Odds *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.odds}
                onChange={(e) => setFormData((prev) => ({ ...prev, odds: e.target.value }))}
                className="bg-terminal-black border-terminal-border text-terminal-text"
                placeholder="1.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase opacity-70">Data da Aposta</Label>
            <Popover open={isCreateDatePopoverOpen} onOpenChange={setIsCreateDatePopoverOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal bg-terminal-black border-terminal-border text-terminal-text hover:bg-terminal-gray"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {(() => {
                    const date = parseDateString(formData.bet_date);
                    return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data';
                  })()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border">
                <CalendarComponent
                  mode="single"
                  selected={parseDateString(formData.bet_date) || undefined}
                  onSelect={(date) => {
                    setFormData((prev) => ({ ...prev, bet_date: formatDateToString(date) }));
                    setIsCreateDatePopoverOpen(false);
                  }}
                  initialFocus
                  className="bg-terminal-dark-gray"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase opacity-70">Data da Partida (opcional)</Label>
            <Popover open={isCreateMatchDatePopoverOpen} onOpenChange={setIsCreateMatchDatePopoverOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal bg-terminal-black border-terminal-border text-terminal-text hover:bg-terminal-gray"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {(() => {
                    const date = parseDateString(formData.match_date);
                    return date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data';
                  })()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border">
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
                  className="bg-terminal-dark-gray"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase opacity-70">Tags (opcional)</Label>
            <TagSelector
              selectedTags={formData.selectedTags}
              onTagsChange={(tags) => setFormData((prev) => ({ ...prev, selectedTags: tags }))}
              onTagsUpdated={onTagsUpdated}
              className="w-full"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleOpenChange(false)}
              variant="outline"
              className="flex-1 border-terminal-border hover:bg-terminal-gray text-terminal-text"
            >
              CANCELAR
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.bet_description || !formData.sport || !formData.odds || !formData.stake_amount}
              className="flex-1 bg-terminal-green hover:bg-terminal-green-bright text-white"
            >
              CADASTRAR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
