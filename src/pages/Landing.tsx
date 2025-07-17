import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, BarChart3, Target, Users, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">PropEdge</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/auth">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
              Master Player Props<br />with Data-Driven Insights
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Analyze player statistics, compare betting lines, and make informed decisions with our comprehensive sports analytics platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Analyzing
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Win
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our platform provides comprehensive tools for analyzing player performance and betting opportunities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Advanced Analytics</h3>
                <p className="text-muted-foreground">
                  Deep dive into player statistics with trend analysis, performance patterns, and predictive insights.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Line Comparison</h3>
                <p className="text-muted-foreground">
                  Compare betting lines across multiple sportsbooks to find the best value for your prop bets.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Expert Community</h3>
                <p className="text-muted-foreground">
                  Connect with other analysts and share insights in our community of sports betting professionals.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">10K+</div>
              <div className="text-muted-foreground">Active Users</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">500+</div>
              <div className="text-muted-foreground">Players Tracked</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">95%</div>
              <div className="text-muted-foreground">Accuracy Rate</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">24/7</div>
              <div className="text-muted-foreground">Live Updates</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-muted-foreground">
              Start free and upgrade as you grow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">Free</h3>
                  <div className="text-3xl font-bold mb-1">$0</div>
                  <div className="text-muted-foreground">per month</div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Basic player stats</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">5 players in watchlist</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Limited analysis</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button variant="outline" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-primary bg-card/50 backdrop-blur-sm relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">Pro</h3>
                  <div className="text-3xl font-bold mb-1">$29</div>
                  <div className="text-muted-foreground">per month</div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Advanced analytics</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Unlimited watchlist</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Line comparison</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Trend analysis</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button className="w-full">
                    Start Pro Trial
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Elite Plan */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold mb-2">Elite</h3>
                  <div className="text-3xl font-bold mb-1">$99</div>
                  <div className="text-muted-foreground">per month</div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Everything in Pro</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">AI predictions</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Priority support</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Custom reports</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button variant="outline" className="w-full">
                    Contact Sales
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Start Winning?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of successful sports bettors who trust PropEdge for their player prop analysis.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Get Started Today
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">PropEdge</span>
              </div>
              <p className="text-muted-foreground">
                The most advanced platform for player prop betting analysis.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="#" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link to="#" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link to="#" className="hover:text-foreground transition-colors">API</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="#" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link to="#" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link to="#" className="hover:text-foreground transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="#" className="hover:text-foreground transition-colors">Help Center</Link></li>
                <li><Link to="#" className="hover:text-foreground transition-colors">Contact</Link></li>
                <li><Link to="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 PropEdge. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;