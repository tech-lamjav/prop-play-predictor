import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Bell, Star, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";

const Landing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto">
        {/* Navigation */}
        <nav className="flex items-center justify-between p-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">PropAnalyzer</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              {t("auth.signin")}
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="text-center py-20 px-6">
          <Badge variant="secondary" className="mb-6">
            Now Live in Beta
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 max-w-4xl mx-auto">
            {t("hero.title")}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
              {t("hero.cta")}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg">
              Watch Demo
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("features.title")}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our platform provides comprehensive tools for analyzing player performance and betting opportunities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-foreground">{t("features.realtime")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t("features.realtime.desc")}</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-foreground">{t("features.analytics")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t("features.analytics.desc")}</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-foreground">{t("features.alerts")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t("features.alerts.desc")}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("pricing.title")}
            </h2>
            <p className="text-xl text-muted-foreground">
              Start free and upgrade as you grow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-center">
                  <div className="text-2xl font-bold text-foreground">{t("pricing.free")}</div>
                  <div className="text-3xl font-bold text-foreground mt-2">$0</div>
                  <div className="text-muted-foreground">per month</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-muted-foreground">
                  <li>✓ Basic player stats</li>
                  <li>✓ 5 players in watchlist</li>
                  <li>✓ Limited analysis</li>
                </ul>
                <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                  Get Started
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-primary relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge variant="default">Most Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-center">
                  <div className="text-2xl font-bold text-foreground">{t("pricing.pro")}</div>
                  <div className="text-3xl font-bold text-foreground mt-2">$29</div>
                  <div className="text-muted-foreground">per month</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-muted-foreground">
                  <li>✓ Advanced analytics</li>
                  <li>✓ Unlimited watchlist</li>
                  <li>✓ Line comparison</li>
                  <li>✓ Trend analysis</li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Start Pro Trial
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-center">
                  <div className="text-2xl font-bold text-foreground">{t("pricing.enterprise")}</div>
                  <div className="text-3xl font-bold text-foreground mt-2">$99</div>
                  <div className="text-muted-foreground">per month</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-muted-foreground">
                  <li>✓ Everything in Pro</li>
                  <li>✓ AI predictions</li>
                  <li>✓ Priority support</li>
                  <li>✓ Custom reports</li>
                </ul>
                <Button variant="outline" className="w-full">
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Ready to Start Winning?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of successful sports bettors who trust our platform for their player prop analysis.
            </p>
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
              Get Started Today
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Landing;