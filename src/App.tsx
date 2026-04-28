import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AchievementProvider } from "@/components/bolao/AchievementProvider";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingEcossistema from "./pages/LandingEcossistema";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Picks from "./pages/Picks";
import NBADashboard from "./pages/NBADashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import PremiumRoute from "./components/PremiumRoute";
import { PostHogPageView } from "./components/PostHogPageView";
import { EnvironmentBanner } from "./components/EnvironmentBanner";
import Footer from "./components/Footer";

// Lazy-loaded pages (not critical for first paint)
const Betinho = React.lazy(() => import("./pages/Betinho"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const DashboardTest = React.lazy(() => import("./pages/DashboardTest"));
const Bets = React.lazy(() => import("./pages/Bets"));
const Bankroll = React.lazy(() => import("./pages/Bankroll"));
const BettingDashboard = React.lazy(() => import("./pages/BettingDashboard"));
const PlayerSelectionTest = React.lazy(() => import("./pages/PlayerSelectionTest"));
const PlayerSelection = React.lazy(() => import("./pages/PlayerSelection"));
const Analysis = React.lazy(() => import("./pages/Analysis"));
const Waitlist = React.lazy(() => import("./pages/Waitlist"));
const Paywall = React.lazy(() => import("./pages/Paywall"));
const PaywallDashboard = React.lazy(() => import("./pages/PaywallDashboard"));
const PaywallPlatform = React.lazy(() => import("./pages/PaywallPlatform"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const ComoUsar = React.lazy(() => import("./pages/ComoUsar"));
const Games = React.lazy(() => import("./pages/Games"));
const GameDetail = React.lazy(() => import("./pages/GameDetail"));
const Settings = React.lazy(() => import("./pages/Settings"));
const Report = React.lazy(() => import("./pages/Report"));
const SharePage = React.lazy(() => import("./pages/SharePage"));
const Analise360List = React.lazy(() => import("./pages/Analise360List"));
const Analise360Detail = React.lazy(() => import("./pages/Analise360Detail"));
const HomeNBA = React.lazy(() => import("./pages/HomeNBA"));
const BolaoEntry = React.lazy(() => import("./pages/BolaoEntry"));
const BolaoHome = React.lazy(() => import("./pages/BolaoHome"));
const BolaoDetail = React.lazy(() => import("./pages/BolaoDetail"));
const BolaoPalpites = React.lazy(() => import("./pages/BolaoPalpites"));
const BolaoJoin = React.lazy(() => import("./pages/BolaoJoin"));

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
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/" element={<LandingEcossistema />} />
            <Route path="/nba" element={<Landing />} />
            <Route path="/home-nba" element={<HomeNBA />} />
            <Route path="/home-players" element={<Home />} />
            <Route path="/oportunidades" element={
              <ProtectedRoute>
                <Picks />
              </ProtectedRoute>
            } />
            <Route path="/betinho" element={<Betinho />} />
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
                <PremiumRoute redirectTo="/paywall-dashboard">
                  <BettingDashboard />
                </PremiumRoute>
              </ProtectedRoute>
            } />
            <Route path="/analysis" element={
              <ProtectedRoute>
                <Analysis />
              </ProtectedRoute>
            } />
            <Route path="/home-games" element={<Games />} />
            <Route path="/game/:gameId" element={<GameDetail />} />
            <Route path="/nba-players" element={
              <ProtectedRoute>
                <PlayerSelection />
              </ProtectedRoute>
            } />
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
            {/* Bolão Copa do Mundo */}
            {/* /bolao = landing publica pra deslogado, dashboard pra logado */}
            <Route path="/bolao" element={<BolaoEntry />} />
            <Route path="/bolao/entrar/:code" element={
              <ProtectedRoute>
                <BolaoJoin />
              </ProtectedRoute>
            } />
            <Route path="/bolao/:id" element={
              <ProtectedRoute>
                <BolaoDetail />
              </ProtectedRoute>
            } />
            <Route path="/bolao/:id/palpites" element={
              <ProtectedRoute>
                <BolaoPalpites />
              </ProtectedRoute>
            } />
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
