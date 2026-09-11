import { Settings, CreditCard, Gift, BookOpen, MessageCircle, Users } from 'lucide-react';
import { SHOW_COMO_USAR_ENTRY_POINTS } from './como-usar';
import { WHATSAPP_FALAR_COM_O_TIME } from './contato';
import { ROTA_DOS_SOCIOS } from '@/components/socios/crm-vocabulario';

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
  /**
   * Item de uso interno, que só sócio enxerga.
   *
   * As duas telas desenham ele separado do resto: ele não é uma coisa que o
   * assinante faz na conta dele, é uma ferramenta de quem toca a operação, e
   * misturado na mesma lista pareceria mais uma tela do produto.
   */
  interno?: boolean;
};

/**
 * Os itens da conta.
 *
 * `ehSocio` chega por parâmetro em vez de o catálogo consultar o banco: assim
 * ele continua sendo uma função pura, testável sem montar tela nem servidor, e
 * quem decide quando perguntar é quem desenha.
 *
 * O padrão é `false`, e é de propósito. Uma tela que esquecer de passar o
 * parâmetro esconde o item de um sócio, que é um incômodo; o contrário
 * mostraria a porta do painel para a base inteira.
 */
export function itensDaConta(indicarUmAmigo: () => void, ehSocio = false): ItemDaConta[] {
  return [
    { label: 'Configurações', icon: Settings, href: '/settings' },
    { label: 'Planos e preços', icon: CreditCard, href: '/planos' },
    { label: 'Indique um amigo', icon: Gift, onClick: indicarUmAmigo },
    ...(SHOW_COMO_USAR_ENTRY_POINTS
      ? [{ label: 'Como usar', icon: BookOpen, href: '/como-usar' }]
      : []),
    { label: 'Falar com o time', icon: MessageCircle, href: WHATSAPP_FALAR_COM_O_TIME },
    // Por último, e só para sócio. Quem protege o painel continua sendo a
    // política de linha do banco — este item governa o que a tela desenha, e
    // o caminho da rota está no bundle, que é público. O que ele evita é
    // anunciar a porta para quem não pode entrar.
    ...(ehSocio ? [{ label: 'CRM', icon: Users, href: ROTA_DOS_SOCIOS, interno: true }] : []),
  ];
}
