import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Copy,
  MessageCircle,
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
import { SHARE_MESSAGES } from '@/components/bolao/share-utils';
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
  const message = SHARE_MESSAGES.invite(bolao.name, bolao.invite_code, inviteUrl);
  const settingsUrl = `/bolao/${bolao.id}?settings=true`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({ title: 'Link copiado!', description: 'Cola no grupo onde quiser.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: 'Não consegui copiar',
        description: 'Selecione o link manualmente.',
        variant: 'destructive',
      });
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener');
  };

  // Cards de personalização — todos apontam pro admin panel completo. Aba
  // específica pode ser refinada depois via query string (?settings=true&tab=X).
  const personalizeCards = [
    {
      icon: Target,
      title: 'Pontuação',
      desc: 'Quanto vale acertar placar, vencedor, etc. Padrão: 3-2-1.',
    },
    {
      icon: Clock,
      title: 'Prazo de palpites',
      desc: 'Até quando palpitar antes de cada jogo. Padrão: até o jogo começar.',
    },
    {
      icon: Sparkles,
      title: 'Modalidades',
      desc: 'Habilitar palpites especiais: campeão, semifinalistas, mata-mata.',
    },
    {
      icon: ImageIcon,
      title: 'Logo e identidade',
      desc: 'Adicionar logo do bolão e escolher tema visual.',
    },
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
            Boa! <span className="text-forest">"{bolao.name}"</span> tá no ar.
          </h1>
          <p className="text-[15px] text-ink-2 max-w-[520px] mx-auto leading-relaxed">
            Agora bora chamar a galera pra palpitar — sem amigos no bolão, ele não rola.
          </p>
        </div>

        {/* ═══ CONVITE — destaque ═══ */}
        <div className="bg-white border border-line rounded-rebrand-xl p-6 sm:p-7 mb-10 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-2 mb-4">
            Convidar amigos
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:gap-8 sm:items-end mb-5">
            <div>
              <div className="text-[12px] text-ink-2 mb-1">Código do bolão</div>
              <div className="font-mono text-[34px] sm:text-[40px] font-bold tabular-nums text-forest leading-none tracking-wide">
                #{bolao.invite_code}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[12px] text-ink-2 mb-1">Ou link direto</div>
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
                  <Check className="w-4 h-4" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar link
                </>
              )}
            </Button>
            <Button
              variant="forest"
              size="lg"
              onClick={handleWhatsApp}
              className="rounded-rebrand-md gap-2 flex-1"
            >
              <MessageCircle className="w-4 h-4" />
              Mandar no WhatsApp
            </Button>
          </div>
        </div>

        {/* ═══ PERSONALIZAR (opcional) ═══ */}
        <div className="mb-10">
          <h2 className="font-display text-[20px] font-bold text-ink mb-1">
            Personalize (opcional)
          </h2>
          <p className="text-[13px] text-ink-2 mb-4">
            Defaults são bons. Mexa só no que quiser — dá pra mudar tudo depois, antes do 1º jogo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {personalizeCards.map(({ icon: Icon, title, desc }) => (
              <button
                key={title}
                onClick={() => navigate(settingsUrl)}
                className="bg-white border border-line rounded-rebrand-md p-4 text-left hover:border-forest/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-rebrand-sm bg-canvas-2 grid place-items-center text-forest shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-display text-[15px] font-bold text-ink">{title}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-ink-3 group-hover:text-forest transition-colors shrink-0" />
                    </div>
                    <p className="text-[12px] text-ink-2 leading-relaxed">{desc}</p>
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
            Configs avançadas (inscrições, excluir) ficam no ícone dentro do bolão.
          </div>
          <Button
            variant="forest"
            size="lg"
            onClick={() => navigate(`/bolao/${bolao.id}`)}
            className="rounded-rebrand-md gap-1.5 self-end sm:self-auto"
          >
            Ir pro bolão <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
};

export default BolaoWelcome;
