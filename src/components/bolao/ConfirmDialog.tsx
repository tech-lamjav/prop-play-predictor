import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
 * Usado em: sair do bolão, zerar palpite, remover membro (futuro).
 *
 * UX: variante destructive deixa o botão de confirmar vermelho pra
 * sinalizar irreversibilidade. Foco inicial no botão Cancelar (mais
 * seguro — Enter não dispara ação destrutiva por engano).
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
        className={`bg-terminal-bg max-w-md ${
          isDestructive ? 'border-terminal-red/40' : 'border-terminal-border'
        }`}
      >
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isDestructive ? 'text-terminal-red' : ''}`}>
            {isDestructive && <AlertTriangle className="w-5 h-5" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        {description && (
          <div className="text-sm opacity-80 leading-relaxed">{description}</div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-11 px-4"
            // Foco inicial fica aqui — Enter aciona Cancelar (mais seguro)
            autoFocus
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={`h-11 px-4 font-bold ${
              isDestructive
                ? 'bg-terminal-red text-terminal-bg hover:bg-terminal-red/90'
                : 'bg-terminal-blue text-terminal-bg hover:bg-terminal-blue/90'
            }`}
          >
            {isLoading ? 'Processando...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
