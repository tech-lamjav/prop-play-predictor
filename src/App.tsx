import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Betinho from "./pages/Betinho";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import DashboardTest from "./pages/DashboardTest";
import Bets from "./pages/Bets";
import Bankroll from './pages/Bankroll';
import BettingDashboard from './pages/BettingDashboard';
import PlayerSelectionTest from "./pages/PlayerSelectionTest";
import PlayerSelection from "./pages/PlayerSelection";
import NBADashboard from "./pages/NBADashboard";
import Analysis from "./pages/Analysis";
import Waitlist from "./pages/Waitlist";
import Paywall from "./pages/Paywall";
import PaywallPlatform from "./pages/PaywallPlatform";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import PremiumRoute from "./components/PremiumRoute";
import { PostHogPageView } from "./components/PostHogPageView";
import ComoUsar from "./pages/ComoUsar";
import Games from "./pages/Games";
import Home from "./pages/Home";
import GameDetail from "./pages/GameDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PostHogPageView />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Home />} />
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
              <PremiumRoute>
                <BettingDashboard />
              </PremiumRoute>
            </ProtectedRoute>
          } />
          <Route path="/analysis" element={
            <ProtectedRoute>
              <Analysis />
            </ProtectedRoute>
          } />
          <Route path="/games" element={<Games />} />
          <Route path="/game/:gameId" element={<GameDetail />} />
          <Route path="/nba-players" element={
            <ProtectedRoute>
              <PlayerSelection />
            </ProtectedRoute>
          } />
          <Route path="/nba-dashboard/:playerName" element={<NBADashboard />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/paywall" element={<Paywall />} />
          <Route path="/paywall-platform" element={<PaywallPlatform />} />
          <Route path="/como-usar" element={<ComoUsar />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
