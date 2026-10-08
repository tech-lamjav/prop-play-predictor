import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Send, Camera, AlertCircle, BookOpen, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AnalyticsNav from "@/components/AnalyticsNav";
import { Seo } from "@/components/Seo";

/**
 * Guia público do Betinho no Telegram (rota /como-usar).
 *
 * A copy vem do catálogo `planos` no idioma ativo (#540), e não mais de texto
 * fixo aqui: é tela pública, e quem chega de Peru, Argentina, México ou Chile
 * precisa entender o passo a passo antes de sincronizar o bot.
 */
const ComoUsar = () => {
  const { t } = useTranslation('planos');
  const navigate = useNavigate();

  // As listas são construídas a partir das chaves, e não de texto fixo: o
  // idioma decide a frase, e a ordem fica aqui, onde ela é a mesma sempre.
  const steps = ['um', 'dois', 'tres', 'quatro', 'cinco'].map((n) =>
    t(`comoUsar.passos.${n}`),
  );

  const boasPraticas = ['um', 'dois', 'tres', 'quatro'].map((n) =>
    t(`comoUsar.boasPraticas.${n}`),
  );

  const problemas = ['um', 'dois', 'tres', 'quatro', 'cinco'].map((n) =>
    t(`comoUsar.problemas.${n}`),
  );

  const comoEnviar = ['print', 'texto', 'audio', 'umaAposta'].map((chave) =>
    t(`comoUsar.envio.${chave}`),
  );

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink flex flex-col">
      <Seo route="/como-usar" />
      <AnalyticsNav variant="rebrand" showBack />
      <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14 flex-1">

        {/* Hero */}
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-forest/10 text-forest px-4 py-2 rounded-full text-sm font-medium border border-forest/20">
            <BookOpen className="w-4 h-4" />
            {t('comoUsar.etiqueta')}
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black mt-4 mb-4 text-ink">{t('comoUsar.titulo')}</h1>
          <p className="text-lg sm:text-xl text-ink-2 max-w-3xl mx-auto">
            {t('comoUsar.chamada')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-forest hover:bg-forest-soft text-white px-6 py-4"
            >
              <Rocket className="w-4 h-4 mr-2" />
              {t('comoUsar.acao')}
            </Button>
          </div>
        </div>

        {/* Passo a passo */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="bg-white border border-line">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-forest">
                <Send className="w-5 h-5" />
                <p className="font-semibold">{t('comoUsar.passos.titulo')}</p>
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
                <p className="font-semibold">{t('comoUsar.envio.titulo')}</p>
              </div>
              <ul className="space-y-2 text-sm text-ink-2">
                {comoEnviar.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Boas práticas */}
        <Card className="bg-white border border-line mb-8">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-forest">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">{t('comoUsar.boasPraticas.titulo')}</p>
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
              <p className="font-semibold">{t('comoUsar.problemas.titulo')}</p>
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
              {t('comoUsar.acao')}
            </Button>
          </div>
          <p className="text-xs text-ink-3 mt-3">{t('comoUsar.dica')}</p>
        </div>
      </div>
    </div>
  );
};

export default ComoUsar;
