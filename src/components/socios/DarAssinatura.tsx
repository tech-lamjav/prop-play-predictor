import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { PLANOS_A_VENDER, ROTULO_DO_PLANO, type PlanoAVender } from './crm-vocabulario';
import { formatarDia } from './crm-lista';
import { emReais, lerValorDigitado, valorComoTexto } from './crm-receita';

/**
 * O que cada plano libera, em palavras.
 *
 * A escada é cumulativa e está escrita por extenso porque o sócio precisa saber
 * o que está dando ANTES de dar. "Essencial" não diz nada sobre o Betinho ir
 * junto, e ir junto é justamente o que surpreende quem só olhou o nome.
 *
 * ⚠️ Isto é rótulo, não regra. Quem concede é a migration 142, que segue a
 * mesma escada de `shared/concessoes.ts`, e há um teste cobrando que as duas
 * não divirjam.
 *
 * ⚠️ Guarda CHAVE, e não texto. A tabela é declarada FORA do componente, então
 * é avaliada uma vez no carregamento do módulo: texto aqui congelaria o idioma
 * da primeira pintura. O `t()` acontece no render.
 */
const CHAVE_DO_QUE_LIBERA: Record<PlanoAVender, string> = {
  entrada: 'dinheiro.assinatura.libera.entrada',
  essencial: 'dinheiro.assinatura.libera.essencial',
  completo: 'dinheiro.assinatura.libera.completo',
};

/** `2026-10-31`, daqui a um mês. O prazo mais comum, já preenchido. */
function daquiUmMes(hoje: string): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** O limite de quanto dá para retroagir. Proteção contra ano digitado errado. */
function umAnoAtras(hoje: string): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Quantos meses de competência abrem entre o começo e hoje, inclusive.
 *
 * Nulo quando não há o que avisar: sem cobrança combinada não existe mês em
 * aberto, e começar hoje abre só o mês corrente, que é o caso normal. Avisar
 * nesses dois casos seria ruído, e ruído ensina a ignorar o aviso.
 */
function mesesAbertosAte(comecouEm: string, hoje: string, valor: number | null): number | null {
  if (valor === null || comecouEm >= hoje.slice(0, 7) + '-01') return null;
  const [anoI, mesI] = comecouEm.split('-').map(Number);
  const [anoF, mesF] = hoje.split('-').map(Number);
  return (anoF - anoI) * 12 + (mesF - mesI) + 1;
}

export type EstadoDaConcessao =
  { tipo: 'parado' } | { tipo: 'salvando' } | { tipo: 'erro'; recado: string };

/** A assinatura manual aberta desta pessoa. */
export interface AssinaturaAtual {
  id: string;
  plano: PlanoAVender;
  /** Nulo é VITALÍCIA: não vence. */
  venceEm: string | null;
  /** Nulo é SEM COBRANÇA: não se combinou valor. */
  valorMensal: number | null;
}

const CAMPO =
  'mt-1 h-10 w-full rounded-rebrand-sm border border-line-2 bg-white px-2 text-[14px] text-ink disabled:opacity-60';

/**
 * Dar uma assinatura inteira na mão.
 *
 * O plano, o prazo e o VALOR juntos, num lugar só, porque é assim que a venda
 * acontece: ninguém combina "te dou o futebol" e depois lembra de combinar até
 * quando e por quanto. Os interruptores por produto continuam existindo logo ao
 * lado, e servem a outra coisa — consertar UM acesso, ou dar os Relatórios, que
 * não pertencem a plano nenhum.
 *
 * ## As duas perguntas que parecem uma
 *
 * ⚠️ "Até quando vale" e "quanto custa por mês" são independentes, e a tela
 * pergunta as duas separadas porque as quatro combinações existem:
 *
 * - data e valor: a venda normal, que é cobrada todo mês e vence se não pagar.
 * - vitalícia com valor: paga por mês e nunca perde o acesso por atraso.
 * - data sem valor: acesso dado na mão por um tempo.
 * - vitalícia sem valor: acesso para sempre, de graça.
 *
 * Juntar as duas num campo "tipo" com quatro opções esconderia que são duas
 * decisões, e a segunda é a que faz o dinheiro aparecer no lugar certo.
 */
export function DarAssinatura({
  hoje,
  atual,
  estado,
  aoConceder,
  aoEncerrar,
}: {
  hoje: string;
  atual: AssinaturaAtual | null;
  estado: EstadoDaConcessao;
  aoConceder: (
    plano: PlanoAVender,
    venceEm: string | null,
    valorMensal: number | null,
    comecouEm: string,
  ) => void;
  aoEncerrar: (id: string) => void;
}) {
  const { t } = useTranslation('socios');
  const [plano, setPlano] = useState<PlanoAVender>(atual?.plano ?? 'essencial');
  const [vitalicia, setVitalicia] = useState(atual ? atual.venceEm === null : false);
  /*
   * Quando o acordo começou. Hoje, no caso normal.
   *
   * ⚠️ Só aparece ao CRIAR. Trocar o plano de quem já tem assinatura não mexe no
   * começo, porque o histórico de pagamento pendura naquela linha e os meses em
   * aberto contam a partir dele: deixar editar aqui faria a dívida inteira
   * sumir quando o sócio só queria corrigir o valor.
   */
  const [comecouEm, setComecouEm] = useState(hoje);
  // A data continua guardada enquanto "vitalícia" está marcada. Desmarcar
  // devolve o que estava digitado, em vez de um campo vazio que obriga a
  // digitar de novo quem só queria ver a outra opção.
  const [venceEm, setVenceEm] = useState(atual?.venceEm ?? daquiUmMes(hoje));
  const [valor, setValor] = useState(valorComoTexto(atual?.valorMensal ?? null));

  const salvando = estado.tipo === 'salvando';
  const valorLido = lerValorDigitado(valor);
  const valorInvalido = valorLido === 'invalido';
  const mesesQueVaoAbrir = valorInvalido
    ? null
    : mesesAbertosAte(comecouEm, hoje, valorLido);

  return (
    <div className="rounded-rebrand-sm border border-line-2 bg-canvas p-3">
      {atual ? (
        <div className="mb-3">
          {/* ⚠️ `ROTULO_DO_PLANO` entra INTERPOLADO e continua em português de
              propósito (#558): o mesmo rótulo vai dentro da mensagem de cobrança
              que o sócio cola no WhatsApp de um lead brasileiro. */}
          <p className="text-[13px] text-ink">
            <Trans
              t={t}
              i18nKey={
                atual.venceEm === null
                  ? 'dinheiro.assinatura.atual.vitalicia'
                  : 'dinheiro.assinatura.atual.validaAte'
              }
              values={{
                plano: ROTULO_DO_PLANO[atual.plano],
                dia: atual.venceEm === null ? '' : formatarDia(atual.venceEm),
              }}
              components={[<span className="font-bold" key="plano" />]}
            />
          </p>
          <p className="text-[13px] text-ink-2">
            {atual.valorMensal === null
              ? t('dinheiro.assinatura.semCobrancaCombinada')
              : t('dinheiro.assinatura.porMes', { valor: emReais(atual.valorMensal) })}
          </p>
          <button
            type="button"
            disabled={salvando}
            onClick={() => aoEncerrar(atual.id)}
            className="mt-1 text-[12px] font-bold text-ink-2 underline hover:text-ink disabled:opacity-40"
          >
            {t('dinheiro.assinatura.encerrar')}
          </button>
          {/* ⚠️ Dizer isso aqui é o que impede o sócio de encerrar e ir embora
              achando que cortou.

              Encerrar já tirou acesso, e parou de tirar: para saber se podia,
              a função adivinhava quem paga no cartão olhando um campo que quase
              nunca é preenchido — e derrubava o produto de quem estava pagando.
              Sem sinal confiável, a saída foi parar de adivinhar. */}
          <p className="mt-1 text-[11px] text-ink-2">
            <Trans
              t={t}
              i18nKey="dinheiro.assinatura.encerrarNaoTiraAcesso"
              components={[<span className="font-bold" key="naoTira" />]}
            />
          </p>
        </div>
      ) : null}

      <label className="block text-[12px] text-ink-2">
        {t('dinheiro.assinatura.campoPlano')}
        <select
          value={plano}
          disabled={salvando}
          onChange={(e) => setPlano(e.target.value as PlanoAVender)}
          aria-label={t('dinheiro.assinatura.ariaPlano')}
          className={CAMPO}
        >
          {PLANOS_A_VENDER.map((p) => (
            <option key={p} value={p}>
              {ROTULO_DO_PLANO[p]}
            </option>
          ))}
        </select>
      </label>

      {/* O que o plano libera, à vista. "Essencial" não diz nada sobre o
          Betinho ir junto, e ir junto é o que surpreende quem só leu o nome. */}
      <p className="mt-1 text-[12px] text-ink-2">
        {t('dinheiro.assinatura.liberaFrase', { oQue: t(CHAVE_DO_QUE_LIBERA[plano]) })}
      </p>

      {/* As duas perguntas lado a lado em tela larga: são do mesmo tamanho e
          são lidas juntas, porque juntas descrevem o acordo. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-[12px] text-ink-2">
            {t('dinheiro.assinatura.campoValidoAte')}
            <input
              type="date"
              value={vitalicia ? '' : venceEm}
              min={hoje}
              disabled={salvando || vitalicia}
              onChange={(e) => setVenceEm(e.target.value)}
              aria-label={t('dinheiro.assinatura.ariaValidoAte')}
              className={CAMPO}
            />
          </label>

          <label className="mt-1.5 flex items-center gap-2 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={vitalicia}
              disabled={salvando}
              onChange={(e) => setVitalicia(e.target.checked)}
              aria-label={t('dinheiro.assinatura.ariaVitalicia')}
              className="h-4 w-4 rounded border-line-2 accent-forest"
            />
            {t('dinheiro.assinatura.vitaliciaNaoVence')}
          </label>
        </div>

        <label className="block text-[12px] text-ink-2">
          {t('dinheiro.assinatura.campoCobrancaMensal')}
          <input
            type="text"
            inputMode="decimal"
            value={valor}
            // O símbolo da moeda no placeholder segue a MOEDA, e não o idioma: é
            // o mesmo real em qualquer tela, como em `fmtDinheiro`.
            placeholder={t('dinheiro.assinatura.placeholderValor')}
            disabled={salvando}
            onChange={(e) => setValor(e.target.value)}
            aria-label={t('dinheiro.assinatura.ariaValor')}
            className={CAMPO}
          />
          <span className="mt-1 block text-[11px] text-ink-2">
            {valorInvalido
              ? t('dinheiro.comum.valorIlegivel')
              : valorLido === null
                ? t('dinheiro.assinatura.emBrancoSemCobranca')
                : t('dinheiro.assinatura.todoMesRecorrente', { valor: emReais(valorLido) })}
          </span>
        </label>
      </div>

      {estado.tipo === 'erro' && (
        <p className="mt-2 text-[13px] font-bold text-ink">{estado.recado}</p>
      )}

      {atual ? null : (
        <label className="mt-3 block text-[12px] text-ink-2">
          {t('dinheiro.assinatura.campoComecouEm')}
          <input
            type="date"
            value={comecouEm}
            // Para trás no máximo um ano, e nunca para frente. O limite não é da
            // conta, que soma a dívida inteira desde a #451: é proteção contra
            // ano digitado errado, e a mensagem abaixo diz isso.
            min={umAnoAtras(hoje)}
            max={hoje}
            disabled={salvando}
            onChange={(e) => setComecouEm(e.target.value)}
            aria-label={t('dinheiro.assinatura.ariaComecouEm')}
            className={CAMPO}
          />
          <span className="mt-1 block text-[11px] text-ink-2">
            {comecouEm > hoje
              ? t('dinheiro.assinatura.naoComecaNoFuturo')
              : comecouEm < umAnoAtras(hoje)
                ? t('dinheiro.assinatura.maisDeUmAno')
                : mesesQueVaoAbrir === null
                  ? t('dinheiro.assinatura.hojeNoCasoNormal')
                  : /* ⚠️ O aviso central deste campo. Retroagir com cobrança
                       combinada faz a pessoa aparecer devendo vários meses de
                       uma vez, e esse número não pode pegar ninguém de
                       surpresa depois, na fila. */
                    t('dinheiro.assinatura.vaiAbrir', {
                      count: mesesQueVaoAbrir,
                      total: emReais(mesesQueVaoAbrir * (valorLido as number)),
                    })}
          </span>
        </label>
      )}

      <button
        type="button"
        // Sem data e sem vitalícia não há como saber quando isto acaba, e é
        // essa resposta que coloca a pessoa na fila de vencimento.
        disabled={
          salvando ||
          valorInvalido ||
          (!vitalicia && !venceEm) ||
          (!atual && (comecouEm > hoje || comecouEm < umAnoAtras(hoje)))
        }
        onClick={() =>
          aoConceder(
            plano,
            vitalicia ? null : venceEm,
            valorInvalido ? null : valorLido,
            atual ? hoje : comecouEm,
          )
        }
        className="mt-3 h-10 w-full rounded-rebrand-sm bg-forest px-3 text-[13px] font-bold text-white disabled:opacity-40"
      >
        {salvando
          ? t('dinheiro.comum.gravando')
          : atual
            ? t('dinheiro.assinatura.trocarPlanoOuPrazo')
            : t('dinheiro.assinatura.darEstaAssinatura')}
      </button>

      <p className="mt-2 text-[11px] text-ink-2">
        {/* O aviso de que nada encerra sozinho fica aqui, onde se decide o
            acordo, porque é a pergunta que surge ao dar uma assinatura: e se a
            pessoa parar de pagar? */}
        {vitalicia
          ? t('dinheiro.assinatura.avisoVitalicia')
          : t('dinheiro.assinatura.avisoComPrazo')}
      </p>
    </div>
  );
}
