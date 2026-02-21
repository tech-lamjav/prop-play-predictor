import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePostHog } from "@posthog/react";
import { createClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { LanguageToggle } from "@/components/LanguageToggle";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const posthog = usePostHog();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  
  const supabase = createClient();

  // Detect referral code from URL parameter
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCode(refParam.toUpperCase());
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Get user data for PostHog identify
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && posthog) {
          // Identify user in PostHog
          posthog.identify(user.id, {
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0],
          });
          
          // Track sign-in event
          posthog.capture('signed_in', {
            email: user.email,
            method: 'email',
          });
        }
        
        toast({
          title: "Success",
          description: "Welcome back!",
        });
        const from = (location.state as { from?: { pathname?: string; search?: string } })?.from;
        if (from?.pathname && from.pathname.startsWith("/") && !from.pathname.startsWith("//")) {
          navigate(from.pathname + (from.search || ""));
        } else {
          navigate("/onboarding");
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Get the newly created user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const normalizedReferralCode = referralCode.trim() ? referralCode.toUpperCase().trim() : null;
          const userData: any = {
            id: user.id,
            email: user.email!,
            name: name,
            referred_by: normalizedReferralCode
          };

          // Create user record in our users table
          const { error: userError } = await supabase
            .from('users')
            .insert(userData);
          
          if (userError) {
            console.error('Error creating user record:', userError);
            toast({
              title: "Error",
              description: "Failed to create user record",
              variant: "destructive",
            });
          } else if (normalizedReferralCode && userData.referred_by) {
            // Create referral record - find referrer by code
            try {
              // Find referrer by code
              const { data: referrerData, error: referrerError } = await supabase
                .from('users')
                .select('id')
                .eq('referral_code', normalizedReferralCode)
                .single();

              if (!referrerError && referrerData && referrerData.id !== user.id) {
                // Insert into referrals table
                await supabase
                  .from('referrals')
                  .insert({
                    referrer_id: referrerData.id,
                    referred_id: user.id,
                    referral_code: normalizedReferralCode
                  });
              }
            } catch (err) {
              // Silent fail - referral code is already saved in referred_by
              console.error('Error creating referral record:', err);
            }
          }
          
          // Identify user in PostHog and track sign-up event
          if (posthog) {
            const referralProperties = normalizedReferralCode ? { referred_by_code: normalizedReferralCode } : {};
            posthog.identify(user.id, {
              email: user.email,
              name: name || user.email?.split('@')[0],
              ...referralProperties,
            });
            
            posthog.capture('signed_up', {
              email: user.email,
              name: name,
              method: 'email',
              ...referralProperties,
            });
          }
          
          // Track CompleteRegistration event in Meta Pixel
          if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'CompleteRegistration');
          }
        }
        
        toast({
          title: "Success",
          description: "Account created! Please check your email to verify your account.",
        });
        
        // Redirect to onboarding after successful signup
        navigate("/onboarding");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Smartbetting</span>
          </div>
          <LanguageToggle />
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("auth.signin")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <Card>
              <CardHeader>
                <CardTitle>{t("auth.signin")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("auth.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t("loading") : t("auth.signin")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>{t("auth.signup")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome Completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t("auth.email")}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t("auth.password")}</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{t("auth.confirm_password")}</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referral-code">Código do amigo (opcional)</Label>
                    <Input
                      id="referral-code"
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      maxLength={6}
                      className="font-mono text-center text-lg tracking-wider"
                    />
                    {referralCode && (
                      <p className="text-xs text-muted-foreground">
                        Você está se cadastrando com o código de indicação
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t("loading") : t("auth.signup")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;