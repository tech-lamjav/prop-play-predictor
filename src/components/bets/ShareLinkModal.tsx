import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const STATUS_CHAVES: Record<string, string> = {
  pending: 'status.pendente',
  won: 'status.ganhou',
  lost: 'status.perdeu',
  half_won: 'status.meioGreen',
  half_lost: 'status.meioRed',
  cashout: 'status.cashout',
  void: 'status.void',
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
  const { t } = useTranslation('apostas');
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
      toast.success(t('compartilhar.linkGerado'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('compartilhar.falhaLink'));
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    toast.success(t('compartilhar.linkCopiado'));
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
    filterChips.push({ label: STATUS_CHAVES[v] ? t(STATUS_CHAVES[v]) : v });
  });
  displayFilters.sport.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  displayFilters.league.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  displayFilters.betting_market.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  displayFilters.selectedTags.forEach((tagId) => {
    const tag = userTags.find((t) => t.id === tagId);
    filterChips.push({ label: tag?.name || tagId });
  });
  if (displayFilters.dateFrom) filterChips.push({ label: t('compartilhar.de', { data: displayFilters.dateFrom }) });
  if (displayFilters.dateTo) filterChips.push({ label: t('compartilhar.ate', { data: displayFilters.dateTo }) });
  if (displayFilters.searchQuery?.trim()) filterChips.push({ label: t('compartilhar.busca', { termo: displayFilters.searchQuery.trim() }) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-rebrand bg-white border-line text-ink max-w-md shadow-[0_30px_60px_-20px_rgba(0,0,0,0.15)]">
        <DialogHeader>
          <div className="text-[11px] uppercase tracking-[0.16em] text-forest font-semibold">{t('compartilhar.etiqueta')}</div>
          <DialogTitle className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-ink">
            <Link2 className="w-4 h-4 text-forest" />
            {t('compartilhar.titulo')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {filterChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filterChips.map((chip, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-canvas-2 border-line text-ink text-xs"
                >
                  {chip.label}
                </Badge>
              ))}
            </div>
          )}
          {!activeFilters && (
            <p className="text-xs text-status-warning">
              {t('compartilhar.aviso')}
            </p>
          )}
          {/* Período */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-ink-2 uppercase tracking-[0.12em]">{t('compartilhar.periodo')}</p>
            <div className="flex gap-2">
              <Popover open={isDateFromOpen} onOpenChange={setIsDateFromOpen} modal>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 h-10 bg-canvas border-line text-ink rounded-md hover:bg-canvas-2 hover:text-ink text-xs justify-start py-1.5">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-forest" />
                    {localDateFrom
                      ? format(new Date(localDateFrom + 'T12:00:00'), 'dd/MM/yyyy')
                      : t('compartilhar.dataInicial')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="theme-rebrand w-auto p-0 bg-white border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                  <Calendar
                    mode="single"
                    selected={localDateFrom ? new Date(localDateFrom + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      setLocalDateFrom(date ? format(date, 'yyyy-MM-dd') : '');
                      setIsDateFromOpen(false);
                      if (!localDateTo) setIsDateToOpen(true);
                    }}
                    className="bg-white"
                    classNames={{
                      caption_label: 'text-sm font-semibold text-ink',
                      nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-canvas-2 hover:text-ink rounded-md inline-flex items-center justify-center',
                      head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                      day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-canvas-2 rounded-md aria-selected:opacity-100',
                      day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                      day_today: 'bg-canvas-2 text-ink font-semibold',
                      day_outside: 'text-ink-2 opacity-40',
                      day_disabled: 'text-ink-2 opacity-30',
                    }}
                  />
                </PopoverContent>
              </Popover>

              <Popover open={isDateToOpen} onOpenChange={setIsDateToOpen} modal>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 h-10 bg-canvas border-line text-ink rounded-md hover:bg-canvas-2 hover:text-ink text-xs justify-start py-1.5">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-forest" />
                    {localDateTo
                      ? format(new Date(localDateTo + 'T12:00:00'), 'dd/MM/yyyy')
                      : t('compartilhar.dataFinal')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="theme-rebrand w-auto p-0 bg-white border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                  <Calendar
                    mode="single"
                    selected={localDateTo ? new Date(localDateTo + 'T12:00:00') : undefined}
                    disabled={(date) => localDateFrom ? isBefore(date, new Date(localDateFrom + 'T12:00:00')) : false}
                    onSelect={(date) => {
                      setLocalDateTo(date ? format(date, 'yyyy-MM-dd') : '');
                      setIsDateToOpen(false);
                    }}
                    className="bg-white"
                    classNames={{
                      caption_label: 'text-sm font-semibold text-ink',
                      nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-canvas-2 hover:text-ink rounded-md inline-flex items-center justify-center',
                      head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                      day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-canvas-2 rounded-md aria-selected:opacity-100',
                      day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                      day_today: 'bg-canvas-2 text-ink font-semibold',
                      day_outside: 'text-ink-2 opacity-40',
                      day_disabled: 'text-ink-2 opacity-30',
                    }}
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
                  className="p-1.5 rounded-md border border-line bg-white hover:border-status-danger text-ink-2 hover:text-status-danger transition-colors"
                  aria-label={t('compartilhar.limparPeriodo')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          {userTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-ink-2 uppercase tracking-[0.12em]">{t('compartilhar.etiquetas')}</p>
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
                      className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                        selected
                          ? 'border-forest bg-forest/10 text-forest'
                          : 'border-line bg-canvas text-ink hover:border-forest/50'
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
              className="w-full h-10 bg-forest hover:bg-forest-soft text-white font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t('compartilhar.gerando')}
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  {t('compartilhar.gerarLink')}
                </>
              )}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="h-10 bg-canvas border-line text-ink rounded-md text-xs"
              />
              <Button
                onClick={handleCopy}
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10 border-line bg-white text-forest hover:bg-forest hover:text-white"
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
