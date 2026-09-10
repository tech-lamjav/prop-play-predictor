import { useParams } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Ficha } from '@/components/socios/Ficha';
import { usePessoa } from '@/hooks/use-pessoa';

/**
 * A ficha de uma pessoa, no painel dos sócios.
 *
 * Rota própria e não painel lateral: o endereço vira compartilhável entre os
 * sócios, que é o que faz um "olha esse aqui" no WhatsApp funcionar.
 */
export default function FichaDaPessoa() {
  const { id } = useParams<{ id: string }>();
  const estado = usePessoa(id);

  return (
    <>
      <Seo noindex title="CRM | Smart Betting" />
      <Ficha estado={estado} />
    </>
  );
}
