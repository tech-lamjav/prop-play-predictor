import { useMemo, useState } from 'react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { CabecalhoDoCrm } from '@/components/socios/CabecalhoDoCrm';
import { ListaDeCobranca } from '@/components/socios/ListaDeCobranca';
import { aCobrar, DIAS_PARA_COBRAR } from '@/components/socios/crm-assinatura';
import { useAssinaturas, type EstadoDasAssinaturas } from '@/hooks/use-assinaturas';
import { useCadastros } from '@/hooks/use-cadastros';
import { brtToday } from '@/utils/futebol-datas';

/**
 * Qual fatia da fila a tela mostra.
 *
 * "A cobrar" é o padrão porque é o trabalho: quem vence nos próximos sete dias
 * e quem já venceu. "Todas" existe para conferir o que foi dado, que é outra
 * pergunta e não deveria disputar espaço com a primeira.
 */
type Recorte = 'cobrar' | 'todas';

const RECORTES: { id: Recorte; rotulo: string; explicacao: string }[] = [
  {
    id: 'cobrar',
    rotulo: 'A cobrar',
    explicacao: `quem vence nos próximos ${DIAS_PARA_COBRAR} dias, e quem já venceu`,
  },
  { id: 'todas', rotulo: 'Todas', explicacao: 'todas as assinaturas manuais abertas' },
];

/**
 * As assinaturas que a gente deu na mão.
 *
 * Seção própria ao lado de Leads e Feedbacks porque é uma terceira pergunta:
 * a lista de leads responde "com quem eu falo agora", a de feedbacks responde
 * "o que estão achando", e esta responde "quem eu preciso cobrar".
 *
 * Ela existe porque uma assinatura dada na mão NÃO renova sozinha. Sem um lugar
 * que junte quem está vencendo, o acesso some um dia e a conversa acontece
 * tarde, com a pessoa já sem o produto.
 */
export default function AssinaturasDoCrm() {
  const cadastros = useCadastros();
  const todas = useAssinaturas(cadastros.tipo === 'pronto' ? cadastros.cadastros : []);
  const [recorte, setRecorte] = useState<Recorte>('cobrar');
  const hoje = brtToday();

  const estado: EstadoDasAssinaturas = useMemo(() => {
    if (todas.tipo !== 'pronto' || recorte === 'todas') return todas;
    return { tipo: 'pronto', assinaturas: aCobrar(todas.assinaturas, hoje) };
  }, [todas, recorte, hoje]);

  const resumo =
    todas.tipo === 'pronto'
      ? `${todas.assinaturas.length} ${
          todas.assinaturas.length === 1 ? 'assinatura na mão' : 'assinaturas na mão'
        }`
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
            Assinatura dada na mão não renova sozinha: ela vence. Esta é a fila de quem precisa ser
            cobrado, de quem vence primeiro para quem vence depois, com quem já venceu no topo.
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
            {cadastros.tipo === 'pronto' ? (
              <ListaDeCobranca
                estado={estado}
                hoje={hoje}
                vazio={
                  recorte === 'cobrar'
                    ? 'Ninguém para cobrar agora. Nenhuma assinatura manual vence nesta semana.'
                    : 'Nenhuma assinatura dada na mão até agora.'
                }
              />
            ) : (
              <p className="px-5 py-8 text-[14px] text-ink-2">
                {cadastros.tipo === 'erro'
                  ? 'Não deu para carregar a base, então as cobranças ficariam sem dono.'
                  : 'Carregando…'}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
