import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      "dashboard": "Dashboard",
      "analysis": "Analysis",
      "watchlist": "Watchlist",
      "profile": "Profile",
      "logout": "Logout",
      
      // Landing Page
      "hero.title": "Advanced Player Props Analysis",
      "hero.subtitle": "Get the edge you need with our comprehensive sports betting analytics platform",
      "hero.cta": "Start Analyzing",
      "features.title": "Why Choose Our Platform",
      "features.realtime": "Real-time Data",
      "features.realtime.desc": "Get instant updates on player stats and betting lines",
      "features.analytics": "Advanced Analytics",
      "features.analytics.desc": "Deep insights and trend analysis for better decisions",
      "features.alerts": "Smart Alerts",
      "features.alerts.desc": "Never miss profitable opportunities with our alert system",
      "pricing.title": "Choose Your Plan",
      "pricing.free": "Free",
      "pricing.pro": "Pro",
      "pricing.enterprise": "Enterprise",
      
      // Dashboard
      "dashboard.title": "Player Dashboard",
      "dashboard.search": "Search players...",
      "dashboard.filters": "Filters",
      "dashboard.sport": "Sport",
      "dashboard.position": "Position",
      "dashboard.points": "Points",
      "dashboard.rebounds": "Rebounds",
      "dashboard.assists": "Assists",
      "dashboard.add_to_watchlist": "Add to Watchlist",
      "dashboard.view_analysis": "View Analysis",
      
      // Analysis
      "analysis.title": "Player Analysis",
      "analysis.overview": "Overview",
      "analysis.trends": "Trends",
      "analysis.betting_lines": "Betting Lines",
      "analysis.recent_games": "Recent Games",
      "analysis.season_stats": "Season Stats",
      "analysis.vs_line": "vs Line",
      "analysis.over": "Over",
      "analysis.under": "Under",
      "analysis.hit_rate": "Hit Rate",
      "analysis.avg_performance": "Avg Performance",
      "analysis.last_games": "Last {{count}} Games",
      "analysis.opponent": "vs {{team}}",
      "analysis.home": "Home",
      "analysis.away": "Away",
      
      // Auth
      "auth.signin": "Sign In",
      "auth.signup": "Sign Up",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.confirm_password": "Confirm Password",
      "auth.forgot_password": "Forgot Password?",
      "auth.no_account": "Don't have an account?",
      "auth.have_account": "Already have an account?",
      
      // Common
      "loading": "Loading...",
      "error": "Error",
      "success": "Success",
      "cancel": "Cancel",
      "save": "Save",
      "delete": "Delete",
      "edit": "Edit",
      "add": "Add",
      "remove": "Remove"
    }
  },
  pt: {
    translation: {
      // Navigation
      "dashboard": "Painel",
      "analysis": "Análise",
      "watchlist": "Lista de Observação",
      "profile": "Perfil",
      "logout": "Sair",
      
      // Landing Page
      "hero.title": "Análise Avançada de Player Props",
      "hero.subtitle": "Obtenha a vantagem que você precisa com nossa plataforma abrangente de análise de apostas esportivas",
      "hero.cta": "Começar Análise",
      "features.title": "Por Que Escolher Nossa Plataforma",
      "features.realtime": "Dados em Tempo Real",
      "features.realtime.desc": "Receba atualizações instantâneas sobre estatísticas dos jogadores e linhas de apostas",
      "features.analytics": "Análises Avançadas",
      "features.analytics.desc": "Insights profundos e análise de tendências para melhores decisões",
      "features.alerts": "Alertas Inteligentes",
      "features.alerts.desc": "Nunca perca oportunidades lucrativas com nosso sistema de alertas",
      "pricing.title": "Escolha Seu Plano",
      "pricing.free": "Grátis",
      "pricing.pro": "Pro",
      "pricing.enterprise": "Empresarial",
      
      // Dashboard
      "dashboard.title": "Painel de Jogadores",
      "dashboard.search": "Buscar jogadores...",
      "dashboard.filters": "Filtros",
      "dashboard.sport": "Esporte",
      "dashboard.position": "Posição",
      "dashboard.points": "Pontos",
      "dashboard.rebounds": "Rebotes",
      "dashboard.assists": "Assistências",
      "dashboard.add_to_watchlist": "Adicionar à Lista",
      "dashboard.view_analysis": "Ver Análise",
      
      // Analysis
      "analysis.title": "Análise do Jogador",
      "analysis.overview": "Visão Geral",
      "analysis.trends": "Tendências",
      "analysis.betting_lines": "Linhas de Apostas",
      "analysis.recent_games": "Jogos Recentes",
      "analysis.season_stats": "Estatísticas da Temporada",
      "analysis.vs_line": "vs Linha",
      "analysis.over": "Acima",
      "analysis.under": "Abaixo",
      "analysis.hit_rate": "Taxa de Acerto",
      "analysis.avg_performance": "Performance Média",
      "analysis.last_games": "Últimos {{count}} Jogos",
      "analysis.opponent": "vs {{team}}",
      "analysis.home": "Casa",
      "analysis.away": "Visitante",
      
      // Auth
      "auth.signin": "Entrar",
      "auth.signup": "Cadastrar",
      "auth.email": "E-mail",
      "auth.password": "Senha",
      "auth.confirm_password": "Confirmar Senha",
      "auth.forgot_password": "Esqueceu a senha?",
      "auth.no_account": "Não tem uma conta?",
      "auth.have_account": "Já tem uma conta?",
      
      // Common
      "loading": "Carregando...",
      "error": "Erro",
      "success": "Sucesso",
      "cancel": "Cancelar",
      "save": "Salvar",
      "delete": "Excluir",
      "edit": "Editar",
      "add": "Adicionar",
      "remove": "Remover"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;