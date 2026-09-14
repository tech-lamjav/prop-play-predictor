import {
  Settings,
  CreditCard,
  Gift,
  BookOpen,
  MessageCircle,
  Users,
  Gauge,
} from 'lucide-react';
import { SHOW_COMO_USAR_ENTRY_POINTS } from './como-usar';
import { WHATSAPP_FALAR_COM_O_TIME } from './contato';
import { ROTA_DO_CRM } from '@/components/socios/crm-vocabulario';
import { ROTA_DO_PLACAR } from '@/components/placar/placar-vocabulario';

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
    // Por último, e só para sócio. Quem protege a área continua sendo a
    // política de linha do banco — estes itens governam o que a tela desenha, e
    // o caminho da rota está no bundle, que é público. O que eles evitam é
    // anunciar a porta para quem não pode entrar.
    //
    // Os DOIS andares aparecem aqui, e não só o CRM. O placar nasceu alcançável
    // apenas por uma aba dentro da faixa do CRM, e o primeiro sócio a procurar
    // não achou: abriu este menu, viu CRM e concluiu que não havia mais nada.
    // Porta que existe e não se acha é porta fechada.
    ...(ehSocio
      ? [
          { label: 'CRM', icon: Users, href: ROTA_DO_CRM, interno: true },
          { label: 'Metodologia', icon: Gauge, href: ROTA_DO_PLACAR, interno: true },
        ]
      : []),
  ];
}
