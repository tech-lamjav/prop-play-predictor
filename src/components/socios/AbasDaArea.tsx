import { Link, useLocation } from 'react-router-dom';
import { ROTA_DO_PLACAR } from '@/components/placar/placar-vocabulario';
import { ROTA_DO_CRM } from './crm-vocabulario';

/**
 * Os dois andares da área de sócios, para trocar de assunto sem sair dela.
 *
 * ⚠️ Este é o único arquivo desta pasta que sabe do placar, e é de propósito: a
 * pasta é do CRM, mas este componente é a CASCA DA ÁREA, que hospeda os dois
 * contextos. Sem ele, cada tela precisaria saber da existência da outra, que é
 * exatamente o que a casca existe para evitar.
 *
 * O que ela NÃO faz é esconder: quem protege a área é a política de linha do
 * banco, e o portão na rota.
 */
export function AbasDaArea() {
  const { pathname } = useLocation();

  /**
   * O CRM é o que sobra.
   *
   * A raiz da área redireciona para o CRM, e o endereço antigo da ficha também,
   * então qualquer caminho que não seja o do placar termina no CRM — inclusive
   * o instante em que o redirecionamento ainda não aconteceu. Testar o placar
   * pelo prefixo e deixar o CRM por último é o que impede as duas acesas ao
   * mesmo tempo.
   */
  const noPlacar = pathname.startsWith(ROTA_DO_PLACAR);

  const aparencia = (ativo: boolean) =>
    `rounded-rebrand-sm px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${
      ativo ? 'bg-ink text-white' : 'text-ink-dim hover:bg-canvas hover:text-ink'
    }`;

  return (
    <nav aria-label="Áreas dos sócios" className="flex flex-wrap gap-1">
      <Link to={ROTA_DO_CRM} className={aparencia(!noPlacar)}>
        CRM
      </Link>
      <Link to={ROTA_DO_PLACAR} className={aparencia(noPlacar)}>
        Metodologia
      </Link>
    </nav>
  );
}
