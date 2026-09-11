import { Link } from 'react-router-dom';
import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { ROTA_DOS_SOCIOS } from './crm-vocabulario';
import type { EstadoDosFeedbacks } from '@/hooks/use-feedbacks';

/**
 * Todos os feedbacks da base, num lugar só.
 *
 * Existe porque a pergunta "o que estão achando do produto" não se responde
 * abrindo a ficha de trinta pessoas. O feedback continua morando na linha do
 * tempo de quem falou — é lá que ele tem contexto —, e esta tela é a leitura
 * transversal dele.
 *
 * Cada linha leva de volta para a pessoa: um feedback sem a conversa em volta
 * costuma ser mal interpretado, e o caminho de volta precisa ser um clique.
 */
export function ListaDeFeedbacks({
  estado,
  nomeDoSocio,
}: {
  estado: EstadoDosFeedbacks;
  nomeDoSocio: (id: string | null) => string;
}) {
  if (estado.tipo === 'carregando') {
    return <p className="px-4 py-6 text-[14px] text-ink-2">Carregando os feedbacks…</p>;
  }
  if (estado.tipo === 'erro') {
    return <p className="px-4 py-6 text-[14px] text-ink-2">Não deu para carregar os feedbacks.</p>;
  }
  if (estado.feedbacks.length === 0) {
    return (
      <p className="px-4 py-6 text-[14px] text-ink-2">
        Nenhum feedback registrado ainda. Eles aparecem aqui quando alguém marca uma anotação como
        feedback na ficha de um lead.
      </p>
    );
  }

  return (
    <ul>
      {estado.feedbacks.map((f) => {
        const dia = brtDayOf(f.quando);
        return (
          <li key={f.id} className="border-b border-line-2 px-4 py-4 last:border-b-0">
            <p className="text-[12px] text-ink-2">
              {dia ? formatarDia(dia) : 'sem data'} · registrado por {nomeDoSocio(f.autor)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[15px] text-ink">{f.texto}</p>
            <Link
              to={`${ROTA_DOS_SOCIOS}/${f.userId}`}
              className="mt-1.5 inline-block text-[13px] font-bold text-forest hover:underline"
            >
              {f.pessoa}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
