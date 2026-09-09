import { Settings, CreditCard, Gift, BookOpen, MessageCircle } from 'lucide-react';
import { SHOW_COMO_USAR_ENTRY_POINTS } from './como-usar';
import { WHATSAPP_FALAR_COM_O_TIME } from './contato';

/**
 * Os itens do menu da conta — a mesma lista no computador e no celular.
 *
 * A regra de desenho já estava escrita na tela de Perfil: "mesmo conteúdo nas
 * duas plataformas, formato diferente". Só que o conteúdo morava em DUAS
 * listas, uma em cada arquivo, e a regra dependia de alguém lembrar de editar
 * as duas. Não lembrou: as listas divergiram em três pontos — o celular tinha
 * um item a mais, chamava a mesma página de "Plano e pagamento" enquanto o
 * computador chamava de "Planos e preços", e mandava para um guia que o
 * computador já não oferecia.
 *
 * Agora existe uma lista só. O que muda entre as plataformas é o formato —
 * dropdown lá, tela cheia aqui — e o "Sair da conta", que cada uma desenha do
 * seu jeito e por isso não entra aqui.
 */
export type ItemDaConta = {
  label: string;
  icon: typeof Settings;
  href?: string;
  onClick?: () => void;
};

export function itensDaConta(indicarUmAmigo: () => void): ItemDaConta[] {
  return [
    { label: 'Configurações', icon: Settings, href: '/settings' },
    { label: 'Planos e preços', icon: CreditCard, href: '/planos' },
    { label: 'Indique um amigo', icon: Gift, onClick: indicarUmAmigo },
    ...(SHOW_COMO_USAR_ENTRY_POINTS
      ? [{ label: 'Como usar', icon: BookOpen, href: '/como-usar' }]
      : []),
    { label: 'Falar com o time', icon: MessageCircle, href: WHATSAPP_FALAR_COM_O_TIME },
  ];
}
