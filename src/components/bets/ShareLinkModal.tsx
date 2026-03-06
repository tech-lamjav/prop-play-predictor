import React, { useEffect } from 'react';
import { Link2, Copy, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handleGenerate = async () => {
    try {
      await generateLink(filters);
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

  const activeFilters = hasActiveFilters(filters);

  const filterChips: { label: string }[] = [];
  filters.status.forEach((v) => {
    filterChips.push({ label: STATUS_LABELS[v] || v });
  });
  filters.sport.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  filters.league.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  filters.betting_market.filter((v) => v !== '__empty__').forEach((v) => filterChips.push({ label: v }));
  filters.selectedTags.forEach((tagId) => {
    const tag = userTags.find((t) => t.id === tagId);
    filterChips.push({ label: tag?.name || tagId });
  });
  if (filters.dateFrom) filterChips.push({ label: `De ${filters.dateFrom}` });
  if (filters.dateTo) filterChips.push({ label: `Até ${filters.dateTo}` });
  if (filters.searchQuery?.trim()) filterChips.push({ label: `Busca: "${filters.searchQuery.trim()}"` });

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
