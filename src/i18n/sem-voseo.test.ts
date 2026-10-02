import { describe, expect, it } from 'vitest';
import { carregarArea } from './carregar';
import { AREAS } from './idiomas';

// ============================================================================
// A guarda contra voseo (#536)
// ============================================================================
// O espanhol do produto é PAN-HISPÂNICO: serve Peru, Argentina, México e Chile
// ao mesmo tempo, porque o produto não sabe de que país a pessoa veio (detecção
// por país está fora do escopo do #532). Voseo — "podés", "hacé clic", "mirá" —
// é rio-platense: natural em Buenos Aires, estrangeiro em Lima, Cidade do
// México e Santiago. Um país dos quatro.
//
// ⚠️ ESTA GUARDA TEM DUAS GERAÇÕES, E AS DUAS FALHARAM ANTES DE ACERTAR.
//
// PRIMEIRA: um `grep` com lista de verbos escrita à mão. Errou de duas maneiras
// ao mesmo tempo — a lista não continha "conectá", "recibí", "creá", "liberá",
// "indicá", "marcá" nem "cambiá", e usava `\b` depois de caractere acentuado,
// onde a borda de palavra não casa. Declarou limpo com QUINZE na árvore: achou
// 3 de 15 e deu verde.
//
// SEGUNDA: o teste por sufixo acentuado que substituiu o grep. Melhor, mas com
// um buraco que uma revisão apontou — o imperativo com PRONOME COLADO perde o
// acento: "hacelo", "fijate", "ajustala", "registrala", "suscribite". Nenhum
// termina em vogal acentuada, e todos passavam. Havia três na árvore.
//
// A lição das duas: detector precisa cobrir a MORFOLOGIA, e quando a morfologia
// é ambígua, precisa pagar o preço de uma lista de exceções explícita — nunca
// afrouxar o padrão. As exceções abaixo são palavras legítimas do espanhol que
// coincidem com a forma; acrescentar uma delas é o conserto certo quando este
// teste reprovar por engano. Afrouxar o padrão é o conserto errado.
// ============================================================================

/** Palavras legítimas do espanhol cuja forma coincide com a do voseo. */
const LEGITIMAS = new Set([
  // Terminação acentuada (-á/-é/-í) e -ás/-és/-ís
  'está', 'acá', 'allá', 'ojalá', 'sofá', 'mamá', 'papá', 'quizá', 'panamá',
  'café', 'porqué', 'qué', 'bebé', 'josé',
  'esté', 'estés', // subjuntivo de "estar"
  'aquí', 'así', 'ahí', 'allí', 'maní', 'sí', 'perú',
  'más', 'jamás', 'quizás', 'demás', 'estás', 'atrás', 'detrás', 'además',
  'inglés', 'después', 'través', 'cortés', 'francés', 'mes', 'interés',
  'país', 'parís',
  // Terminam em pronome por coincidência, sem acento, com três sílabas ou mais.
  // Todas medidas nos catálogos deste produto; a lista cresce por medição.
  'cancela', 'cancelas', 'cancelo', 'empate', 'escala', 'modelo',
  'oscila', 'promete', 'señala', 'señalan',
  // Nome próprio terminado em vogal acentuada.
  'canadá',
  // ⚠️ PRETÉRITO DE PRIMEIRA PESSOA, e a razão de ele morar numa lista.
  // "leí" e "registré" são o passado de quem fala — a voz do Betinho, que
  // em português diz "Li o print e registrei!". E o pretérito de primeira
  // pessoa de uma conjugação tem a MESMA grafia do imperativo rio-platense de
  // outra: "viví" é as duas coisas, sem nada na palavra que diga qual.
  //
  // Alguém reescreveu a frase para "¡Captura leída y apuesta registrada!" só
  // para calar este teste, e com isso o Betinho parou de falar na primeira
  // pessoa em espanhol. A frase voltou; o conserto certo é esta lista.
  'leí', 'registré', 'pensé', 'vi', 'encontré',
  // ⚠️ OS FUTUROS IRREGULARES NÃO MORAM AQUI, e sim em `FUTURO` abaixo, com
  // os regulares: é a mesma pergunta ("isto é futuro?") e estava respondida
  // em dois lugares.
]);

/** A forma clássica: infinitivo sem o -r, com acento na última sílaba. */
const SUFIXO_ACENTUADO = /^[a-záéíóúñü]+(á|é|í|ás|és|ís)$/;

const TEM_ACENTO = /[áéíóú]/;
const silabas = (p: string) => (p.match(/[aeiouáéíóúü]+/g) ?? []).length;

/**
 * O FUTURO do indicativo, que é legítimo e tem a forma do voseo.
 *
 * "Recibirás" é espanhol perfeito e pan-hispânico, e esta guarda o acusava. O
 * futuro de segunda pessoa termina em `-ás` e o de terceira em `-á`, as duas
 * terminações do voseo: "hablarás" (futuro) contra "hablás" (presente
 * rio-platense).
 *
 * ⚠️ É LISTA, E NÃO REGRA, E ISSO FOI MEDIDO — TRÊS REGRAS FALHARAM ANTES.
 *
 * A tentação é separar por morfologia: o futuro é o INFINITIVO INTEIRO mais a
 * desinência, então tirar o acento deixaria um infinitivo atrás, e o voseo
 * deixaria um radical. Três versões dessa regra foram escritas, e cada uma
 * abriu um buraco que o teste de regressão pegou:
 *
 *   1. casar `-ará|-erá|-irá` engoliu "mirá", que termina em "irá";
 *   2. exigir que a raiz termine em "ar|er|ir" engoliu "mirá" outra vez,
 *      porque "mir" termina em "ir";
 *   3. exigir duas sílabas na raiz engoliu "liberá", porque "liber" tem duas.
 *
 * A terceira não foi azar, foi prova: **"liberá" (voseo de "liberar") e
 * "beberá" (futuro de "beber") têm exatamente a mesma forma** — consoante,
 * vogal, consoante, vogal, "r", "á". Nenhuma regra ortográfica separa as duas,
 * porque a diferença não está na grafia: está em qual dos dois verbos existe.
 * Isso é léxico, e léxico se escreve à mão.
 *
 * Então a lista. O preço é que um futuro novo na copy reprova e precisa de uma
 * linha aqui — e é o preço certo a pagar, porque o erro para o outro lado foi o
 * que derrubou as duas primeiras gerações desta guarda: "creá", "indicá",
 * "marcá" e "cambiá" estavam na árvore com o teste verde.
 *
 * Medido: nos catálogos de hoje existe UM futuro regular, "recibirás". O resto
 * da lista são os irregulares (conjunto fechado) e os regulares que a copy
 * provavelmente vai querer.
 */
const FUTURO = new Set([
  // Irregulares: encurtam o radical, e o espanhol tem uma dúzia. Fechado.
  'habré', 'habrá', 'habrás', 'cabrá', 'cabrás', 'podrá', 'podrás',
  'querrá', 'querrás', 'sabrá', 'sabrás', 'pondrá', 'pondrás',
  'saldrá', 'saldrás', 'tendrá', 'tendrás', 'valdrá', 'valdrás',
  'vendrá', 'vendrás', 'será', 'serás', 'dirá', 'dirás', 'hará', 'harás',
  'dará', 'darás', 'irá', 'irás', 'verá', 'verás',
  // Regulares. "recibirás" é o único que está nos catálogos; os outros entram
  // porque são os verbos desta tela e a copy vai pedir.
  'recibirá', 'recibirás', 'hablará', 'hablarás', 'vivirá', 'vivirás',
  'apostará', 'apostarás', 'podrás', 'ganará', 'ganarás',
  'registrará', 'registrarás', 'empezará', 'empezarás',
]);

/**
 * A forma com pronome colado, que PERDE o acento: "ajustala", "suscribite".
 *
 * Em espanhol de "tú" a mesma construção EXIGE acento escrito ("ajústala"),
 * porque o acento cai na antepenúltima. Então: termina em pronome, não tem
 * acento nenhum, e tem três sílabas ou mais = suspeita.
 */
const COM_PRONOME_COLADO = /^[a-zñü]+[aei](lo|la|los|las|le|les|me|te|se|nos)$/;

/** As duas marcas mais reconhecíveis, e sem ambiguidade nenhuma. */
const MARCAS = new Set(['sos', 'vos']);


/**
 * Plural de palavra já aceita.
 *
 * ⚠️ ENTROU PARA A LISTA PARAR DE CRESCER. "modelo" estava em `LEGITIMAS` e
 * "Modelos" era acusado — a mesma palavra, no plural, batendo no padrão de
 * pronome colado (`mode` + `los`). Acrescentar cada plural à mão é como a lista
 * virou gaveta antes: o conserto é a regra, não mais uma linha.
 *
 * Não abre buraco: "probalos" continua acusado, porque "probalo" também é.
 */
function ehPluralDeLegitima(palavra: string): boolean {
  return palavra.endsWith('s') && LEGITIMAS.has(palavra.slice(0, -1));
}

/**
 * Plural de palavra terminada em "-l", que é morfologia e não pronome.
 *
 * ⚠️ ESTA REGRA EXISTE PARA ENCURTAR A LISTA, e encurtou em nove palavras.
 * O espanhol forma o plural de "nivel", "actual", "total", "panel",
 * "especial", "principal", "adicional", "oficial" e "potencial"
 * acrescentando "-es" — e todas caem no padrão de pronome colado, porque
 * terminam em vogal seguida de "les". As nove estavam escritas uma a uma em
 * `LEGITIMAS`, e "actuales" foi a décima a aparecer. Palavra terminada em
 * "-les" depois de vogal é plural, não imperativo com pronome.
 *
 * ⚠️ O BURACO, DITO POR EXTENSO: o imperativo rio-platense com "-les" colado
 * passa a escapar — "deciles", "dales". O singular continua pego ("decile"), e
 * as marcas sem ambiguidade ("vos", "sos") e as formas acentuadas também. Foi
 * escolha medida: o plural em "-les" é uma classe grande e viva na copy, e o
 * imperativo com "-les" nunca apareceu nenhuma vez nas três gerações desta
 * guarda.
 */
const PLURAL_EM_L = /[aeiou]les$/;

function ehVoseo(palavra: string): boolean {
  const b = palavra.toLowerCase();
  if (LEGITIMAS.has(b)) return false;
  if (ehPluralDeLegitima(b) || PLURAL_EM_L.test(b)) return false;
  if (MARCAS.has(b)) return true;
  if (FUTURO.has(b)) return false;
  if (SUFIXO_ACENTUADO.test(b)) return true;
  return COM_PRONOME_COLADO.test(b) && !TEM_ACENTO.test(b) && silabas(b) >= 3;
}

/**
 * Tira os marcadores de interpolação antes de olhar o texto.
 *
 * ⚠️ NASCEU DE A GUARDA TER FORÇADO UM RENAME EM PRODUÇÃO. O nome da variável
 * dentro de `{{...}}` não é texto que alguém lê — é identificador, e quase
 * sempre em português, porque o código deste produto é em português. Nomes
 * como `{{tabela}}`, `{{janela}}` e `{{doTime}}` caem no padrão de pronome
 * colado e eram acusados como voseo.
 *
 * Alguém chegou a RENOMEAR duas variáveis para calar o teste, e isso é o
 * avesso: a guarda existe para proteger a copy, não para ditar nome de
 * parâmetro. Antes disto a saída foi pior ainda — acrescentei `janela` à lista
 * de exceções, tratando o sintoma e deixando a armadilha armada para o
 * próximo nome.
 */
function semInterpolacao(texto: string): string {
  return texto.replace(/\{\{[^}]*\}\}/g, ' ');
}

function textos(obj: unknown, prefixo = ''): Array<[string, string]> {
  if (typeof obj === 'string') return [[prefixo, obj]];
  if (obj === null || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    textos(v, prefixo ? `${prefixo}.${k}` : k),
  );
}

describe('o espanhol do produto é pan-hispânico', () => {
  for (const area of AREAS) {
    it(`sem voseo em "${area}"`, async () => {
      const achados: string[] = [];

      for (const [chave, texto] of textos(await carregarArea('es', area))) {
        for (const palavra of semInterpolacao(texto).match(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]+/g) ?? []) {
          if (ehVoseo(palavra)) {
            achados.push(`${chave}: "${palavra}" em — ${texto.slice(0, 80)}`);
          }
        }
      }

      // ⚠️ A MENSAGEM DIZ O QUE FAZER, E NÃO SÓ O QUE ACHOU.
      //
      // Duas vezes esta guarda foi "resolvida" pelo caminho errado: alguém
      // renomeou uma variável de produção, e alguém REESCREVEU a copy em
      // espanhol para desviar de "Leí la captura y la registré" — que é
      // espanhol perfeito. A guarda existe para proteger o texto, não para
      // ditá-lo, e a mensagem precisa dizer isso para quem a encontrar
      // quebrada às duas da manhã.
      expect(
        achados,
        `possível voseo em es/${area}:\n${achados.join('\n')}\n\n` +
          '⚠️ ANTES DE REESCREVER A FRASE: o pretérito de primeira pessoa ' +
          '("leí", "registré", "pensé") tem a MESMA grafia do imperativo ' +
          'rio-platense de outra conjugação, e nenhum padrão separa os dois ' +
          'sem contexto.\n' +
          'Se a forma estiver certa, acrescente a palavra a LEGITIMAS neste ' +
          'arquivo. NÃO torça a copy para calar o teste, e NÃO afrouxe o padrão.',
      ).toEqual([]);
    });
  }

  it('reconhece as formas que já escaparam uma vez', () => {
    // Regressão explícita, com os casos REAIS que cada geração desta guarda
    // deixou passar. Se um detector novo não pegar estes, ele regrediu.
    for (const escapou of [
      'podés', 'hacé', 'Mirá', 'Recibí', 'Creá', 'liberá', 'Indicá', 'Marcá', 'Cambiá',
      'ajustala', 'registrala', 'suscribite', 'hacelo', 'fijate', 'probalo', 'decime',
      'sos', 'vos',
      // Presente do voseo cujo radical acaba em r: parece futuro e não é.
      'cerrás',
      // O imperativo com pronome colado no SINGULAR continua pego: é o plural
      // em -les que a regra de morfologia deixa passar, e isso está dito lá.
      'decile',
    ]) {
      expect(ehVoseo(escapou), `deveria acusar: ${escapou}`).toBe(true);
    }
  });

  it('não acusa NOME DE VARIÁVEL de interpolação', () => {
    // Regressão do caso que fez alguém renomear código de produção para calar
    // este teste. O que está dentro de `{{...}}` é identificador, não texto —
    // e os identificadores deste produto são em português, então caem no
    // padrão de pronome colado com facilidade.
    const comVariaveis = 'Últimos {{janela}} de {{tabela}}, {{doTime}} y {{resultadoDaRodada}}';
    const acusadas = (semInterpolacao(comVariaveis).match(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]+/g) ?? []).filter(
      ehVoseo,
    );
    expect(acusadas, `acusou nome de variável: ${acusadas.join(', ')}`).toEqual([]);
  });

  it('não acusa espanhol legítimo', () => {
    for (const legitimo of [
      'está', 'después', 'país', 'interés', 'más', 'aquí', 'estás', 'esté',
      'principales', 'empate', 'modelo', 'cancela', 'ajústala', 'regístrala',
      'suscríbete', 'míralo', 'puedes', 'prueba', 'haz',
      // Futuro do indicativo: igual em tú e em vos, e portanto legítimo.
      'recibirás', 'hablarás', 'podrás', 'tendrás', 'vivirás',
      // Plural de palavra terminada em -l: morfologia, não pronome colado.
      // As três primeiras apareceram nos catálogos e fizeram a regra existir.
      'actuales', 'Modelos', 'Canadá', 'niveles', 'totales', 'principales',
      // Futuro de TERCEIRA pessoa, que fez alguém reescrever a copy.
      'será', 'podrá', 'tendrá', 'hablará', 'vendrá', 'dirá', 'hará',
    ]) {
      expect(ehVoseo(legitimo), `não deveria acusar: ${legitimo}`).toBe(false);
    }
  });
});
