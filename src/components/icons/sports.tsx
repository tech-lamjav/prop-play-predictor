/**
 * Ícones de esporte próprios.
 *
 * O lucide não tem bola de futebol nem de basquete, e os substitutos genéricos
 * confundem: `Goal` desenha uma bandeira com espiral (lê como "alvo") e usar
 * `BarChart3` pra NBA repetia o mesmo glifo de "Análises" no mesmo cabeçalho.
 *
 * Nasceram no hub `/inicio` e foram extraídos pra cá quando o header passou a
 * precisar dos mesmos — os dois lugares têm que mostrar a mesma marca por
 * produto.
 */

interface SportIconProps {
  className?: string;
  strokeWidth?: number;
}

export function IconSoccer({ className, strokeWidth = 1.8 }: SportIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8.6l3.1 2.3-1.2 3.7h-3.8L8.9 10.9z" />
      <path d="M12 8.6V3M15.1 10.9l4.7-1.9M13.9 14.6l3 4M10.1 14.6l-3 4M8.9 10.9L4.2 9" />
    </svg>
  );
}

export function IconBasketball({ className, strokeWidth = 1.8 }: SportIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20M2 12h20" />
      <path d="M5 4.5c3 3 3 12 0 15M19 4.5c-3 3-3 12 0 15" />
    </svg>
  );
}
