import { useNavigate, useParams } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { Ficha } from '@/components/socios/Ficha';
import { FichaEmModal } from '@/components/socios/FichaEmModal';
import { BlocoDeComportamento } from '@/components/socios/BlocoDeComportamento';
import {
  EditorDeAcesso,
  TesteDoFutebol,
  type EstadoDaEscrita,
} from '@/components/socios/EditorDeAcesso';
import { DarAssinatura, type EstadoDaConcessao } from '@/components/socios/DarAssinatura';
import { Receita, type EstadoDaReceita } from '@/components/socios/Receita';
import { PerfilDeAposta } from '@/components/socios/PerfilDeAposta';
import { LinhaDoTempo } from '@/components/socios/LinhaDoTempo';
import { PainelCrm } from '@/components/socios/PainelCrm';
import { etapaDe } from '@/components/socios/crm-funil';
import { mensagemDoErro } from '@/components/socios/crm-linha-do-tempo';
import { ROTA_DO_CRM, ROTULO_DO_PLANO } from '@/components/socios/crm-vocabulario';
import { useCadastros } from '@/hooks/use-cadastros';
import { useEtapas, useMudarEtapa } from '@/hooks/use-etapas';
import { useLinhaDoTempo, useAnotar } from '@/hooks/use-linha-do-tempo';
import { useMovimento } from '@/hooks/use-painel-do-crm';
import { useMarcasSemWhatsApp, useMarcarSemWhatsApp } from '@/hooks/use-sem-whatsapp';
import { useComportamento } from '@/hooks/use-comportamento';
import { useDefinirAcesso, useDefinirTeste } from '@/hooks/use-acesso';
import { useAssinaturas, useDarAssinatura, useEncerrarAssinatura } from '@/hooks/use-assinaturas';
import {
  useEstornarPagamento,
  usePagamentos,
  useRegistrarPagamento,
} from '@/hooks/use-pagamentos';
import { useNomeDoSocio } from '@/hooks/use-nome-do-socio';
import { usePerfilDeAposta } from '@/hooks/use-perfil-de-aposta';
import { usePessoa } from '@/hooks/use-pessoa';
import { brtDayOf, brtToday } from '@/utils/futebol-datas';

/**
 * O painel dos sócios, e a ficha por cima dele.
 *
 * Duas rotas, uma página: `/socios/crm` desenha a lista, e `/socios/crm/<id>`
 * desenha a MESMA lista com o modal aberto. Antes eram duas telas, e abrir um
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
  const marcas = useMarcasSemWhatsApp();

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
        marcas={marcas}
        hoje={brtToday()}
      />

      <FichaEmModal aberta={!!id} aoFechar={() => navegar(ROTA_DO_CRM)}>
        {/* Montado só com identificador na rota: as consultas da ficha não
            devem sair enquanto ninguém abriu ninguém. */}
        {id && <FichaDoModal id={id} />}
      </FichaEmModal>
    </>
  );
}

/**
 * O estado de uma gravação feita por mutações que nunca correm juntas.
 *
 * A ficha fazia a mesma conta duas vezes, com o mesmo ternário: lançar e
 * estornar um pagamento, e dar e encerrar uma assinatura. Cada par trava o
 * mesmo formulário enquanto grava, e o recado de erro é o da que falhou.
 */
function estadoDaGravacao(
  ...mutacoes: { isPending: boolean; isError: boolean; error: unknown }[]
): EstadoDaConcessao {
  if (mutacoes.some((m) => m.isPending)) return { tipo: 'salvando' };
  const falhou = mutacoes.find((m) => m.isError);
  return falhou ? { tipo: 'erro', recado: mensagemDoErro(falhou.error) } : { tipo: 'parado' };
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
  const marcas = useMarcasSemWhatsApp();
  const marcarSemWhatsApp = useMarcarSemWhatsApp(id);
  const linha = useLinhaDoTempo(id);
  const anotar = useAnotar(id);
  const nomeDoSocio = useNomeDoSocio();
  const acesso = useDefinirAcesso(id);
  const teste = useDefinirTeste(id);
  const cadastros = useCadastros();
  const assinaturas = useAssinaturas(cadastros.tipo === 'pronto' ? cadastros.cadastros : []);
  const darAssinatura = useDarAssinatura(id);
  const encerrarAssinatura = useEncerrarAssinatura();
  const perfil = usePerfilDeAposta(id);
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

  /** A assinatura manual aberta desta pessoa, se houver. */
  const assinaturaAberta =
    assinaturas.tipo === 'pronto'
      ? (assinaturas.assinaturas.find((a) => a.userId === id) ?? null)
      : null;

  const pagamentos = usePagamentos(assinaturaAberta?.id);
  const registrarPagamento = useRegistrarPagamento(assinaturaAberta?.id, id);
  const estornarPagamento = useEstornarPagamento(assinaturaAberta?.id, id);

  const escritaDaReceita: EstadoDaReceita = estadoDaGravacao(registrarPagamento, estornarPagamento);
  const concessao: EstadoDaConcessao = estadoDaGravacao(darAssinatura, encerrarAssinatura);

  return (
    <Ficha
      estado={estado}
      // Nulo enquanto as etapas não chegam: o seletor espera em vez de afirmar
      // que o lead é novo.
      etapa={etapas.tipo === 'pronto' ? etapaDe(etapas.etapas, id) : null}
      aoMudarEtapa={(etapa) => mudar.mutate(etapa)}
      mudandoEtapa={mudar.isPending}
      erroAoMudarEtapa={mudar.isError}
      // Enquanto as marcas não chegam vale `false`: a ficha ainda mostra o selo
      // de quem não tem número, que ela descobre sozinha no cadastro.
      marcadoSemWhatsApp={marcas.tipo === 'pronto' && marcas.marcados.has(id)}
      aoMarcarSemWhatsApp={(marcado) => marcarSemWhatsApp.mutate(marcado)}
      marcandoSemWhatsApp={marcarSemWhatsApp.isPending}
      erroAoMarcarSemWhatsApp={marcarSemWhatsApp.isError}
      hoje={hoje}
      // A mensagem de cobrança fala de uma data. Sem assinatura, ou com uma
      // vitalícia, não há data nenhuma para ela falar.
      cobranca={
        assinaturaAberta?.venceEm
          ? { plano: ROTULO_DO_PLANO[assinaturaAberta.plano], venceEm: assinaturaAberta.venceEm }
          : null
      }
      // Só com a ficha carregada: o editor abre mostrando o que JÁ vale, e sem
      // a linha do banco ele nasceria todo em branco — um convite a apagar sem
      // querer o acesso de quem já tem.
      edicaoDeAcesso={
        estado.tipo === 'pronta' ? (
          <EditorDeAcesso
            pessoa={estado.pessoa}
            escrita={escrita}
            aoSalvar={(mudanca) => acesso.mutate(mudanca)}
          />
        ) : null
      }
      // O teste em cartão próprio: ele não é um avulso, é a única coisa da aba
      // com prazo correndo.
      testeDoFutebol={
        estado.tipo === 'pronta' ? (
          <TesteDoFutebol
            pessoa={estado.pessoa}
            escrita={escrita}
            aoDefinir={(ligado) => teste.mutate(ligado)}
          />
        ) : null
      }
      // Separada dos acessos avulsos: na aba de planos as duas ficam em
      // colunas diferentes, porque são a venda e os remendos.
      assinatura={
        estado.tipo === 'pronta' ? (
          <DarAssinatura
            hoje={hoje}
            atual={
              assinaturaAberta
                ? {
                    id: assinaturaAberta.id,
                    plano: assinaturaAberta.plano,
                    venceEm: assinaturaAberta.venceEm,
                    valorMensal: assinaturaAberta.valorMensal,
                  }
                : null
            }
            estado={concessao}
            aoConceder={(plano, venceEm, valorMensal, comecouEm) =>
              darAssinatura.mutate({ plano, venceEm, valorMensal, comecouEm })
            }
            aoEncerrar={(idDaAssinatura) => encerrarAssinatura.mutate(idDaAssinatura)}
          />
        ) : null
      }
      receita={
        <Receita
          hoje={hoje}
          assinatura={
            assinaturaAberta
              ? {
                  // Vem do banco, já no dia certo, e pode ser retroativo. Antes
                  // era derivado aqui com conversão de fuso, e a fila de
                  // inadimplentes fazia a MESMA conta do lado dela.
                  comecouEm: assinaturaAberta.comecouEm,
                  valorMensal: assinaturaAberta.valorMensal,
                }
              : null
          }
          estado={pagamentos}
          escrita={escritaDaReceita}
          aoLancar={(pagamento) => registrarPagamento.mutate(pagamento)}
          aoEstornar={(idDoPagamento, motivo) =>
            estornarPagamento.mutate({ id: idDoPagamento, motivo })
          }
        />
      }
      perfilDeAposta={<PerfilDeAposta estado={perfil} />}
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
