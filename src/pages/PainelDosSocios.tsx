import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { PainelCrm } from '@/components/socios/PainelCrm';
import { useCadastros } from '@/hooks/use-cadastros';
import { useEtapas } from '@/hooks/use-etapas';
import { useMovimento } from '@/hooks/use-painel-do-crm';
import { brtToday } from '@/utils/futebol-datas';

/**
 * O painel dos sócios.
 *
 * Usa o header do site, e não um cabeçalho próprio: o painel é uma tela interna
 * do produto, não um lugar à parte. Quem o esconde é a política de linha do
 * banco — a rota fora do menu é conveniência, e o header não muda isso.
 *
 * A rota não entra no sitemap e fica fora do robots.txt, porque listar o
 * caminho lá seria publicá-lo.
 */
export default function PainelDosSocios() {
  const estado = useCadastros();
  const etapas = useEtapas();
  const movimento = useMovimento();

  return (
    <>
      <Seo noindex title="CRM | Smart Betting" />
      <AnalyticsNav />
      {/* O dia entra por prop para a tela não mudar de comportamento à
          meia-noite dentro de um teste. */}
      <PainelCrm
        estado={estado}
        etapas={etapas}
        movimento={movimento}
        hoje={brtToday()}
      />
    </>
  );
}
