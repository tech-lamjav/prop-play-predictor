import { Link, useLocation } from 'react-router-dom';
import { ROTA_DOS_SOCIOS } from './crm-vocabulario';

export const ROTA_DOS_FEEDBACKS = `${ROTA_DOS_SOCIOS}/feedbacks`;
export const ROTA_DAS_ASSINATURAS = `${ROTA_DOS_SOCIOS}/assinaturas`;

/**
 * A faixa de identidade do painel, com as seções internas.
 *
 * Entra logo abaixo do header do site, que continua sendo o mesmo do resto do
 * produto — o painel não é um lugar à parte, é uma tela interna dele. O que
 * esta faixa faz é deixar claro que daqui para baixo o assunto é operação, e
 * não o que o assinante vê.
 *
 * Ela NÃO esconde nada: quem protege o painel é a política de linha do banco.
 */
export function CabecalhoDoCrm({ resumo }: { resumo: string }) {
  const { pathname } = useLocation();

  /**
   * "Leads" continua aceso na ficha de uma pessoa.
   *
   * Um `NavLink` normal não resolve: `/socios` é prefixo de `/socios/feedbacks`
   * também, então ou ele acende nos dois ou apaga na ficha — e a ficha É a
   * seção de leads, com o modal aberto por cima.
   *
   * Por isso as outras seções se declaram e "Leads" é o que sobra: com a lista
   * crescendo, testar cada uma pelo prefixo e deixar Leads por último é o que
   * impede que somar uma quarta seção acenda duas ao mesmo tempo.
   */
  const nosFeedbacks = pathname.startsWith(ROTA_DOS_FEEDBACKS);
  const nasAssinaturas = pathname.startsWith(ROTA_DAS_ASSINATURAS);
  const nosLeads = !nosFeedbacks && !nasAssinaturas;

  const aparencia = (ativo: boolean) =>
    `rounded-rebrand-sm px-3 py-1.5 text-[14px] font-bold transition ${
      ativo ? 'bg-forest text-white' : 'text-ink-2 hover:bg-canvas hover:text-ink'
    }`;

  return (
    <div className="border-b border-line-2 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4">
        <h1 className="font-display text-2xl font-black text-ink">CRM</h1>
        <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
          Uso interno
        </span>
        <p className="text-[13px] text-ink-2">{resumo}</p>

        {/* As seções internas ficam aqui, e não no header de cima: a navegação
            do painel não se mistura com a que o assinante vê. */}
        <nav aria-label="Seções do CRM" className="ml-auto flex flex-wrap gap-1">
          <Link to={ROTA_DOS_SOCIOS} className={aparencia(nosLeads)}>
            Leads
          </Link>
          <Link to={ROTA_DAS_ASSINATURAS} className={aparencia(nasAssinaturas)}>
            Assinaturas
          </Link>
          <Link to={ROTA_DOS_FEEDBACKS} className={aparencia(nosFeedbacks)}>
            Feedbacks
          </Link>
        </nav>
      </div>
    </div>
  );
}
