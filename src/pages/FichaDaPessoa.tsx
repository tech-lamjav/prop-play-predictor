import { useParams } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Ficha } from '@/components/socios/Ficha';
import { LinhaDoTempo } from '@/components/socios/LinhaDoTempo';
import { etapaDe } from '@/components/socios/crm-funil';
import { mensagemDoErro } from '@/components/socios/crm-linha-do-tempo';
import { usePessoa } from '@/hooks/use-pessoa';
import { useEtapas, useMudarEtapa } from '@/hooks/use-etapas';
import { useLinhaDoTempo, useAnotar } from '@/hooks/use-linha-do-tempo';
import { useNomeDoSocio } from '@/hooks/use-nome-do-socio';

/**
 * A ficha de uma pessoa, no painel dos sócios.
 *
 * Rota própria e não painel lateral: o endereço vira compartilhável entre os
 * sócios, que é o que faz um "olha esse aqui" no WhatsApp funcionar.
 */
export default function FichaDaPessoa() {
  const { id } = useParams<{ id: string }>();
  const estado = usePessoa(id);
  const etapas = useEtapas();
  const mudar = useMudarEtapa(id);
  const linha = useLinhaDoTempo(id);
  const anotar = useAnotar(id);
  const nomeDoSocio = useNomeDoSocio();

  return (
    <>
      <Seo noindex title="CRM | Smart Betting" />
      <Ficha
        estado={estado}
        // Nulo enquanto as etapas não chegam: o seletor espera em vez de
        // afirmar que o lead é novo.
        etapa={etapas.tipo === 'pronto' ? etapaDe(etapas.etapas, id ?? '') : null}
        aoMudarEtapa={(etapa) => mudar.mutate(etapa)}
        mudandoEtapa={mudar.isPending}
        erroAoMudarEtapa={mudar.isError}
        linhaDoTempo={
          <LinhaDoTempo
            estado={linha}
            nomeDoSocio={nomeDoSocio}
            // `mutateAsync` e não `mutate`: o formulário só limpa o campo
            // quando a gravação DÁ CERTO, e para isso ele precisa esperar.
            aoAnotar={(tipo, texto) => anotar.mutateAsync({ tipo, texto })}
            anotando={anotar.isPending}
            erroAoAnotar={anotar.error ? mensagemDoErro(anotar.error) : null}
          />
        }
      />
    </>
  );
}
