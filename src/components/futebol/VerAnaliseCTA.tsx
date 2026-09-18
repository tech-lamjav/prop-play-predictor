import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * "Ver análise completa": a afordância de que o card leva a algum lugar.
 *
 * O card inteiro sempre foi clicável, e isso não bastava — parte dos
 * assinantes lia os números, não abria nada e nunca chegava aos motivos, que
 * moram na tela do jogo. Um destino que ninguém vê é um destino que não
 * existe, ainda mais no celular, onde não há cursor para revelar o hover.
 *
 * O estilo vem de `buttonVariants`, e não de classes escritas aqui: a primeira
 * versão inventou uma combinação — fundo `canvas-2` com texto `forest`, 12px —
 * que não existe em variante nenhuma, e um botão fora do sistema é um botão
 * que ninguém consegue mudar de um lugar só depois.
 *
 * Parado ele é a variante `forest`, a ação primária do sistema; sob o cursor
 * ele passa à `amber`, o acento. As duas pontas são variantes que já existem,
 * e não uma cor de passagem inventada no meio. O `hover:` sai junto do
 * `group-hover:` de propósito: o segundo acende com o cursor em qualquer canto
 * do card, o primeiro tem o efeito colateral de apagar, pelo `tailwind-merge`,
 * o `hover:bg-forest-2` que vem na variante — sem ele, o verde mais claro e o
 * âmbar disputariam o mesmo instante, e quem ganhasse dependeria da ordem em
 * que o Tailwind escreveu o CSS.
 *
 * As MEDIDAS saem do guia do rebrand (`docs/futebol-rebrand-guia-visual.md`,
 * seção B): botão primário é `rounded-rebrand-md`, e a altura é 44px no
 * celular — os mesmos 44px que os itens dos menus de filtro usam, e que este
 * botão, nascido para o celular, era o único controle da tela a não respeitar.
 * No desktop ele encolhe para a altura de mouse, porque ali o card inteiro já
 * é o alvo e o botão é só a afordância.
 *
 * ⚠️ É um `span`, e não um `button` nem um `Link`. Quem navega é o `<Link>`
 * que embrulha o card; um controle aqui dentro seria um `<a>` dentro de outro
 * `<a>` — marcação inválida, que o React não reclama e o navegador resolve
 * fechando a âncora de fora no meio do card. Por isso quem usa precisa marcar
 * o Link com `group`, senão o botão só acende quando o cursor cai em cima
 * dele, e não no card.
 */
export function VerAnaliseCTA({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        buttonVariants({ variant: 'forest', size: 'sm' }),
        'w-full min-h-11 sm:min-h-0 rounded-rebrand-md hover:bg-amber hover:text-forest group-hover:bg-amber group-hover:text-forest',
        className,
      )}
    >
      Ver análise completa <ArrowRight />
    </span>
  );
}
