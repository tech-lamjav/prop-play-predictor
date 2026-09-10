import { useState } from 'react';
import { Bloco } from './Bloco';
import { linkDoWhatsApp } from './crm-mensagens';

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
 */
export function MensagemPronta({ modelo, numero }: { modelo: string; numero: string | null }) {
  /** Nulo enquanto intocado. É o que separa "não mexi" de "apaguei tudo". */
  const [editado, setEditado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [falhouAoCopiar, setFalhouAoCopiar] = useState(false);

  const texto = editado ?? modelo;
  const link = linkDoWhatsApp(numero, texto);

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
      <label className="sr-only" htmlFor="crm-mensagem">
        Mensagem
      </label>
      <textarea
        id="crm-mensagem"
        value={texto}
        onChange={(e) => {
          setEditado(e.target.value);
          setCopiado(false);
          setFalhouAoCopiar(false);
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
          <span className="text-[13px] text-ink-3">Sem WhatsApp no cadastro</span>
        )}

        {editado !== null && (
          <button
            type="button"
            onClick={() => {
              setEditado(null);
              setCopiado(false);
              setFalhouAoCopiar(false);
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
