import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  ABERTURAS,
  PERGUNTAS,
  type AberturaDaPesquisa,
  type Frequencia,
  type Objetivo,
  type RespostaDoPerfil,
} from '@/utils/perfil-declarado';

interface PesquisaDePerfilModalProps {
  open: boolean;
  /** Qual das duas aberturas usar — decidida pela data de cadastro. */
  abertura: AberturaDaPesquisa;
  /** As duas escolhas, em código. Só dispara com as duas preenchidas. */
  onResponder: (resposta: RespostaDoPerfil) => void;
  /** Apertou Pular. A pergunta volta na próxima sessão. */
  onPular: () => void;
}

/**
 * As duas perguntas do perfil declarado, numa tela só.
 *
 * Spec na issue #522, ticket #523.
 *
 * ⚠️ **Só duas saídas: responder ou pular.** Clique fora e Esc não fecham, e o
 * X do canto está escondido de propósito. A pesquisa é adiável e não
 * dispensável, e adiar é um ato deliberado — um clique fora por acidente não
 * pode custar a pergunta, e um X faria o quê, nem responder nem adiar?
 *
 * O texto vem todo do catálogo em `@/utils/perfil-declarado`: aqui não se
 * escreve nem enunciado nem opção. É o que deixa reescrever qualquer frase sem
 * mexer no que fica gravado.
 */
export const PesquisaDePerfilModal: React.FC<PesquisaDePerfilModalProps> = ({
  open,
  abertura,
  onResponder,
  onPular,
}) => {
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  const completo = !!escolhas.objetivo && !!escolhas.frequencia;

  const enviar = () => {
    if (!completo) return;
    onResponder({
      objetivo: escolhas.objetivo as Objetivo,
      frequencia: escolhas.frequencia as Frequencia,
    });
  };

  return (
    <Dialog open={open}>
      <DialogContent
        // As três travas da mesma decisão: fora, Esc e o X herdado do primitivo.
        onInteractOutside={(evento) => evento.preventDefault()}
        onEscapeKeyDown={(evento) => evento.preventDefault()}
        showCloseButton={false}
        // Três colunas verticais: cabeçalho, miolo rolável, rodapé. O teto é a
        // altura da janela menos uma folga — sem ele, oito opções mais dois
        // botões estouram a tela numa janela baixa, e o primeiro a sumir é
        // justamente o Enviar. `dvh` e não `vh` por causa da barra do navegador
        // no celular, que muda de altura conforme se rola.
        className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-sm p-0 gap-0 overflow-hidden rounded-rebrand-xl flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        <div className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="font-display text-[17px] font-bold text-ink leading-tight">
            {ABERTURAS[abertura]}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Duas perguntas de escolha única sobre o que você busca e com que frequência aposta.
          </DialogDescription>
        </div>

        {/* `min-h-0` é o que deixa este filho encolher dentro do flex e ativar a
            própria rolagem — sem ele o item flex usa a altura do conteúdo como
            mínimo, e a caixa volta a crescer para fora da tela. */}
        <div className="px-5 overflow-y-auto flex-1 min-h-0">
          {PERGUNTAS.map((pergunta, indice) => {
            const rotulo = `pergunta-${pergunta.campo}`;
            return (
              <div key={pergunta.campo} className={indice === 0 ? '' : 'mt-4'}>
                <p id={rotulo} className="text-[13px] font-bold text-ink leading-snug">
                  {pergunta.enunciado}
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby={rotulo}
                  className="mt-2 flex flex-col gap-1.5"
                >
                  {pergunta.opcoes.map((opcao) => {
                    const marcada = escolhas[pergunta.campo] === opcao.codigo;
                    return (
                      <button
                        key={opcao.codigo}
                        type="button"
                        role="radio"
                        aria-checked={marcada}
                        onClick={() =>
                          setEscolhas((atual) => ({ ...atual, [pergunta.campo]: opcao.codigo }))
                        }
                        className={`w-full text-left px-3.5 py-2.5 rounded-rebrand-md border text-[13px] leading-snug transition-colors ${
                          marcada
                            ? 'border-amber bg-amber/[0.12] text-ink font-bold'
                            : 'border-line bg-transparent text-ink-2 hover:border-ink-2'
                        }`}
                      >
                        {opcao.texto}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 pt-3 pb-4 shrink-0 border-t border-line">
          <button
            type="button"
            onClick={enviar}
            disabled={!completo}
            className="w-full h-11 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center font-bold text-[13px] transition-colors"
          >
            Enviar
          </button>

          <button
            type="button"
            onClick={onPular}
            className="w-full mt-2 py-1 text-[13px] text-ink-2 hover:text-ink transition-colors"
          >
            Pular
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
