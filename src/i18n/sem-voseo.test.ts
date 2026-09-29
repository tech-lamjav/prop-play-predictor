import { describe, expect, it } from 'vitest';
import { carregarArea } from './carregar';
import { AREAS } from './idiomas';

// ============================================================================
// A guarda contra voseo (#536)
// ============================================================================
// O espanhol do produto é PAN-HISPÂNICO: ele serve Peru, Argentina, México e
// Chile ao mesmo tempo, porque o produto não sabe de que país a pessoa veio
// (detecção por país está fora do escopo do #532). Voseo — "podés", "hacé
// clic", "mirá" — é rio-platense: natural em Buenos Aires, estrangeiro em Lima,
// Cidade do México e Santiago. Um país dos quatro.
//
// ⚠️ ESTE TESTE EXISTE PORQUE A VERIFICAÇÃO MANUAL FALHOU, E FALHOU FEIO.
//
// A primeira tentativa foi um `grep` com uma lista de verbos escrita à mão. Ela
// errou de duas maneiras ao mesmo tempo:
//
//   1. não continha "conectá", "recibí", "creá", "liberá", "indicá", "marcá"
//      nem "cambiá" — ninguém lembra de todos os verbos de um idioma
//   2. usava `\b` depois de caractere acentuado, e a borda de palavra não casa
//      ali, então nem os verbos QUE ESTAVAM na lista foram encontrados
//
// Resultado: a varredura declarou "nenhuma ocorrência" com 15 na árvore. Achou
// 3 de 15 e deu verde. Lista de exemplos não é detector.
//
// O QUE ESTE TESTE FAZ DIFERENTE: busca a FORMA, não a palavra. O voseo tem
// morfologia previsível — o imperativo é o infinitivo sem o `-r` final com
// acento na última sílaba (hablar→hablá, comer→comé, vivir→viví), e o presente
// de segunda pessoa termina em `-ás`/`-és`/`-ís` (hablás, comés, vivís). Então
// ele casa o sufixo e SUBTRAI as palavras legítimas que casam por coincidência.
//
// É assim que ele acha verbo que ninguém listou. Quando reprovar por uma
// palavra legítima nova, o conserto é acrescentá-la a `LEGITIMAS` — nunca
// afrouxar o padrão.
// ============================================================================

/** Palavras legítimas do espanhol cuja forma coincide com a do voseo. */
const LEGITIMAS = new Set([
  // -á
  'está', 'acá', 'allá', 'ojalá', 'sofá', 'mamá', 'papá', 'quizá', 'panamá',
  // -é
  'café', 'porqué', 'qué', 'bebé', 'josé',
  // Subjuntivo de "estar": espanhol normal, não voseo.
  'esté', 'estés',
  // -í
  'aquí', 'así', 'ahí', 'allí', 'maní', 'sí', 'perú',
  // -ás — inclui `estás`, que é a segunda pessoa de "tú" e é o que QUEREMOS
  'más', 'jamás', 'quizás', 'demás', 'estás', 'atrás', 'detrás', 'además',
  // -és
  'inglés', 'después', 'través', 'cortés', 'francés', 'mes', 'interés',
  // -ís
  'país', 'parís',
]);

const FORMA_DE_VOSEO = /^[a-záéíóúñü]+(á|é|í|ás|és|ís)$/;

/** Todo texto de um catálogo, achatado, com a chave de cada um. */
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
          const base = palavra.toLowerCase();
          if (FORMA_DE_VOSEO.test(base) && !LEGITIMAS.has(base)) {
            achados.push(`${chave}: "${palavra}" em — ${texto.slice(0, 80)}`);
          }
        }
      }

      // A mensagem lista a chave e a frase: quem quebrar isto precisa saber
      // ONDE, não só que aconteceu.
      expect(achados, `formas de voseo em es/${area}:\n${achados.join('\n')}`).toEqual([]);
    });
  }
});
