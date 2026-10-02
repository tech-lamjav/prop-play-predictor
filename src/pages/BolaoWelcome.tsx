import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Copy,
  Share2,
  Settings,
  Target,
  Clock,
  Sparkles,
  Image as ImageIcon,
  ChevronRight,
  Check,
} from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Button } from '@/components/ui/button';
import { useBolao } from '@/hooks/use-bolao';
import { shareTextOrLink, SHARE_MESSAGES } from '@/components/bolao/share-utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Tela de boas-vindas pós-criação do bolão.
 *
 * Jornada do criador: o BolaoAdminPanel (acessado via ?settings=true) é uma
 * tela administrativa rica em opções, mas péssima como primeiro contato — ela
 * "abre opções" sem dizer o que o user deveria fazer agora. Esta tela existe
 * pra cobrir esse gap:
 *
 * 1. Hero curto que celebra a criação e direciona pro próximo passo
 * 2. CTA destaque pra convidar amigos (código + link + Copiar + WhatsApp)
 * 3. Grid "Personalize (opcional)" com defaults reassurance — pode pular
 * 4. Footer com "Ir pro bolão" e ponteiro pra configs avançadas
 *
 * Quem cai aqui: BolaoHome.handleCreate redireciona pra cá após sucesso.
 * Quem NÃO cai aqui: usuários que entram via convite (vão pra /bolao/:id direto).
 */
const BolaoWelcome: React.FC = () => {
  const { t } = useTranslation('bolao');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: bolao, isLoading } = useBolao(id);
  const [copied, setCopied] = React.useState(false);

  if (isLoading || !bolao) {
    return (
      <>
        <AnalyticsNav variant="rebrand" />
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-12">
          <div className="h-64 rounded-rebrand-xl bg-canvas-2 animate-pulse" />
        </div>
      </>
    );
  }

  const inviteUrl = `${window.location.origin}/bolao/entrar/${bolao.invite_code}`;
  const settingsUrl = `/bolao/${bolao.id}?settings=true`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({ title: t('boasVindas.copiado.titulo'), description: t('boasVindas.copiado.descricao') });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: t('boasVindas.erroCopiar.titulo'),
        description: t('boasVindas.erroCopiar.descricao'),
        variant: 'destructive',
      });
    }
  };

  // Web Share API: abre o sheet nativo (WhatsApp/Telegram/Instagram/Copiar).
  // Em desktop sem Web Share API, cai no fallback wa.me automaticamente.
  const handleShare = () => {
    void shareTextOrLink({
      title: t('boasVindas.compartilhar.titulo', { nome: bolao.name }),
      // ⚠️ O CORPO da mensagem continua em português: `SHARE_MESSAGES` é um
      // módulo puro (`share-utils.ts`), compartilhado por quatro componentes
      // que ainda não foram migrados, e ligá-lo à tradução é decisão de quem
      // coordena o bloco — não dá para fazer só aqui sem duplicar o texto.
      text: SHARE_MESSAGES.invite(bolao.name, bolao.invite_code, inviteUrl),
    });
  };

  // Cards de personalização — todos apontam pro admin panel completo. Aba
  // específica pode ser refinada depois via query string (?settings=true&tab=X).
  //
  // ⚠️ `id` existe para ser a chave do React, e não o rótulo. Com
  // `key={title}` o rótulo traduzido remontava os quatro cards inteiros a cada
  // troca de idioma — perde foco, perde animação, e por nada: o conjunto é o
  // mesmo. A chave do React tem de ser estável ENTRE idiomas.
  const personalizeCards = [
    { id: 'pontuacao', icon: Target },
    { id: 'prazo', icon: Clock },
    { id: 'modalidades', icon: Sparkles },
    { id: 'identidade', icon: ImageIcon },
  ];

  return (
    <>
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {/* ═══ HERO ═══ */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-rebrand-md bg-forest/10 text-forest mb-4">
            <Trophy className="w-7 h-7" />
          </div>
          <h1 className="font-display text-[32px] sm:text-[40px] font-extrabold leading-[1.1] text-ink mb-2">
            <Trans
              t={t}
              i18nKey="boasVindas.hero.titulo"
              values={{ nome: bolao.name }}
              components={[<span className="text-forest" key="nome" />]}
            />
          </h1>
          <p className="text-[15px] text-ink-2 max-w-[520px] mx-auto leading-relaxed">
            {t('boasVindas.hero.texto')}
          </p>
        </div>

        {/* ═══ CONVITE — destaque ═══ */}
        <div className="bg-white border border-line rounded-rebrand-xl p-6 sm:p-7 mb-10 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-2 mb-4">
            {t('boasVindas.convite.etiqueta')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-8 sm:items-end mb-5">
            <div>
              <div className="text-[12px] text-ink-2 mb-1">{t('boasVindas.convite.codigo')}</div>
              <div className="font-mono text-[34px] sm:text-[40px] font-bold tabular-nums text-forest leading-none tracking-wide">
                #{bolao.invite_code}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[12px] text-ink-2 mb-1">{t('boasVindas.convite.link')}</div>
              <code className="text-[12px] text-ink font-mono break-all bg-canvas-2 px-2 py-1.5 rounded-rebrand-sm block">
                {inviteUrl}
              </code>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline-forest"
              size="lg"
              onClick={handleCopyLink}
              className="rounded-rebrand-md gap-2 flex-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" /> {t('boasVindas.convite.copiado')}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> {t('boasVindas.convite.copiar')}
                </>
              )}
            </Button>
            <Button
              variant="forest"
              size="lg"
              onClick={handleShare}
              className="rounded-rebrand-md gap-2 flex-1"
            >
              <Share2 className="w-4 h-4" />
              {t('boasVindas.convite.compartilhar')}
            </Button>
          </div>
        </div>

        {/* ═══ PERSONALIZAR (opcional) ═══ */}
        <div className="mb-10">
          <h2 className="font-display text-[20px] font-bold text-ink mb-1">
            {t('boasVindas.personalize.titulo')}
          </h2>
          <p className="text-[13px] text-ink-2 mb-4">
            {t('boasVindas.personalize.texto')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {personalizeCards.map(({ id: cardId, icon: Icon }) => (
              <button
                key={cardId}
                onClick={() => navigate(settingsUrl)}
                className="bg-white border border-line rounded-rebrand-md p-4 text-left hover:border-forest/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-rebrand-sm bg-canvas-2 grid place-items-center text-forest shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-display text-[15px] font-bold text-ink">
                        {t(`boasVindas.personalize.${cardId}.titulo`)}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-ink-3 group-hover:text-forest transition-colors shrink-0" />
                    </div>
                    <p className="text-[12px] text-ink-2 leading-relaxed">
                      {t(`boasVindas.personalize.${cardId}.texto`)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ FOOTER — ir pro bolão + ponteiro pras configs avançadas ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-line">
          <div className="text-[12px] text-ink-2 flex items-center gap-1.5 flex-wrap">
            <Settings className="w-3.5 h-3.5" />
            {t('boasVindas.rodape.configs')}
          </div>
          <Button
            variant="forest"
            size="lg"
            onClick={() => navigate(`/bolao/${bolao.id}`)}
            className="rounded-rebrand-md gap-1.5 self-end sm:self-auto"
          >
            {t('boasVindas.rodape.irProBolao')} <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
};

export default BolaoWelcome;
