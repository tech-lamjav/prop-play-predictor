import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AREA_DA_COPY, type CopyComParametros } from '@/utils/futebol-copy';
import { chaveDoTextoDoScore, CHAVE_TEXTO_CHANCE, CHAVE_TEXTO_ODD } from '@/utils/futebol-ajuda-copy';
import { chaveDaCompeticao, competitionLabel } from '@/utils/futebol-competitions';
import { copyDoSufixoDeLeitura } from '@/utils/futebol-leitura';
import { chaveDoRotuloDaExplicacao, type RotuloDaExplicacao } from '@/utils/futebol-motivos';
import {
  chaveDaLeitura,
  chaveDaPremissa,
  chaveDoMercadoNoCatalogo,
  chaveDoMotivoDaPremissa,
  chaveDoPeso,
  copyDaSaida,
  type Premissa,
  type SeloDaLeitura,
} from '@/utils/futebol-premissas';
import {
  chaveDaPalavraDaFaixa,
  chaveDoMercadoCurto,
  chaveDoMercadoLongo,
  chaveDoRotuloDaFaixa,
  copyDoOutcome,
  copyDoPick,
  marketLabel,
  marketShort,
} from '@/utils/futebol-score';
import { chaveDoSeloDeResultado, type BetResult } from '@/utils/futebol-settlement';
import type { FutebolScoreVersion } from '@/services/futebol-score-contract';
import type { Saida } from '@/utils/futebol-saida';

// ============================================================================
// use-copy-do-futebol.ts — a tela pede a copy por IDENTIFICADOR
// ============================================================================
// Os catálogos de copy do futebol vivem em `src/utils` e devolvem português,
// porque as frases das premissas são contrato com o banco: a migration semeia
// `futebol_premissa_copy` a partir delas, três RPCs leem de lá e é de lá que sai
// a DM do Telegram. Trocar o texto por chave dentro daquelas funções reprovaria
// na guarda de paridade da copy — corretamente — e, contornada a guarda, a DM
// passaria a mandar chave crua para quem paga.
//
// Então quem traduz é a TELA, e ela pede a frase pela chave estável de cada
// item: mercado + slug + mando na premissa, o próprio `BetResult` na liquidação,
// o `tone` na faixa. Chave não muda quando a copy muda, e é isso que faz este
// desenho sobreviver à próxima reescrita de premissa.
//
// ⚠️ ESTE HOOK É O ÚNICO LUGAR QUE SABE O NOME DA ÁREA. Tela que monte
// `t('premissas:...')` à mão espalha esse conhecimento e é o começo de a próxima
// área nascer com o prefixo errado.
//
// O que ele NÃO cobre, e não é esquecimento: o texto que a RPC devolve pronto
// (`evidencias`, `contras`, `avisos` da linha de valor). Aquilo é servido pelo
// banco, em português, pela mesma tabela que alimenta a DM. Traduzir na tela
// exigiria casar TEXTO com chave, que é exatamente a comparação por frase que
// este ticket veio matar.
// ============================================================================

/** O que a tela chama para trocar uma chave de copy do futebol pela frase. */
export type CopyDoFutebol = {
  /** A frase de uma premissa, pelo par mercado+slug e pelo mando da aposta. */
  premissa: (
    market: string,
    p: Premissa,
    lado: 'home' | 'away' | null,
    negativo?: boolean,
  ) => string;
  /** O "por que vale pouco" de uma premissa. Vazio quando ela não tem. */
  motivoDaPremissa: (market: string, p: Premissa) => string;
  /** O nome do mercado no catálogo de premissas ("Gols (mais ou menos)"). */
  mercadoNoCatalogo: (slug: string) => string;
  /** O nome longo do mercado ("Gols (Over/Under)"). */
  mercadoLongo: (slug: string) => string;
  /** O nome curto do mercado ("Gols"). */
  mercadoCurto: (slug: string) => string;
  /** O rótulo da saída, na linguagem do apostador ("Vitória do Flamengo"). */
  saida: (s: Saida, home: string, away: string) => string;
  /** O rótulo da aposta ("Mais de 2,5 gols", "Flamengo +1,5"). */
  pick: (s: Saida, home: string, away: string) => string;
  /** O outcome do 1X2 ("Empate", ou o nome do time). */
  outcome: (outcome: string, home: string, away: string) => string;
  /** O selo de peso da premissa ("Pesa muito"). */
  peso: (p: Premissa) => string;
  /** O selo de força da leitura ("Leitura forte"). */
  leitura: (tone: SeloDaLeitura) => string;
  /** A palavra da faixa ("Alta"). Aceita a faixa do backend ou o `tone`. */
  palavraDaFaixa: (faixa: string) => string;
  /** O rótulo da faixa em frase ("faixa alta", "sem faixa"). */
  rotuloDaFaixa: (faixa: string | null | undefined) => string;
  /** O selo do veredito de liquidação ("Green", "Anulada"). */
  seloDeResultado: (r: BetResult) => string;
  /** O nome da competição. Nome próprio sem entrada no catálogo sai como está. */
  competicao: (slug: string | null | undefined) => string;
  /** O sufixo "· N com leitura". Vazio enquanto o board não respondeu. */
  sufixoDeLeitura: (carregando: boolean, comLeitura: number) => string;
  /** Sob que rótulo a explicação da leitura é apresentada. */
  rotuloDaExplicacao: (rotulo: RotuloDaExplicacao) => string;
  /** A explicação do Score, na escala em que a nota foi calculada. */
  textoDoScore: (versao: FutebolScoreVersion | undefined) => string;
  /** A explicação da chance. */
  textoDaChance: () => string;
  /** A explicação da odd. */
  textoDaOdd: () => string;
};

export function useCopyDoFutebol(): CopyDoFutebol {
  const { t } = useTranslation(AREA_DA_COPY);

  return useMemo(() => {
    const montar = ({ chave, params }: CopyComParametros) => t(chave, params ?? {});

    return {
      premissa: (market, p, lado, negativo = false) =>
        t(chaveDaPremissa(market, p, lado, negativo)),
      motivoDaPremissa: (market, p) => {
        const chave = chaveDoMotivoDaPremissa(market, p);
        return chave == null ? '' : t(chave);
      },
      mercadoNoCatalogo: (slug) => t(chaveDoMercadoNoCatalogo(slug)),
      // Mercado fora do catálogo continua saindo como o slug veio, igual ao que
      // `marketLabel` já fazia: chave inexistente faria a tela mostrar o CÓDIGO
      // da chave, que é pior que o slug.
      mercadoLongo: (slug) => {
        const chave = chaveDoMercadoLongo(slug);
        return chave == null ? marketLabel(slug) : t(chave);
      },
      mercadoCurto: (slug) => {
        const chave = chaveDoMercadoCurto(slug);
        return chave == null ? marketShort(slug) : t(chave);
      },
      saida: (s, home, away) => montar(copyDaSaida(s, home, away)),
      pick: (s, home, away) => montar(copyDoPick(s, home, away)),
      outcome: (outcome, home, away) => montar(copyDoOutcome(outcome, home, away)),
      peso: (p) => t(chaveDoPeso(p)),
      leitura: (tone) => t(chaveDaLeitura(tone)),
      palavraDaFaixa: (faixa) => t(chaveDaPalavraDaFaixa(faixa)),
      rotuloDaFaixa: (faixa) => t(chaveDoRotuloDaFaixa(faixa)),
      seloDeResultado: (r) => t(chaveDoSeloDeResultado(r)),
      // Sem competição é o travessão, que TEM chave; nome próprio que o catálogo
      // não conhece sai do humanize, que é o mesmo nome em qualquer idioma.
      competicao: (slug) => {
        if (!slug) return t('competicao.nenhuma');
        const chave = chaveDaCompeticao(slug);
        return chave == null ? competitionLabel(slug) : t(chave);
      },
      sufixoDeLeitura: (carregando, comLeitura) => {
        const pedido = copyDoSufixoDeLeitura(carregando, comLeitura);
        return pedido == null ? '' : montar(pedido);
      },
      rotuloDaExplicacao: (rotulo) => t(chaveDoRotuloDaExplicacao(rotulo)),
      textoDoScore: (versao) => t(chaveDoTextoDoScore(versao)),
      textoDaChance: () => t(CHAVE_TEXTO_CHANCE),
      textoDaOdd: () => t(CHAVE_TEXTO_ODD),
    };
  }, [t]);
}
