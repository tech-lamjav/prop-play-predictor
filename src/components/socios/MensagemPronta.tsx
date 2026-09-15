import { useState } from 'react';
import { Bloco } from './Bloco';
import { linkDoWhatsApp, type ModeloDeMensagem } from './crm-mensagens';

/** As opções em blocos por etapa, na ordem em que chegaram. */
function agruparPorEtapa(opcoes: ModeloDeMensagem[]) {
  return opcoes.reduce<{ nome: string; itens: ModeloDeMensagem[] }[]>((grupos, opcao) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nome === opcao.grupo) ultimo.itens.push(opcao);
    else grupos.push({ nome: opcao.grupo, itens: [opcao] });
    return grupos;
  }, []);
}

/**
 * A mensagem pronta para abordar alguém.
 *
 * O modelo é ponto de partida: quem conhece o lead ajusta antes de mandar, e
 * uma caixa travada só faria o sócio copiar para outro lugar para editar.
 *
 * ⚠️ A regra do texto, que precisou ser escolhida de propósito: **enquanto o
 * sócio não digitou nada, a caixa segue o modelo**; depois que ele digitou, o
 * texto dele manda. A primeira versão semeava o estado uma vez só, então trocar
 * a etapa na tela deixava a mensagem congelada no texto antigo — com o botão
 * "voltar ao modelo" aparecendo sem ele ter escrito coisa nenhuma.
 *
 * ## Trocar de mensagem
 *
 * Com `opcoes`, aparece um seletor com o catálogo inteiro. A mesma regra vale
 * para ele: enquanto o sócio não escolheu outra, a caixa segue a SUGERIDA, e
 * mudar a etapa muda a mensagem. Depois que ele escolheu, a escolha dele manda,
 * e trocar a etapa não a desfaz. Escolher de novo a sugerida devolve a caixa ao
 * automático.
 *
 * Escolher outra mensagem descarta o que foi digitado. É uma troca explícita,
 * feita num seletor, e manter o texto velho na caixa com outra opção marcada
 * faria a tela dizer uma coisa e mostrar outra.
 */
export function MensagemPronta({
  modelo,
  numero,
  opcoes,
  idSugerido,
}: {
  modelo: string;
  numero: string | null;
  /**
   * O catálogo para trocar de mensagem. Sem ele não há seletor: a fila de
   * cobrança tem um texto só para cada prazo, e um seletor de uma opção é ruído.
   */
  opcoes?: ModeloDeMensagem[];
  /** Qual das opções é o `modelo`. É a que a tela marca como sugerida. */
  idSugerido?: string;
}) {
  /** Nulo enquanto intocado. É o que separa "não mexi" de "apaguei tudo". */
  const [editado, setEditado] = useState<string | null>(null);
  /** Nulo enquanto o sócio não escolheu outra: a caixa segue a sugestão. */
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [falhouAoCopiar, setFalhouAoCopiar] = useState(false);

  const escolhida = escolhido ? opcoes?.find((o) => o.id === escolhido) : undefined;
  const base = escolhida?.texto ?? modelo;
  const texto = editado ?? base;
  const link = linkDoWhatsApp(numero, texto);

  const limparAvisos = () => {
    setCopiado(false);
    setFalhouAoCopiar(false);
  };

  const copiar = async () => {
    try {
      // Fora de contexto seguro o navegador nem define a área de transferência,
      // e o `?.` viraria um clique que não faz nada e não diz nada.
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setFalhouAoCopiar(false);
    } catch {
      setCopiado(false);
      setFalhouAoCopiar(true);
    }
  };

  return (
    <Bloco titulo="Mensagem pronta">
      {opcoes && opcoes.length > 1 ? (
        <label className="mb-2 block text-[12px] text-ink-2">
          Trocar a mensagem
          <select
            value={escolhido ?? idSugerido ?? ''}
            aria-label="Escolher outra mensagem pronta"
            onChange={(e) => {
              const id = e.target.value;
              // Voltar à sugerida é voltar ao automático, e não fixar o texto
              // dela: senão trocar a etapa deixaria de mudar a mensagem.
              setEscolhido(id === idSugerido ? null : id);
              setEditado(null);
              limparAvisos();
            }}
            className="mt-1 block h-9 w-full rounded-rebrand-sm border border-line-2 bg-white px-2 text-[13px] text-ink sm:w-auto sm:min-w-[260px]"
          >
            {agruparPorEtapa(opcoes).map((grupo) => (
              <optgroup key={grupo.nome} label={grupo.nome}>
                {grupo.itens.map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.rotulo}
                    {opcao.id === idSugerido ? ' (sugerida)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : null}

      <label className="sr-only" htmlFor="crm-mensagem">
        Mensagem
      </label>
      <textarea
        id="crm-mensagem"
        value={texto}
        onChange={(e) => {
          setEditado(e.target.value);
          limparAvisos();
        }}
        rows={6}
        className="w-full rounded-rebrand-sm border border-line-2 px-3 py-2 text-[14px] text-ink"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copiar}
          className="h-10 rounded-rebrand-sm border border-line-2 px-4 text-[14px] font-bold text-ink hover:border-forest hover:text-forest"
        >
          Copiar
        </button>

        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center rounded-rebrand-sm bg-forest px-4 text-[14px] font-bold text-white"
          >
            Abrir no WhatsApp
          </a>
        ) : (
          <span className="text-[13px] text-ink-2">Sem WhatsApp no cadastro</span>
        )}

        {editado !== null && (
          <button
            type="button"
            onClick={() => {
              setEditado(null);
              limparAvisos();
            }}
            className="text-[13px] font-bold text-forest hover:underline"
          >
            Voltar ao modelo
          </button>
        )}

        {copiado && <span className="text-[13px] text-forest">Copiado</span>}
      </div>

      {falhouAoCopiar && (
        <p className="mt-2 text-[13px] font-bold text-ink">
          Não deu para copiar sozinho. Selecione o texto acima e copie na mão.
        </p>
      )}
    </Bloco>
  );
}
