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
  'adicionales', 'cancela', 'cancelas', 'cancelo', 'empate', 'escala',
  'especiales', 'modelo', 'niveles', 'oficiales', 'oscila', 'paneles',
  'potenciales', 'principales', 'promete', 'promocionales', 'totales',
  'señala', 'señalan',
  // Nome de variável de interpolação que aparece dentro do texto.
  'janela',
  // ⚠️ FUTUROS IRREGULARES. O futuro regular é pego por `FUTURO` abaixo, mas
  // estes encurtam o radical e terminam em `-drás`, `-brás` ou `-rrás`, que o
  // padrão não alcança. E não dá para alcançar: "querrás" (futuro legítimo)
  // tem exatamente a forma de "cerrás" (presente do voseo). Por sorte é
  // conjunto FECHADO — o espanhol tem uma dúzia — então a lista é completa e
  // não cresce.
  'habrás', 'cabrás', 'podrás', 'querrás', 'sabrás', 'pondrás',
  'saldrás', 'tendrás', 'valdrás', 'vendrás',
]);

/** A forma clássica: infinitivo sem o -r, com acento na última sílaba. */
const SUFIXO_ACENTUADO = /^[a-záéíóúñü]+(á|é|í|ás|és|ís)$/;

/**
 * O FUTURO do indicativo, que é igual em "tú" e em "vos".
 *
 * ⚠️ Esta exceção nasceu de a guarda acusar "Recibirás", que é espanhol
 * perfeito e pan-hispânico. O futuro de segunda pessoa termina em `-ás` e
 * colide com o presente do voseo: "hablarás" (futuro, legítimo) contra
 * "hablás" (presente, rio-platense).
 *
 * O que os separa é a forma: o futuro é o INFINITIVO INTEIRO mais `-ás`, então
 * termina em `-arás`, `-erás` ou `-irás`. O presente do voseo é o radical mais
 * `-ás`, e só cai nesse padrão quando o radical já acaba em `r` — "cerrás"
 * termina em `rrás`, e continua sendo acusado, que é o certo.
 */
const FUTURO = /(arás|erás|irás)$/;

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

const TEM_ACENTO = /[áéíóú]/;
const silabas = (p: string) => (p.match(/[aeiouáéíóúü]+/g) ?? []).length;

function ehVoseo(palavra: string): boolean {
  const b = palavra.toLowerCase();
  if (LEGITIMAS.has(b)) return false;
  if (MARCAS.has(b)) return true;
  if (FUTURO.test(b)) return false;
  if (SUFIXO_ACENTUADO.test(b)) return true;
  return COM_PRONOME_COLADO.test(b) && !TEM_ACENTO.test(b) && silabas(b) >= 3;
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
        for (const palavra of texto.match(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]+/g) ?? []) {
          if (ehVoseo(palavra)) {
            achados.push(`${chave}: "${palavra}" em — ${texto.slice(0, 80)}`);
          }
        }
      }

      // A mensagem lista chave e frase: quem quebrar isto precisa saber ONDE.
      expect(achados, `formas de voseo em es/${area}:\n${achados.join('\n')}`).toEqual([]);
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
    ]) {
      expect(ehVoseo(escapou), `deveria acusar: ${escapou}`).toBe(true);
    }
  });

  it('não acusa espanhol legítimo', () => {
    for (const legitimo of [
      'está', 'después', 'país', 'interés', 'más', 'aquí', 'estás', 'esté',
      'principales', 'empate', 'modelo', 'cancela', 'ajústala', 'regístrala',
      'suscríbete', 'míralo', 'puedes', 'prueba', 'haz',
      // Futuro do indicativo: igual em tú e em vos, e portanto legítimo.
      'recibirás', 'hablarás', 'podrás', 'tendrás', 'vivirás',
    ]) {
      expect(ehVoseo(legitimo), `não deveria acusar: ${legitimo}`).toBe(false);
    }
  });
});
