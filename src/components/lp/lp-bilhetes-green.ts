// ============================================================
// Bilhetes ganhos, recortados do histórico da casa.
//
// O QUE ESTES BILHETES SÃO: apostas reais, ganhas, feitas na conta da própria
// operação. Os recortes saíram de prints do histórico da KTO, cortados no card
// de cada aposta — sem o cabeçalho do site, sem o saldo da conta e sem a barra
// de navegação.
//
// O QUE ELES NÃO SÃO, e isto foi verificado no banco de produção em 08/09/2026:
// nenhum deles corresponde a uma oportunidade publicada pela plataforma.
//
//   · Cruzeiro x Mirassol (09/08) — zero linhas no board e no histórico, em
//     qualquer mercado. A data está dentro da janela em que o histórico já
//     existia, então a ausência é evidência, e não falta de registro.
//   · Chelsea x Brighton (30/08) — zero linhas no board, no histórico e no
//     envio do Telegram.
//   · Argentina x Egito (07/07) — zero linhas, mas o histórico só começa em
//     27/07, então aqui não dá pra concluir nada nos dois sentidos.
//
// Por isso a copy desta seção fala de aposta da casa, e NÃO diz que a
// metodologia do Score apontou estes jogos. No dia em que entrar aqui um
// bilhete que bata com um pick publicado, aí sim dá pra citar o Score — e aí
// os campos do Score entram junto com o primeiro bilhete que os use, não
// antes.
//
// Os mercados foram filtrados de propósito: só entra bilhete de mercado que a
// plataforma cobre, que são cinco — resultado final, total de gols, handicap
// asiático, ambas marcam e dupla chance. Os prints de origem também tinham
// green de escanteio, cartão, chutes por jogador, marcador e tempo extra, e
// esses ficaram de fora: um green de escanteio na landing manda o visitante
// procurar escanteio no produto e não achar.
//
// VALIDADE: nada com mais de 90 dias, e quem garante isso é o teste ao lado,
// que lê o campo `dataISO`. Quando ele ficar vermelho, é porque a prova social
// envelheceu — troque o bilhete mais antigo, recortando do print no mesmo
// enquadramento (do "Simples • Ganha" até a linha de dinheiro).
// ============================================================

export interface BilheteGreen {
  /** Arquivo em public/prova/. */
  src: string;
  /** Dimensões reais do recorte, pra reservar o espaço e não pular o layout. */
  largura: number;
  altura: number;
  /** Descrição da imagem pra quem usa leitor de tela. */
  alt: string;
  jogo: string;
  competicao: string;
  /** Dia da aposta, escrito como aparece na legenda. */
  data: string;
  /** O mesmo dia em formato comparável, que é o que o teste dos 90 dias lê. */
  dataISO: string;
  /** Placar final, conferido em futebol.fact_fixtures. */
  placar: string;
}

export const BILHETES_GREEN: BilheteGreen[] = [
  {
    src: "/prova/bilhete-cruzeiro-mirassol.png",
    largura: 589,
    altura: 206,
    alt: "Bilhete ganho: Resultado Final Cruzeiro, odd 3.00, aposta de R$ 1.000 e pagamento de R$ 3.000",
    jogo: "Cruzeiro x Mirassol",
    competicao: "Brasileirão Série A",
    data: "9 de agosto de 2026",
    dataISO: "2026-08-09",
    placar: "3 x 1",
  },
  {
    src: "/prova/bilhete-chelsea-brighton.png",
    largura: 589,
    altura: 204,
    alt: "Bilhete ganho: Resultado Final Chelsea, odd 1.83, aposta de R$ 340 e pagamento de R$ 622,20",
    jogo: "Chelsea x Brighton",
    competicao: "Premier League",
    data: "30 de agosto de 2026",
    dataISO: "2026-08-30",
    placar: "4 x 3",
  },
  {
    src: "/prova/bilhete-argentina-egito.png",
    largura: 588,
    altura: 228,
    alt: "Bilhete ganho: Resultado Final Argentina, odd 3.94, aposta de R$ 100 e pagamento de R$ 394",
    jogo: "Argentina x Egito",
    competicao: "Copa 2026",
    data: "7 de julho de 2026",
    dataISO: "2026-07-07",
    placar: "3 x 2",
  },
];

/** Quanto tempo um bilhete pode ficar na página antes de virar prova velha. */
export const VALIDADE_EM_DIAS = 90;
