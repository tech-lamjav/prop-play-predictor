import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { soFeedbacks, type ItemDaLinhaDoTempo } from './crm-linha-do-tempo';
import {
  CHAVE_DA_ETAPA,
  CHAVE_DO_TIPO,
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
  { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronta'; itens: ItemDaLinhaDoTempo[] };

function Item({
  item,
  nomeDoSocio,
}: {
  item: ItemDaLinhaDoTempo;
  nomeDoSocio: (id: string | null) => string;
}) {
  const { t } = useTranslation('socios');

  const quando = (carimbo: string): string => {
    const d = brtDayOf(carimbo);
    return d ? formatarDia(d) : t('ficha.linhaDoTempo.semData');
  };

  /**
   * Etapa vinda do banco pode ser qualquer coisa; sem chave, mostra o valor cru.
   *
   * ⚠️ O recuo para o valor CRU continua valendo com o catálogo, e é de
   * propósito: só a etapa que o código conhece é traduzida. Uma etapa que ele
   * não conhece aparece como está gravada na coluna, que é o que ajuda a
   * descobrir de onde ela veio — traduzi-la é impossível, e trocá-la por um
   * texto genérico apagaria a pista.
   */
  const etapaNaLinha = (bruta: string | null): string => {
    if (!bruta) return t('ficha.linhaDoTempo.semEtapa');
    const chave = CHAVE_DA_ETAPA[bruta as Etapa];
    return chave ? t(chave) : bruta;
  };

  return (
    <li className="border-t border-line-2 py-3 first:border-t-0 first:pt-0">
      <p className="text-[12px] text-ink-2">
        {quando(item.em)} · {nomeDoSocio(item.por)}
        {item.natureza === 'anotacao' ? ` · ${t(CHAVE_DO_TIPO[item.tipo])}` : null}
      </p>
      {item.natureza === 'anotacao' ? (
        <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink">{item.texto}</p>
      ) : (
        <p className="mt-1 text-[14px] text-ink">
          {t('ficha.linhaDoTempo.mudouDeEtapa', {
            de: etapaNaLinha(item.de),
            para: etapaNaLinha(item.para),
          })}
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
  const { t } = useTranslation('socios');
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
        {t('ficha.linhaDoTempo.anotacao')}
      </label>
      <textarea
        id="crm-anotacao"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder={t('ficha.linhaDoTempo.placeholder')}
        className="w-full rounded-rebrand-sm border border-line-2 px-3 py-2 text-[14px] text-ink placeholder:text-ink-dim"
      />
      <div className="mt-2 flex items-center gap-3">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDeAnotacao)}
          aria-label={t('ficha.linhaDoTempo.tipoDoRegistro')}
          className="h-10 rounded-rebrand-sm border border-line-2 bg-white px-3 text-[14px] text-ink"
        >
          {/* O parâmetro do laço NÃO pode se chamar `t`: sombrearia a função de
              tradução. `key` e `value` continuam no valor do banco. */}
          {TIPOS_DE_ANOTACAO.map((tipoDeAnotacao) => (
            <option key={tipoDeAnotacao} value={tipoDeAnotacao}>
              {t(CHAVE_DO_TIPO[tipoDeAnotacao])}
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
          aria-label={t('ficha.linhaDoTempo.registrarAria')}
          className="h-10 rounded-rebrand-sm bg-forest px-4 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {anotando ? t('ficha.linhaDoTempo.registrando') : t('ficha.linhaDoTempo.registrar')}
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
  const { t } = useTranslation('socios');
  const [soFeedback, setSoFeedback] = useState(false);

  const visiveis =
    estado.tipo === 'pronta' ? (soFeedback ? soFeedbacks(estado.itens) : estado.itens) : null;

  return (
    <section
      role="region"
      aria-label={t('ficha.linhaDoTempo.titulo')}
      className="rounded-rebrand-md border border-line-2 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-2">
          {t('ficha.linhaDoTempo.titulo')}
        </h2>
        <label className="flex items-center gap-2 text-[12px] text-ink-2">
          <input
            type="checkbox"
            checked={soFeedback}
            onChange={(e) => setSoFeedback(e.target.checked)}
            aria-label={t('ficha.linhaDoTempo.soFeedbacks')}
          />
          {t('ficha.linhaDoTempo.soFeedbacks')}
        </label>
      </div>

      <FormularioDeAnotacao aoAnotar={aoAnotar} anotando={anotando} erroAoAnotar={erroAoAnotar} />

      <div className="mt-5">
        {estado.tipo === 'erro' && (
          <p className="text-[14px] text-ink-2">{t('ficha.linhaDoTempo.erro')}</p>
        )}
        {estado.tipo === 'carregando' && (
          <p className="text-[14px] text-ink-2">{t('ficha.linhaDoTempo.carregando')}</p>
        )}
        {visiveis !== null &&
          (visiveis.length === 0 ? (
            <p className="text-[14px] text-ink-2">
              {soFeedback ? t('ficha.linhaDoTempo.vazioFeedbacks') : t('ficha.linhaDoTempo.vazio')}
            </p>
          ) : (
            <ul aria-label={t('ficha.linhaDoTempo.listaAria')}>
              {visiveis.map((item) => (
                <Item key={item.id} item={item} nomeDoSocio={nomeDoSocio} />
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
