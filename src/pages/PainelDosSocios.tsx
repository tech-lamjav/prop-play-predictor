import { useNavigate, useParams } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { Ficha } from '@/components/socios/Ficha';
import { FichaEmModal } from '@/components/socios/FichaEmModal';
import { BlocoDeComportamento } from '@/components/socios/BlocoDeComportamento';
import { EditorDeAcesso, type EstadoDaEscrita } from '@/components/socios/EditorDeAcesso';
import { DarAssinatura, type EstadoDaConcessao } from '@/components/socios/DarAssinatura';
import { LinhaDoTempo } from '@/components/socios/LinhaDoTempo';
import { PainelCrm } from '@/components/socios/PainelCrm';
import { etapaDe } from '@/components/socios/crm-funil';
import { mensagemDoErro } from '@/components/socios/crm-linha-do-tempo';
import { ROTA_DOS_SOCIOS } from '@/components/socios/crm-vocabulario';
import { useCadastros } from '@/hooks/use-cadastros';
import { useEtapas, useMudarEtapa } from '@/hooks/use-etapas';
import { useLinhaDoTempo, useAnotar } from '@/hooks/use-linha-do-tempo';
import { useMovimento } from '@/hooks/use-painel-do-crm';
import { useComportamento } from '@/hooks/use-comportamento';
import { useDefinirAcesso, useDefinirTeste } from '@/hooks/use-acesso';
import { useAssinaturas, useDarAssinatura, useEncerrarAssinatura } from '@/hooks/use-assinaturas';
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
  const acesso = useDefinirAcesso(id);
  const teste = useDefinirTeste(id);
  const cadastros = useCadastros();
  const assinaturas = useAssinaturas(cadastros.tipo === 'pronto' ? cadastros.cadastros : []);
  const darAssinatura = useDarAssinatura(id);
  const encerrarAssinatura = useEncerrarAssinatura();
  const comportamento = useComportamento(
    id,
    estado.tipo === 'pronta' ? estado.pessoa.email : undefined,
  );

  /**
   * Quem está gravando neste instante, e não "está gravando".
   *
   * O alvo importa: com um booleano, salvar o Betinho travaria as três linhas
   * do editor e o teste junto, e a tela pareceria congelada. `variables` é o
   * que a mutação recebeu, então ele diz qual produto está em voo.
   */
  const escrita: EstadoDaEscrita = acesso.isPending
    ? { tipo: 'salvando', alvo: acesso.variables.produto }
    : teste.isPending
      ? { tipo: 'salvando', alvo: 'teste' }
      : acesso.isError
        ? {
            tipo: 'erro',
            alvo: acesso.variables?.produto ?? '',
            recado: mensagemDoErro(acesso.error),
          }
        : teste.isError
          ? { tipo: 'erro', alvo: 'teste', recado: mensagemDoErro(teste.error) }
          : { tipo: 'parado' };

  // Lido aqui, e não recebido por prop como no painel: a ficha só existe
  // enquanto o modal está aberto, então não há teste dela que atravesse a
  // meia-noite, e passar o dia por três níveis de componente custaria mais.
  const hoje = brtToday();

  /** A cortesia aberta desta pessoa, se houver. */
  const cortesia =
    assinaturas.tipo === 'pronto'
      ? (assinaturas.assinaturas.find((a) => a.userId === id) ?? null)
      : null;

  const concessao: EstadoDaConcessao =
    darAssinatura.isPending || encerrarAssinatura.isPending
      ? { tipo: 'salvando' }
      : darAssinatura.isError || encerrarAssinatura.isError
        ? { tipo: 'erro', recado: mensagemDoErro(darAssinatura.error ?? encerrarAssinatura.error) }
        : { tipo: 'parado' };

  return (
    <Ficha
      estado={estado}
      // Nulo enquanto as etapas não chegam: o seletor espera em vez de afirmar
      // que o lead é novo.
      etapa={etapas.tipo === 'pronto' ? etapaDe(etapas.etapas, id) : null}
      aoMudarEtapa={(etapa) => mudar.mutate(etapa)}
      mudandoEtapa={mudar.isPending}
      erroAoMudarEtapa={mudar.isError}
      // Só com a ficha carregada: o editor abre mostrando o que JÁ vale, e sem
      // a linha do banco ele nasceria todo em branco — um convite a apagar sem
      // querer o acesso de quem já tem.
      edicaoDeAcesso={
        estado.tipo === 'pronta' ? (
          <EditorDeAcesso
            pessoa={estado.pessoa}
            escrita={escrita}
            aoSalvar={(mudanca) => acesso.mutate(mudanca)}
            aoDefinirTeste={(ligado) => teste.mutate(ligado)}
            assinatura={
              <DarAssinatura
                hoje={hoje}
                atual={
                  cortesia
                    ? { id: cortesia.id, plano: cortesia.plano, venceEm: cortesia.venceEm }
                    : null
                }
                estado={concessao}
                aoConceder={(plano, venceEm) => darAssinatura.mutate({ plano, venceEm })}
                aoEncerrar={(idDaCortesia) => encerrarAssinatura.mutate(idDaCortesia)}
              />
            }
          />
        ) : null
      }
      comportamento={
        <BlocoDeComportamento
          estado={comportamento}
          cadastradoEm={estado.tipo === 'pronta' ? estado.pessoa.created_at : null}
        />
      }
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
