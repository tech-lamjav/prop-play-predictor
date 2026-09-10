import { Seo } from '@/components/Seo';
import { PainelCrm } from '@/components/socios/PainelCrm';
import { useTotalDeCadastros } from '@/hooks/use-total-de-cadastros';

/**
 * O painel dos sócios.
 *
 * O portão NÃO está aqui: ele embrulha a rota no App. É de propósito — quando
 * o painel ganhar a segunda e a terceira tela, quem esquecer o portão vai
 * esquecê-lo na tabela de rotas, não dentro da página. É lá que o teste olha.
 *
 * A rota não aparece em menu nenhum, não entra no sitemap e fica fora do
 * robots.txt — listar o caminho lá seria publicá-lo. Quem protege de verdade é
 * a política de linha da migration 123; a rota escondida é só conveniência.
 */
export default function PainelDosSocios() {
  const contagem = useTotalDeCadastros();

  return (
    <>
      <Seo noindex title="CRM | Smart Betting" />
      <PainelCrm contagem={contagem} />
    </>
  );
}
