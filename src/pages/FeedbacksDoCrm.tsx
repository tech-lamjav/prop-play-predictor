import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { CabecalhoDoCrm } from '@/components/socios/CabecalhoDoCrm';
import { ListaDeFeedbacks } from '@/components/socios/ListaDeFeedbacks';
import { useCadastros } from '@/hooks/use-cadastros';
import { useFeedbacks } from '@/hooks/use-feedbacks';
import { useNomeDoSocio } from '@/hooks/use-nome-do-socio';

/**
 * Todos os feedbacks da base.
 *
 * Seção própria, e não uma quarta aba da lista de leads: o que se lista aqui
 * não é gente, é o que a gente ouviu. A lista de leads responde "com quem eu
 * falo agora"; esta responde "o que estão achando do produto".
 */
export default function FeedbacksDoCrm() {
  const cadastros = useCadastros();
  const feedbacks = useFeedbacks(cadastros.tipo === 'pronto' ? cadastros.cadastros : []);
  const nomeDoSocio = useNomeDoSocio();

  const resumo =
    feedbacks.tipo === 'pronto'
      ? `${feedbacks.feedbacks.length} ${
          feedbacks.feedbacks.length === 1 ? 'feedback registrado' : 'feedbacks registrados'
        }`
      : feedbacks.tipo === 'erro'
        ? 'feedbacks indisponíveis'
        : 'carregando…';

  return (
    <>
      <Seo noindex title="CRM | Smart Betting" />
      <AnalyticsNav />

      <div className="min-h-screen bg-canvas">
        <CabecalhoDoCrm resumo={resumo} />

        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="mb-4 text-[14px] text-ink-2">
            O que a base falou, do mais recente para o mais antigo. Cada feedback continua na linha
            do tempo de quem falou — é lá que ele tem contexto —, e o nome leva de volta para a
            ficha.
          </p>

          <div className="rounded-rebrand-md border border-line-2 bg-white">
            {/* Os nomes das pessoas dependem da lista de cadastros. Enquanto ela
                não chega, mostrar a lista vazia diria que ninguém falou nada. */}
            {cadastros.tipo === 'pronto' ? (
              <ListaDeFeedbacks estado={feedbacks} nomeDoSocio={nomeDoSocio} />
            ) : (
              <p className="px-4 py-6 text-[14px] text-ink-2">
                {cadastros.tipo === 'erro'
                  ? 'Não deu para carregar a base, então os feedbacks ficariam sem dono.'
                  : 'Carregando…'}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
