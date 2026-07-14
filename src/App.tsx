import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AchievementProvider } from "@/components/bolao/AchievementProvider";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { BolaoLayout } from "@/components/bolao/BolaoLayout";
import LandingEcossistema from "./pages/LandingEcossistema";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Picks from "./pages/Picks";
import NBADashboard from "./pages/NBADashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import PremiumRoute from "./components/PremiumRoute";
import { PostHogPageView } from "./components/PostHogPageView";
import { CrossSellManager } from "./components/crosssell/CrossSellManager";
import { EnvironmentBanner } from "./components/EnvironmentBanner";
import Footer from "./components/Footer";
import { lazyWithRetry } from "./lib/lazy-with-retry";

// Lazy-loaded pages (not critical for first paint).
// Usa `lazyWithRetry` em vez de `React.lazy` direto pra detectar falha de
// chunk após deploy (hash dos chunks muda, navegador com versão antiga
// cacheada tenta carregar chunk inexistente -> "Failed to fetch dynamically
// imported module" -> tela branca). Helper força reload uma vez por sessão
// pra pegar build novo.
const Betinho = lazyWithRetry(() => import("./pages/Betinho"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const DashboardTest = lazyWithRetry(() => import("./pages/DashboardTest"));
const Bets = lazyWithRetry(() => import("./pages/Bets"));
const Bankroll = lazyWithRetry(() => import("./pages/Bankroll"));
const BettingDashboard = lazyWithRetry(() => import("./pages/BettingDashboard"));
const PlayerSelectionTest = lazyWithRetry(() => import("./pages/PlayerSelectionTest"));
const PlayerSelection = lazyWithRetry(() => import("./pages/PlayerSelection"));
const Analysis = lazyWithRetry(() => import("./pages/Analysis"));
const Waitlist = lazyWithRetry(() => import("./pages/Waitlist"));
const Paywall = lazyWithRetry(() => import("./pages/Paywall"));
const PaywallDashboard = lazyWithRetry(() => import("./pages/PaywallDashboard"));
const PaywallPlatform = lazyWithRetry(() => import("./pages/PaywallPlatform"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const ComoUsar = lazyWithRetry(() => import("./pages/ComoUsar"));
const Games = lazyWithRetry(() => import("./pages/Games"));
const GameDetail = lazyWithRetry(() => import("./pages/GameDetail"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Report = lazyWithRetry(() => import("./pages/Report"));
const SharePage = lazyWithRetry(() => import("./pages/SharePage"));
const Analise360List = lazyWithRetry(() => import("./pages/Analise360List"));
const Analise360Detail = lazyWithRetry(() => import("./pages/Analise360Detail"));
const HomeNBA = lazyWithRetry(() => import("./pages/HomeNBA"));
const FutebolHoje = lazyWithRetry(() => import("./pages/FutebolHoje"));
const FutebolOportunidades = lazyWithRetry(() => import("./pages/FutebolOportunidades"));
const FutebolJogos = lazyWithRetry(() => import("./pages/FutebolJogos"));
const FutebolJogo = lazyWithRetry(() => import("./pages/FutebolJogo"));
const FutebolTime = lazyWithRetry(() => import("./pages/FutebolTime"));
const FutebolAssinar = lazyWithRetry(() => import("./pages/FutebolAssinar"));
const FutebolLP = lazyWithRetry(() => import("./pages/FutebolLP"));
const BolaoEntry = lazyWithRetry(() => import("./pages/BolaoEntry"));
const BolaoHome = lazyWithRetry(() => import("./pages/BolaoHome"));
const BolaoDetail = lazyWithRetry(() => import("./pages/BolaoDetail"));
const BolaoPalpites = lazyWithRetry(() => import("./pages/BolaoPalpites"));
const BolaoJoin = lazyWithRetry(() => import("./pages/BolaoJoin"));
const BolaoWelcome = lazyWithRetry(() => import("./pages/BolaoWelcome"));
const BolaoLP = lazyWithRetry(() => import("./pages/BolaoLP"));
const Privacidade = lazyWithRetry(() => import("./pages/Privacidade"));

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="min-h-screen bg-terminal-black flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terminal-green"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AchievementProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <EnvironmentBanner />
        <PostHogPageView />
        <CrossSellManager />
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/" element={<LandingEcossistema />} />
            <Route path="/nba" element={<Landing />} />
            <Route path="/home-nba" element={<HomeNBA />} />
            <Route path="/oportunidades" element={
              <ProtectedRoute>
                <Picks />
              </ProtectedRoute>
            } />
            <Route path="/betinho" element={<Betinho />} />
            {/* Variante da LP do Betinho pra usuários vindos do bolão da Copa.
                Mesmo componente; useLocation detecta a rota e troca hero +
                "como funciona". CTAs em /bolao/.../palpites apontam pra cá. */}
            <Route path="/betinho/bolao" element={<Betinho />} />
            <Route path="/auth" element={
              <ProtectedRoute requireAuth={false}>
                <Auth />
              </ProtectedRoute>
            } />
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardTest />
              </ProtectedRoute>
            } />
            <Route path="/bets" element={
              <ProtectedRoute>
                <Bets />
              </ProtectedRoute>
            } />
            <Route path="/bankroll" element={
              <ProtectedRoute>
                <Bankroll />
              </ProtectedRoute>
            } />
            <Route path="/betting-dashboard" element={
              <ProtectedRoute>
                <BettingDashboard />
              </ProtectedRoute>
            } />
            <Route path="/analysis" element={
              <ProtectedRoute>
                <Analysis />
              </ProtectedRoute>
            } />
            <Route path="/home-games" element={<Games />} />
            <Route path="/game/:gameId" element={<GameDetail />} />
            {/* Futebol (value bet) — protótipo lendo BigQuery via FDW no dev.
                Rotas públicas por enquanto, igual /home-games. */}
            <Route path="/futebol" element={<FutebolHoje />} />
            <Route path="/futebol/comecar" element={<FutebolLP />} />
            <Route path="/futebol/oportunidades" element={<FutebolOportunidades />} />
            <Route path="/futebol/jogos" element={<FutebolJogos />} />
            <Route path="/futebol/jogo/:fixtureId" element={<FutebolJogo />} />
            <Route path="/futebol/time/:teamId" element={<FutebolTime />} />
            <Route path="/futebol/assinar" element={<FutebolAssinar />} />
            <Route path="/nba-dashboard/:playerName" element={<NBADashboard />} />
            <Route path="/waitlist" element={<Waitlist />} />
            <Route path="/paywall" element={<Paywall />} />
            <Route path="/paywall-dashboard" element={<PaywallDashboard />} />
            <Route path="/paywall-platform" element={<PaywallPlatform />} />
            <Route path="/como-usar" element={<ComoUsar />} />
            <Route path="/report" element={
              <ProtectedRoute>
                <Report />
              </ProtectedRoute>
            } />
            <Route path="/analise-360" element={
              <ProtectedRoute>
                <PremiumRoute redirectTo="/paywall-platform">
                  <Analise360List />
                </PremiumRoute>
              </ProtectedRoute>
            } />
            <Route path="/analise-360/:triggerPlayerId" element={
              <ProtectedRoute>
                <PremiumRoute redirectTo="/paywall-platform">
                  <Analise360Detail />
                </PremiumRoute>
              </ProtectedRoute>
            } />
            <Route path="/share/:token" element={<SharePage />} />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            {/* Bolão Copa do Mundo — todas as rotas wrappadas em BolaoLayout
                pra aplicar o tema "Direção A" (rebrand). Resto do app continua
                com tema "terminal" do legado. */}
            {/* /bolao = landing publica pra deslogado, dashboard pra logado */}
            <Route path="/bolao" element={<BolaoLayout><Outlet /></BolaoLayout>}>
              <Route index element={<BolaoEntry />} />
              {/* LP enxuta pra campanhas/anuncios — publica, sem auth */}
              <Route path="comecar" element={<BolaoLP />} />
              <Route path="entrar/:code" element={
                <ProtectedRoute>
                  <BolaoJoin />
                </ProtectedRoute>
              } />
              <Route path=":id" element={
                <ProtectedRoute>
                  <BolaoDetail />
                </ProtectedRoute>
              } />
              <Route path=":id/welcome" element={
                <ProtectedRoute>
                  <BolaoWelcome />
                </ProtectedRoute>
              } />
              <Route path=":id/palpites" element={
                <ProtectedRoute>
                  <BolaoPalpites />
                </ProtectedRoute>
              } />
            </Route>
            {/* Termos de Uso + Política de Privacidade — público, sem auth */}
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/termos" element={<Privacidade />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
        </Suspense>
      </BrowserRouter>
      </AchievementProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
