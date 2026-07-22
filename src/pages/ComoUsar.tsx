import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Send, Camera, AlertCircle, BookOpen, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AnalyticsNav from "@/components/AnalyticsNav";

const ComoUsar = () => {
  const navigate = useNavigate();

  const steps = [
    "Crie sua conta e faça login no app (signup).",
    "Abra o bot no Telegram e toque em “Enviar meu número” para sincronizar.",
    "Envie sua aposta em UMA mensagem: texto ou print (pode anexar texto junto ao print).",
    "Aguarde a confirmação e confira no dashboard.",
    "Se precisar, marque status ou edite no dashboard."
  ];

  const boasPraticas = [
    "1 mensagem = 1 aposta. Não quebre em várias mensagens.",
    "Inclua valor/stake e odd. Odds mínimas 1.01; múltiplas serão tratadas como combinado se vierem juntas.",
    "Para prints: garanta legibilidade e só um palpite por print. Se faltar valor, escreva na mesma mensagem.",
    "Para texto: siga o formato livre, mas inclua jogo, mercado, odd e valor (ex: “Lakers vs Warriors - LeBron 25+ pts - odd 1.85 - R$50”).",
  ];

  const problemas = [
    "Bot pediu contato: toque em “Enviar meu número” no teclado do Telegram.",
    "Conta não encontrada após enviar contato: garanta que o telefone cadastrado no app seja o mesmo do Telegram.",
    "Sem resposta após print: reenvie com texto na mesma mensagem (valor/odd).",
    "Ultrapassou limite diário: o bot responde com aviso; tente no próximo dia.",
    "Erro genérico: tente novamente e, se persistir, fale com o suporte."
  ];

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14 flex-1">
        {/* Hero */}
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-forest/10 text-forest px-4 py-2 rounded-full text-sm font-medium border border-forest/20">
            <BookOpen className="w-4 h-4" />
            Como usar o Betinho no Telegram
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black mt-4 mb-4 text-ink">Guia rápido e boas práticas</h1>
          <p className="text-lg sm:text-xl text-ink-2 max-w-3xl mx-auto">
            Siga o passo a passo para sincronizar, enviar apostas e obter o melhor resultado com o bot.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-forest hover:bg-forest-soft text-white px-6 py-4"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Começar grátis
            </Button>
          </div>
        </div>

        {/* Passo a passo */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="bg-white border border-line">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-forest">
                <Send className="w-5 h-5" />
                <p className="font-semibold">Passo a passo de configuração</p>
              </div>
              <ul className="space-y-2 text-sm text-ink-2">
                {steps.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-forest font-semibold">{idx + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-white border border-line">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-forest">
                <Camera className="w-5 h-5" />
                <p className="font-semibold">Como enviar</p>
              </div>
              <ul className="space-y-2 text-sm text-ink-2">
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-status-success mt-0.5 shrink-0" /> Print: 1 aposta por print; se faltar valor, escreva na mesma mensagem.</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-status-success mt-0.5 shrink-0" /> Texto: jogo + mercado + odd + valor em uma mensagem.</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-status-success mt-0.5 shrink-0" /> Áudio (opcional): o bot transcreve e junta com o texto.</li>
                <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-status-success mt-0.5 shrink-0" /> 1 mensagem = 1 aposta. Não enviar partes separadas.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Boas práticas */}
        <Card className="bg-white border border-line mb-8">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-forest">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">Boas práticas</p>
            </div>
            <ul className="space-y-2 text-sm text-ink-2">
              {boasPraticas.map((item, idx) => (
                <li key={idx} className="flex gap-2">
                  <CheckCircle className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Problemas comuns */}
        <Card className="bg-white border border-line mb-10">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-forest">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">Problemas comuns</p>
            </div>
            <ul className="space-y-2 text-sm text-ink-2">
              {problemas.map((item, idx) => (
                <li key={idx} className="flex gap-2">
                  <CheckCircle className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-forest hover:bg-forest-soft text-white px-6 py-4"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Começar grátis
            </Button>
          </div>
          <p className="text-xs text-ink-3 mt-3">Dica: se o bot pedir contato, toque em “Enviar meu número”.</p>
        </div>
      </div>
    </div>
  );
};

export default ComoUsar;
