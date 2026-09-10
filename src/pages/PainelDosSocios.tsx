import { useNavigate, useParams } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { Ficha } from '@/components/socios/Ficha';
import { FichaEmModal } from '@/components/socios/FichaEmModal';
import { LinhaDoTempo } from '@/components/socios/LinhaDoTempo';
import { PainelCrm } from '@/components/socios/PainelCrm';
import { etapaDe } from '@/components/socios/crm-funil';
import { mensagemDoErro } from '@/components/socios/crm-linha-do-tempo';
import { ROTA_DOS_SOCIOS } from '@/components/socios/crm-vocabulario';
import { useCadastros } from '@/hooks/use-cadastros';
import { useEtapas, useMudarEtapa } from '@/hooks/use-etapas';
import { useLinhaDoTempo, useAnotar } from '@/hooks/use-linha-do-tempo';
import { useMovimento } from '@/hooks/use-painel-do-crm';
import { useNomeDoSocio } from '@/hooks/use-nome-do-socio';
import { usePessoa } from '@/hooks/use-pessoa';
import { brtToday } from '@/utils/futebol-datas';

/**
 * O painel dos sócios, e a ficha por cima dele.
 *
 * Duas rotas, uma página: `/socios` desenha a lista, e `/socios/<id>` desenha a
 * MESMA lista com o modal da ficha aberto. Antes eram duas telas, e abrir um
 * lead tirava você da lista — o que quebrava o ritmo do trabalho, que é abrir,
 * registrar, fechar, abrir o próximo.
 *
 * Manter o identificador na rota é o que preserva o link compartilhável entre
 * os sócios. Fechar o modal navega de volta, então o botão voltar do navegador
 * também funciona.
 *
 * Usa o header do site: o painel é uma tela interna do produto, não um lugar à
 * parte. Quem o esconde é a política de linha do banco.
 */
export default function PainelDosSocios() {
  const { id } = useParams<{ id: string }>();
  const navegar = useNavigate();

  const estado = useCadastros();
  const etapas = useEtapas();
  const movimento = useMovimento();

  return (
    <>
      <Seo noindex title="CRM | Smart Betting" />
      <AnalyticsNav />
      {/* O dia entra por prop para a tela não mudar de comportamento à
          meia-noite dentro de um teste. */}
      <PainelCrm estado={estado} etapas={etapas} movimento={movimento} hoje={brtToday()} />

      <FichaEmModal aberta={!!id} aoFechar={() => navegar(ROTA_DOS_SOCIOS)}>
        {/* Montado só com identificador na rota: as consultas da ficha não
            devem sair enquanto ninguém abriu ninguém. */}
        {id && <FichaDoModal id={id} />}
      </FichaEmModal>
    </>
  );
}

/**
 * As consultas da ficha, isoladas num componente próprio.
 *
 * Isso não é organização: é o que garante que elas só rodem quando o modal
 * abre. Se os hooks morassem na página, a ficha consultaria o banco em toda
 * visita à lista, para ninguém.
 */
function FichaDoModal({ id }: { id: string }) {
  const estado = usePessoa(id);
  const etapas = useEtapas();
  const mudar = useMudarEtapa(id);
  const linha = useLinhaDoTempo(id);
  const anotar = useAnotar(id);
  const nomeDoSocio = useNomeDoSocio();

  return (
    <Ficha
      estado={estado}
      // Nulo enquanto as etapas não chegam: o seletor espera em vez de afirmar
      // que o lead é novo.
      etapa={etapas.tipo === 'pronto' ? etapaDe(etapas.etapas, id) : null}
      aoMudarEtapa={(etapa) => mudar.mutate(etapa)}
      mudandoEtapa={mudar.isPending}
      erroAoMudarEtapa={mudar.isError}
      linhaDoTempo={
        <LinhaDoTempo
          estado={linha}
          nomeDoSocio={nomeDoSocio}
          // `mutateAsync` e não `mutate`: o formulário só limpa o campo quando a
          // gravação DÁ CERTO, e para isso ele precisa esperar.
          aoAnotar={(tipo, texto) => anotar.mutateAsync({ tipo, texto })}
          anotando={anotar.isPending}
          erroAoAnotar={anotar.error ? mensagemDoErro(anotar.error) : null}
        />
      }
    />
  );
}
