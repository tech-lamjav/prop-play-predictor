// ============================================================
// ATENÇÃO: DEPOIMENTOS FICTÍCIOS. NÃO SUBIR PRA TRÁFEGO.
//
// Estes textos NÃO são de clientes reais. Existem só pra aprovar o layout da
// LP com o bloco cheio. Antes de qualquer anúncio apontar pra cá, eles têm que
// ser trocados por depoimento real com autorização, ou o bloco sai do ar.
//
// Publicar depoimento inventado em página de aposta é problema de consumidor
// (CONAR e CDC), e contradiz o que a própria /futebol/comecar promete na lista
// "o que você nunca vai ver aqui".
//
// Pra coletar os reais: a mensagem pronta está em docs/lp-testes-plano.md, e o
// público certo são os 109 usuários que já registraram aposta.
//
// De propósito, nenhum deles promete lucro nem cita valor ganho: se algum dia
// escapar pro ar por descuido, o estrago é menor.
// ============================================================

export interface Depoimento {
  nome: string;
  contexto: string;
  texto: string;
}

export const DEPOIMENTOS_FICTICIOS: Depoimento[] = [
  {
    nome: "Rafael M.",
    contexto: "usa desde março",
    texto:
      "O que mais me pegou foi ver o porquê de cada oportunidade. Não é só o palpite, é o motivo do lado. Mudou meu jeito de olhar o jogo.",
  },
  {
    nome: "Diego S.",
    contexto: "aposta há 6 anos",
    texto:
      "Eu entrava muito no impulso, principalmente em jogo do meu time. Hoje eu olho quantos filtros apontam junto e deixo passar quando não bate.",
  },
  {
    nome: "Bruno A.",
    contexto: "usa desde abril",
    texto:
      "Não é que eu acerto tudo agora. É que quando eu entro, eu sei por que entrei. Isso me deixou bem mais tranquilo pra decidir.",
  },
];
