import { AlertTriangle, CircleDot, History } from 'lucide-react';
import {
  ETIQUETAS,
  EXPLICACAO_DA_ETIQUETA,
  ROTULO_DA_ETIQUETA,
  type Etiqueta,
} from './crm-etiquetas';

/**
 * O ícone de cada etiqueta.
 *
 * "Vencendo" tem o triângulo porque é a única com prazo, e prazo é o que decide
 * para quem o sócio liga primeiro. As outras duas são estado, não urgência.
 */
const ICONE: Record<Etiqueta, typeof CircleDot> = {
  trial_vencendo: AlertTriangle,
  trial_ativo: CircleDot,
  trial_vencido: History,
};

/**
 * O teste gratuito, num eixo à parte do funil.
 *
 * Separada da faixa do funil de propósito, e essa separação é a mudança que ela
 * existe para carregar. "Em teste" morava DENTRO do funil, com o mesmo desenho
 * das etapas, e o Victor perguntou olhando a tela se não estávamos misturando
 * duas coisas. Estávamos: a etapa é até onde a conversa chegou, e o teste é o
 * que a conta da pessoa é agora. As duas valem juntas.
 *
 * Só aparece quando há alguém em alguma delas. Numa base sem nenhum teste
 * corrente, três zeros lado a lado seriam três perguntas sem assunto.
 *
 * ⚠️ Clicar aqui filtra a lista, e o filtro se SOMA ao do funil em vez de
 * substituí-lo: "quem está em teste e ainda está em nutrindo" é uma pergunta
 * legítima, e é exatamente o tipo de recorte que o eixo separado permite.
 */
export function FaixaDeEtiquetas({
  contagem,
  selecionada,
  aoSelecionar,
}: {
  contagem: Record<Etiqueta, number>;
  selecionada: Etiqueta | null;
  aoSelecionar: (etiqueta: Etiqueta | null) => void;
}) {
  const temAlguem = ETIQUETAS.some((e) => contagem[e] > 0);
  if (!temAlguem) return null;

  return (
    <section
      role="region"
      aria-label="Teste gratuito"
      className="rounded-rebrand-md border border-line-2 bg-white p-4"
    >
      <p className="mb-2.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-dim">
        Teste gratuito
      </p>

      <div className="flex flex-wrap gap-2">
        {ETIQUETAS.map((etiqueta) => {
          const Icone = ICONE[etiqueta];
          const ativa = selecionada === etiqueta;
          const quantos = contagem[etiqueta];
          const urgente = etiqueta === 'trial_vencendo' && quantos > 0;

          return (
            <button
              key={etiqueta}
              type="button"
              // Clicar de novo limpa, como na faixa do funil: sem isso, sair do
              // filtro exige achar um "limpar" em outro canto da tela.
              onClick={() => aoSelecionar(ativa ? null : etiqueta)}
              aria-pressed={ativa}
              title={EXPLICACAO_DA_ETIQUETA[etiqueta]}
              disabled={quantos === 0}
              className={`flex items-center gap-2 rounded-rebrand-sm border px-3 py-2 text-left transition disabled:cursor-default disabled:opacity-45 ${
                ativa
                  ? 'border-forest bg-forest/5'
                  : 'border-line-2 hover:border-forest/40 hover:bg-canvas'
              }`}
            >
              <Icone
                aria-hidden
                className={`h-3.5 w-3.5 shrink-0 ${urgente ? 'text-amber-500' : 'text-ink-dim'}`}
              />
              <span className="text-[13px] font-bold text-ink">{ROTULO_DA_ETIQUETA[etiqueta]}</span>
              <span
                className={`font-display text-[15px] font-black tabular-nums ${
                  urgente ? 'text-amber-600' : 'text-ink-2'
                }`}
              >
                {quantos}
              </span>
            </button>
          );
        })}
      </div>

      {/* A explicação da etiqueta escolhida, na tela. O `title` sozinho é
          invisível na prática — foi a lição do recorte da lista. */}
      {selecionada && (
        <p className="mt-2.5 text-[12px] text-ink-2">{EXPLICACAO_DA_ETIQUETA[selecionada]}</p>
      )}
    </section>
  );
}
