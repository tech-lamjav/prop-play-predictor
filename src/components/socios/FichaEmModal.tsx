import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * A ficha por cima da lista, e não no lugar dela.
 *
 * O formato saiu de um protótipo de três variações (branch
 * `prototype/ficha-do-lead`): o modal em duas colunas ganhou. A razão prática é
 * o ritmo do trabalho — abrir um lead, registrar, fechar, abrir o próximo. Com
 * a ficha em página separada, cada lead custava sair da lista e voltar, e o fio
 * se perdia no caminho.
 *
 * ⚠️ O endereço continua sendo `/socios/<id>`, e isso é de propósito: a ficha
 * precisa ser compartilhável entre os sócios — um "olha esse aqui" no WhatsApp
 * só funciona com link. O que mudou foi o que a rota DESENHA: o painel com o
 * modal aberto por cima, em vez de outra tela. Fechar volta para `/socios`, e o
 * botão voltar do navegador funciona sozinho.
 */
export function FichaEmModal({
  aberta,
  aoFechar,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={aberta} onOpenChange={(aberto) => !aberto && aoFechar()}>
      {/* O tema entra aqui também, e não só no painel: o modal sai por portal,
          fora da árvore da página, então não herda a classe de lá. */}
      {/* `max-w-6xl` e não `5xl`: com a coluna da esquerda a 360px, o 5xl
          espremia os contatos a ponto de "E-mail" quebrar em duas linhas. */}
      <DialogContent className="theme-bolao max-w-6xl gap-0 overflow-hidden bg-canvas p-0 text-ink">
        {/* O título existe para o leitor de tela: o Radix avisa no console
            quando falta, e sem ele quem navega por teclado não sabe o que
            abriu. Some da vista sem sumir da árvore de acessibilidade. */}
        <DialogTitle className="sr-only">Ficha do lead</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
