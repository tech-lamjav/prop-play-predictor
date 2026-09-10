import { useState } from 'react';
import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { soFeedbacks, type ItemDaLinhaDoTempo } from './crm-linha-do-tempo';
import {
  ROTULO_DA_ETAPA,
  ROTULO_DO_TIPO,
  TIPOS_DE_ANOTACAO,
  type Etapa,
  type TipoDeAnotacao,
} from './crm-vocabulario';

/**
 * O que se sabe da linha do tempo no momento em que a tela desenha.
 *
 * União discriminada como nas outras consultas do painel. Uma lista vazia diz
 * ao sócio que ninguém falou com essa pessoa, e ele age em cima disso — então
 * "ainda não sei" precisa ser um estado próprio, e não um array vazio.
 */
export type EstadoDaLinhaDoTempo =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronta'; itens: ItemDaLinhaDoTempo[] };

function quando(carimbo: string): string {
  const d = brtDayOf(carimbo);
  return d ? formatarDia(d) : 'sem data';
}

/** Etapa vinda do banco pode ser qualquer coisa; sem rótulo, mostra o valor cru. */
const rotuloDaEtapa = (bruta: string | null) =>
  bruta ? (ROTULO_DA_ETAPA[bruta as Etapa] ?? bruta) : 'sem etapa';

function Item({
  item,
  nomeDoSocio,
}: {
  item: ItemDaLinhaDoTempo;
  nomeDoSocio: (id: string | null) => string;
}) {
  return (
    <li className="border-t border-line-2 py-3 first:border-t-0 first:pt-0">
      <p className="text-[12px] text-ink-2">
        {quando(item.em)} · {nomeDoSocio(item.por)}
        {item.natureza === 'anotacao' ? ` · ${ROTULO_DO_TIPO[item.tipo]}` : null}
      </p>
      {item.natureza === 'anotacao' ? (
        <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink">{item.texto}</p>
      ) : (
        <p className="mt-1 text-[14px] text-ink">
          Etapa: {rotuloDaEtapa(item.de)} → {rotuloDaEtapa(item.para)}
        </p>
      )}
    </li>
  );
}

/**
 * O campo de escrever.
 *
 * Separado da lista porque é o único pedaço com estado próprio e com uma regra
 * que já custou caro: **o campo só é limpo quando a gravação dá certo**. A
 * primeira versão limpava na linha seguinte ao clique, então uma falha do banco
 * apagava trinta minutos de conversa e ainda mostrava "tente de novo" com o
 * campo em branco.
 */
function FormularioDeAnotacao({
  aoAnotar,
  anotando,
  erroAoAnotar,
}: {
  aoAnotar: (tipo: TipoDeAnotacao, texto: string) => Promise<void>;
  anotando: boolean;
  erroAoAnotar: string | null;
}) {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<TipoDeAnotacao>('anotacao');

  const vazio = texto.trim() === '';

  const registrar = async () => {
    if (vazio || anotando) return;
    try {
      await aoAnotar(tipo, texto.trim());
      setTexto('');
    } catch {
      // O texto fica onde está. Quem avisa é o `erroAoAnotar`, que vem de fora.
    }
  };

  return (
    <div className="mt-4">
      <label className="sr-only" htmlFor="crm-anotacao">
        Anotação
      </label>
      <textarea
        id="crm-anotacao"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="O que aconteceu nessa conversa?"
        className="w-full rounded-rebrand-sm border border-line-2 px-3 py-2 text-[14px] text-ink placeholder:text-ink-dim"
      />
      <div className="mt-2 flex items-center gap-3">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDeAnotacao)}
          aria-label="Tipo do registro"
          className="h-10 rounded-rebrand-sm border border-line-2 bg-white px-3 text-[14px] text-ink"
        >
          {TIPOS_DE_ANOTACAO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_DO_TIPO[t]}
            </option>
          ))}
        </select>
        {/* Desabilitado com texto em branco: o banco também recusa, mas deixar
            o botão vivo faz o sócio clicar e receber um erro por algo que a
            tela já sabia. */}
        <button
          type="button"
          onClick={registrar}
          disabled={vazio || anotando}
          /* Nome fixo de propósito: o texto visível vira "Registrando…" durante
             a gravação, e um nome que muda some do alcance de quem navega por
             leitor de tela — e dos testes. */
          aria-label="Registrar na linha do tempo"
          className="h-10 rounded-rebrand-sm bg-forest px-4 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {anotando ? 'Registrando…' : 'Registrar'}
        </button>
      </div>
      {erroAoAnotar && <p className="mt-2 text-[13px] font-bold text-ink">{erroAoAnotar}</p>}
    </div>
  );
}

/** A linha do tempo de uma pessoa, e o campo para escrever nela. */
export function LinhaDoTempo({
  estado,
  nomeDoSocio,
  aoAnotar,
  anotando,
  erroAoAnotar,
}: {
  estado: EstadoDaLinhaDoTempo;
  nomeDoSocio: (id: string | null) => string;
  aoAnotar: (tipo: TipoDeAnotacao, texto: string) => Promise<void>;
  anotando: boolean;
  erroAoAnotar: string | null;
}) {
  const [soFeedback, setSoFeedback] = useState(false);

  const visiveis =
    estado.tipo === 'pronta' ? (soFeedback ? soFeedbacks(estado.itens) : estado.itens) : null;

  return (
    <section
      role="region"
      aria-label="Linha do tempo"
      className="rounded-rebrand-md border border-line-2 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-2">
          Linha do tempo
        </h2>
        <label className="flex items-center gap-2 text-[12px] text-ink-2">
          <input
            type="checkbox"
            checked={soFeedback}
            onChange={(e) => setSoFeedback(e.target.checked)}
            aria-label="Só feedbacks"
          />
          Só feedbacks
        </label>
      </div>

      <FormularioDeAnotacao
        aoAnotar={aoAnotar}
        anotando={anotando}
        erroAoAnotar={erroAoAnotar}
      />

      <div className="mt-5">
        {estado.tipo === 'erro' && (
          <p className="text-[14px] text-ink-2">Não deu para carregar a linha do tempo.</p>
        )}
        {estado.tipo === 'carregando' && (
          <p className="text-[14px] text-ink-2">Carregando a linha do tempo…</p>
        )}
        {visiveis !== null &&
          (visiveis.length === 0 ? (
            <p className="text-[14px] text-ink-2">
              {soFeedback ? 'Nenhum feedback registrado ainda.' : 'Nada registrado ainda.'}
            </p>
          ) : (
            <ul aria-label="Linha do tempo desta pessoa">
              {visiveis.map((item) => (
                <Item key={item.id} item={item} nomeDoSocio={nomeDoSocio} />
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
