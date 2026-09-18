import { useMemo, useState } from 'react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { CabecalhoDoCrm } from '@/components/socios/CabecalhoDoCrm';
import { ListaDeCobranca } from '@/components/socios/ListaDeCobranca';
import {
  ListaDeInadimplentes,
  type EstadoDosInadimplentes,
} from '@/components/socios/ListaDeInadimplentes';
import { ListaDoStripe, type EstadoDoStripe } from '@/components/socios/ListaDoStripe';
import {
  aCobrar,
  DIAS_PARA_COBRAR,
  inadimplentes,
  saiuParaOCartao,
} from '@/components/socios/crm-assinatura';
import { assinaturasDoStripe } from '@/components/socios/crm-assinatura-do-stripe';
import { useAssinaturas, type EstadoDasAssinaturas } from '@/hooks/use-assinaturas';
import { useCadastros } from '@/hooks/use-cadastros';
import { usePagamentosDasAssinaturas } from '@/hooks/use-pagamentos';
import { brtToday } from '@/utils/futebol-datas';

/**
 * Qual fatia da fila a tela mostra.
 *
 * "A cobrar" é o padrão porque é o trabalho: quem vence nos próximos sete dias
 * e quem já venceu. "Devendo" é a outra pergunta de dinheiro, a de quem parou
 * de pagar. "Todas" existe para conferir o que foi dado, que é uma terceira
 * pergunta e não deveria disputar espaço com as duas primeiras.
 */
type Recorte = 'cobrar' | 'devendo' | 'todas' | 'cartao';

const RECORTES: { id: Recorte; rotulo: string; explicacao: string }[] = [
  {
    id: 'cobrar',
    rotulo: 'A cobrar',
    explicacao: `quem vence nos próximos ${DIAS_PARA_COBRAR} dias, e quem já venceu`,
  },
  {
    id: 'devendo',
    rotulo: 'Devendo',
    explicacao: 'quem tem cobrança mensal e mês em aberto, do que deve mais para o que deve menos',
  },
  { id: 'todas', rotulo: 'Todas', explicacao: 'todas as assinaturas manuais abertas' },
  /*
   * ⚠️ Recorte PRÓPRIO, e não misturado em "Todas".
   *
   * "Todas" promete assinaturas dadas na mão, e é assim que a explicação dele
   * está escrita. Juntar as duas origens num número só faria os dois números da
   * mesma tela se desmentirem — o mesmo defeito que a revisão pegou na dívida
   * truncada.
   *
   * E há uma diferença de fundo: as três primeiras respondem "quem eu preciso
   * cobrar", que é trabalho do sócio. Esta responde "quem está pagando sozinho",
   * que é acompanhamento.
   */
  { id: 'cartao', rotulo: 'No cartão', explicacao: 'quem assina pelo gateway, e quando renova' },
];

/**
 * As assinaturas que a gente deu na mão.
 *
 * Seção própria ao lado de Leads e Feedbacks porque é uma terceira pergunta:
 * a lista de leads responde "com quem eu falo agora", a de feedbacks responde
 * "o que estão achando", e esta responde "quem eu preciso cobrar".
 *
 * Ela existe porque uma assinatura dada na mão NÃO renova sozinha e o Pix não
 * passa pelo Stripe. Sem um lugar que junte quem está vencendo e quem parou de
 * pagar, o acesso some um dia, ou fica de graça para sempre, e ninguém nota.
 */
export default function AssinaturasDoCrm() {
  const cadastros = useCadastros();
  const todas = useAssinaturas(cadastros.tipo === 'pronto' ? cadastros.cadastros : []);
  const pagamentos = usePagamentosDasAssinaturas();
  const [recorte, setRecorte] = useState<Recorte>('cobrar');
  const hoje = brtToday();

  const estado: EstadoDasAssinaturas = useMemo(() => {
    if (todas.tipo !== 'pronto' || recorte === 'todas') return todas;
    return { tipo: 'pronto', assinaturas: aCobrar(todas.assinaturas, hoje) };
  }, [todas, recorte, hoje]);

  /*
   * A fila de inadimplentes precisa das duas consultas. Qualquer uma falhando é
   * erro, e não fila vazia: "ninguém devendo" dito por falta de dado faria o
   * sócio deixar de cobrar quem deve.
   */
  const estadoDosInadimplentes: EstadoDosInadimplentes = useMemo(() => {
    if (todas.tipo === 'erro' || pagamentos.tipo === 'erro') return { tipo: 'erro' };
    if (todas.tipo !== 'pronto' || pagamentos.tipo !== 'pronto') return { tipo: 'carregando' };
    return {
      tipo: 'pronto',
      inadimplentes: inadimplentes(
        todas.assinaturas,
        pagamentos.porAssinatura,
        pagamentos.doGatewayPorPessoa,
        hoje,
      ),
    };
  }, [todas, pagamentos, hoje]);

  /*
   * Quantos o recorte "A cobrar" escondeu por pagarem no cartão.
   *
   * ⚠️ Só no recorte de cobrar. Em "Todas" ninguém é escondido, e um rodapé
   * dizendo que gente saiu da fila apareceria numa lista onde essa gente está
   * logo acima — o aviso viraria ruído, e ruído ensina a ignorar aviso.
   */
  const escondidosPeloCartao = useMemo(
    () =>
      todas.tipo === 'pronto' && recorte === 'cobrar'
        ? saiuParaOCartao(todas.assinaturas, hoje).length
        : 0,
    [todas, recorte, hoje],
  );

  /*
   * Quem paga no gateway sai dos CADASTROS, e não de consulta nova: a lista já
   * está carregada, e o que distingue a origem é uma coluna dela.
   *
   * ⚠️ Cadastro falhando é ERRO, e não lista vazia. "Ninguém assinando pelo
   * cartão" dito por falta de dado faria o sócio concluir que o gateway não
   * vendeu nada — a mesma razão pela qual a fila de inadimplentes distingue os
   * dois estados.
   */
  const estadoDoCartao: EstadoDoStripe = useMemo(() => {
    if (cadastros.tipo === 'erro') return { tipo: 'erro' };
    if (cadastros.tipo !== 'pronto') return { tipo: 'carregando' };
    return { tipo: 'pronto', assinaturas: assinaturasDoStripe(cadastros.cadastros) };
  }, [cadastros]);

  /*
   * O resumo conta as DUAS origens, cada uma com o seu nome.
   *
   * ⚠️ Ele dizia só "N assinaturas na mão", e passaria a mentir no instante em
   * que a tela ganhou o recorte do cartão: é a linha que o sócio lê de relance,
   * e ela não pode descrever metade do que está embaixo dela.
   */
  const noCartao = estadoDoCartao.tipo === 'pronto' ? estadoDoCartao.assinaturas.length : 0;

  const resumo =
    todas.tipo === 'pronto'
      ? `${todas.assinaturas.length} na mão, ${noCartao} no cartão`
      : todas.tipo === 'erro'
        ? 'assinaturas indisponíveis'
        : 'carregando…';

  return (
    <>
      <Seo noindex title="CRM | Smart Betting" />
      <AnalyticsNav />

      <div className="theme-bolao min-h-screen bg-canvas text-ink">
        <CabecalhoDoCrm resumo={resumo} />

        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="mb-4 text-[14px] text-ink-2">
            Assinatura dada na mão não renova sozinha e não encerra sozinha. "A cobrar" junta quem
            vence primeiro, com quem já venceu no topo. "Devendo" junta quem parou de pagar, e é
            ali que se decide quem encerrar. "No cartão" é o outro lado: quem assina pelo gateway
            renova e é cobrado sozinho, então ali não há o que cobrar — é acompanhamento.
          </p>

          <div className="rounded-rebrand-md border border-line-2 bg-white">
            <div className="flex flex-wrap items-center gap-1 border-b border-line-2 px-4 py-3">
              {RECORTES.map(({ id, rotulo, explicacao }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={recorte === id}
                  title={explicacao}
                  onClick={() => setRecorte(id)}
                  className={`rounded-rebrand-sm px-3 py-1.5 text-[14px] font-bold transition ${
                    recorte === id
                      ? 'bg-forest text-white'
                      : 'text-ink-2 hover:bg-canvas hover:text-ink'
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            {/* Os nomes das pessoas dependem da lista de cadastros. Enquanto ela
                não chega, mostrar a fila vazia diria que não há ninguém a cobrar. */}
            {cadastros.tipo !== 'pronto' ? (
              <p className="px-5 py-8 text-[14px] text-ink-2">
                {cadastros.tipo === 'erro'
                  ? 'Não deu para carregar a base, então as cobranças ficariam sem dono.'
                  : 'Carregando…'}
              </p>
            ) : recorte === 'devendo' ? (
              <ListaDeInadimplentes estado={estadoDosInadimplentes} />
            ) : recorte === 'cartao' ? (
              <ListaDoStripe estado={estadoDoCartao} />
            ) : (
              <ListaDeCobranca
                estado={estado}
                hoje={hoje}
                noCartao={escondidosPeloCartao}
                vazio={
                  recorte === 'cobrar'
                    ? 'Ninguém para cobrar agora. Nenhuma assinatura manual vence nesta semana.'
                    : 'Nenhuma assinatura dada na mão até agora.'
                }
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
