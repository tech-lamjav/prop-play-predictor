import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  isLoading?: boolean;
}

/**
 * ConfirmDialog reusável pra ações destrutivas/irreversíveis.
 *
 * Usado em: sair do bolão, zerar palpite, aplicar Quick Pick (substitui),
 * remover membro etc. Variante destructive deixa o botão de confirmar
 * vermelho. Foco inicial no Cancelar (Enter não dispara ação destrutiva).
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  isLoading,
}) => {
  const isDestructive = variant === 'destructive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`theme-bolao bg-canvas w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md p-5 rounded-rebrand-xl border ${
          isDestructive ? 'border-status-danger/30' : 'border-line'
        }`}
      >
        <DialogHeader>
          <DialogTitle
            className={`flex items-center gap-2 font-display text-[18px] font-bold pr-6 ${
              isDestructive ? 'text-status-danger' : 'text-ink'
            }`}
          >
            {isDestructive && <AlertTriangle className="w-5 h-5 shrink-0" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        {description && (
          <div className="text-[13px] text-ink-2 leading-relaxed">{description}</div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            // Foco inicial fica aqui — Enter aciona Cancelar (mais seguro)
            autoFocus
            className="h-11 px-4 rounded-rebrand-md text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-canvas-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`h-11 px-5 rounded-rebrand-md text-[13px] font-bold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-status-danger hover:bg-status-danger/90'
                : 'bg-forest hover:bg-forest-2'
            }`}
          >
            {isLoading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
