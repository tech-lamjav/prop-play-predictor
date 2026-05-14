import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopaGruposView } from './CopaGruposView';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wrapper Dialog em volta de CopaGruposView pra exibição modal
 * (usado na BolaoHome). A view também é renderizada inline na tab "Tabela"
 * do BolaoEmptyState.
 */
export const CopaGruposModal: React.FC<Props> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-rebrand-xl">
        <DialogHeader className="shrink-0 border-b border-line pb-3">
          <DialogTitle className="font-display text-[18px] font-bold text-ink">
            Tabela dos Grupos — Copa 2026
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 minimal-scrollbar pt-3">
          <CopaGruposView />
        </div>
      </DialogContent>
    </Dialog>
  );
};
