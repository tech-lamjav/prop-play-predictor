import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título acessível (sr-only). */
  title: string;
  /** Classes aplicadas ao container de conteúdo. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Modal centralizado (mesmo comportamento em mobile e desktop). Usa Dialog do
 * Radix — no mobile fica quase full-width e centralizado verticalmente.
 * (Antes usava Drawer/bottom-sheet no mobile, mas o transform do vaul deixava
 * a caixa "torta" e a posição no rodapé não era desejada.)
 *
 * `block` sobrescreve o `grid` padrão do DialogContent — o grid com
 * min-width:auto estica a coluna com texto longo e estoura a largura.
 */
export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  open,
  onOpenChange,
  title,
  className,
  children,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`block ${className ?? ''}`}>
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};
