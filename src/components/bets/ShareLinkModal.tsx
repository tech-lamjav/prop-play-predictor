import React, { useEffect, useState } from 'react';
import { Link2, Copy, Loader2, Calendar as CalendarIcon, X } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useShareLink, type ShareLinkFilters } from '@/hooks/use-share-link';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  won: 'Ganhou',
  lost: 'Perdeu',
  half_won: '1/2 Green',
  half_lost: '1/2 Red',
  cashout: 'Cashout',
  void: 'Void',
};

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ShareLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ShareLinkFilters;
  userTags: Tag[];
}

function hasActiveFilters(filters: ShareLinkFilters): boolean {
  return (
    filters.status.length > 0 ||
    filters.sport.length > 0 ||
    filters.league.length > 0 ||
    filters.betting_market.length > 0 ||
    filters.selectedTags.length > 0 ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.searchQuery?.trim()
  );
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  open,
  onOpenChange,
  filters,
  userTags,
}) => {
  const { generateLink, isLoading, shareUrl, reset } = useShareLink();

  const [localDateFrom, setLocalDateFrom] = useState<string>(filters.dateFrom || '');
  const [localDateTo, setLocalDateTo] = useState<string>(filters.dateTo || '');
  const [localTags, setLocalTags] = useState<string[]>(filters.selectedTags || []);
  const [isDateFromOpen, setIsDateFromOpen] = useState(false);
  const [isDateToOpen, setIsDateToOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      reset();
      setLocalDateFrom(filters.dateFrom || '');
      setLocalDateTo(filters.dateTo || '');
      setLocalTags(filters.selectedTags || []);
    }
  }, [open, reset, filters.dateFrom, filters.dateTo, filters.selectedTags]);

  const handleGenerate = async () => {
    const mergedFilters: ShareLinkFilters = {
      ...filters,
      dateFrom: localDateFrom,
      dateTo: localDateTo,
      selectedTags: localTags,
    };
    try {
      await generateLink(mergedFilters);
      toast.success('Link gerado com sucesso!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao gerar link');
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copiado!');
  };

  const displayFilters: ShareLinkFilters = {
    ...filters,
    dateFrom: localDateFrom,
    dateTo: localDateTo,
    selectedTags: localTags,
  };
  const activeFilters = hasActiveFilters(displayFilters);

  const filterChips: { label: string }[] = [];
  displayFilters.status.forEach((v) => {
    filterChips.push({ label: STATUS_LABELS[v] || v });
  });
  displayFilters.sport.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  displayFilters.league.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  displayFilters.betting_market.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  displayFilters.selectedTags.forEach((tagId) => {
    const tag = userTags.find((t) => t.id === tagId);
    filterChips.push({ label: tag?.name || tagId });
  });
  if (displayFilters.dateFrom) filterChips.push({ label: `De ${displayFilters.dateFrom}` });
  if (displayFilters.dateTo) filterChips.push({ label: `Até ${displayFilters.dateTo}` });
  if (displayFilters.searchQuery?.trim()) filterChips.push({ label: `Busca: "${displayFilters.searchQuery.trim()}"` });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text max-w-md">
        <DialogHeader>
          <DialogTitle className="text-terminal-green flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Compartilhar apostas
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {filterChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filterChips.map((chip, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-terminal-gray border-terminal-border text-terminal-text text-xs"
                >
                  {chip.label}
                </Badge>
              ))}
            </div>
          )}
          {!activeFilters && (
            <p className="text-xs text-terminal-yellow/90">
              Este link compartilhará todas as suas apostas.
            </p>
          )}
          {/* Período */}
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-terminal-text opacity-70 uppercase">Período</p>
            <div className="flex gap-2">
              <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen} modal>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 terminal-input text-xs justify-start h-auto py-1.5">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {localDateFrom
                      ? format(new Date(localDateFrom + 'T12:00:00'), 'dd/MM/yyyy')
                      : 'Data inicial'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border">
                  <Calendar
                    mode="single"
                    selected={localDateFrom ? new Date(localDateFrom + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      setLocalDateFrom(date ? format(date, 'yyyy-MM-dd') : '');
                      setIsDateFromOpen(false);
                      if (!localDateTo) setIsDateToOpen(true);
                    }}
                    className="bg-terminal-dark-gray"
                  />
                </PopoverContent>
              </Popover>

              <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen} modal>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 terminal-input text-xs justify-start h-auto py-1.5">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {localDateTo
                      ? format(new Date(localDateTo + 'T12:00:00'), 'dd/MM/yyyy')
                      : 'Data final'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border">
                  <Calendar
                    mode="single"
                    selected={localDateTo ? new Date(localDateTo + 'T12:00:00') : undefined}
                    disabled={(date) => localDateFrom ? isBefore(date, new Date(localDateFrom + 'T12:00:00')) : false}
                    onSelect={(date) => {
                      setLocalDateTo(date ? format(date, 'yyyy-MM-dd') : '');
                      setIsDateToOpen(false);
                    }}
                    className="bg-terminal-dark-gray"
                  />
                </PopoverContent>
              </Popover>

              {(localDateFrom || localDateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalDateFrom('');
                    setLocalDateTo('');
                  }}
                  className="p-1.5 terminal-button border-terminal-border hover:border-terminal-red text-terminal-text hover:text-terminal-red transition-colors"
                  aria-label="Limpar período"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          {userTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-terminal-text opacity-70 uppercase">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {userTags.map((tag) => {
                  const selected = localTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setLocalTags((prev) =>
                          selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                        )
                      }
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        selected
                          ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
                          : 'border-terminal-border text-terminal-text hover:border-terminal-green/50'
                      }`}
                      style={selected && tag.color ? { borderColor: tag.color, color: tag.color } : {}}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!shareUrl ? (
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full terminal-button border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-terminal-black"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Gerando...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Gerar link
                </>
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="bg-terminal-black border-terminal-border text-terminal-text text-xs"
              />
              <Button
                onClick={handleCopy}
                variant="outline"
                size="icon"
                className="shrink-0 terminal-button border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-terminal-black"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
