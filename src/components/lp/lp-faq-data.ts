import { faqPageSchema, type FaqItem } from "@/lib/structured-data";

// ============================================================
// "Ainda está em dúvida?" As três perguntas são as do documento de copy, nada
// acrescentado. A terceira estava truncada no documento
// ("Sou 1 apostar mais um grupo de palpites?") e foi reescrita.
//
// Ficam guardadas, fora do ar, três perguntas que eu tinha proposto e que não
// estão no roteiro: quais campeonatos entram, se funciona no celular e se pode
// cancelar. Se em algum momento a objeção aparecer no tráfego, é só trazer.
// ============================================================

export const LP_FAQ: FaqItem[] = [
  {
    q: "Preciso entender muito de futebol?",
    a: "Não. A plataforma organiza as informações para facilitar sua interpretação.",
  },
  {
    q: "A Smart Betting garante que a aposta vai dar certo?",
    a: "Não. O objetivo é melhorar a qualidade da sua análise, não eliminar o risco do futebol.",
  },
  {
    q: "Isso é um grupo de palpites?",
    a: "Não. Você visualiza os dados, os filtros e os motivos que sustentam cada oportunidade.",
  },
];

export const lpFaqSchema = () => faqPageSchema(LP_FAQ);
