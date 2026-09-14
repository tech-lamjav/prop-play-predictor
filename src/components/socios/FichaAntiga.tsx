import { Navigate, useParams } from 'react-router-dom';
import { ROTA_DO_CRM } from './crm-vocabulario';

/**
 * O endereço antigo da ficha, mandando para o novo.
 *
 * `/socios/<id>` abria a ficha de um lead quando o CRM morava na raiz da área.
 * Ele continua atendido porque o link circula fora do site — favorito, conversa,
 * endereço digitado de cabeça — e uma conversa em andamento não pode quebrar
 * porque a gente mexeu na estrutura de rotas.
 *
 * Vive atrás do portão, como toda rota da área: quem não é sócio recebe a página
 * de não encontrado antes de qualquer redirecionamento, para o endereço novo não
 * ser anunciado a quem não pode entrar.
 *
 * Prazo: sai quando os links antigos pararem de aparecer no acesso.
 */
export function FichaAntiga() {
  const { id } = useParams();

  return <Navigate to={id ? `${ROTA_DO_CRM}/${id}` : ROTA_DO_CRM} replace />;
}
