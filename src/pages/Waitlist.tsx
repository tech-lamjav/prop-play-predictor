import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { LanguageToggle } from "@/components/LanguageToggle";

const Waitlist = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('waitlist')
        .insert([
          {
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
            created_at: new Date().toISOString(),
          }
        ]);

      if (error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setSubmitted(true);
        toast({
          title: "Sucesso!",
          description: "Você foi adicionado à lista de espera. Em breve entraremos em contato!",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">Smart Betting</span>
            </div>
            <LanguageToggle />
          </div>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-700">
                Bem-vindo à lista de espera!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Obrigado por se inscrever! Você receberá um email em breve com mais informações sobre o lançamento.
              </p>
              
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-foreground">O que acontece agora?</h3>
                <ul className="text-sm text-muted-foreground space-y-1 text-left">
                  <li>✅ Você está na lista de espera</li>
                  <li>📧 Receberá atualizações por email</li>
                  <li>🚀 Acesso prioritário quando lançarmos</li>
                  <li>💰 Desconto especial para early adopters</li>
                </ul>
              </div>

              <Button 
                onClick={() => navigate("/")} 
                variant="outline" 
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao início
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Smart Betting</span>
          </div>
          <LanguageToggle />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Entre na lista de espera
            </CardTitle>
            <p className="text-muted-foreground text-center">
              Seja um dos primeiros a ter acesso ao Smart Betting e receba um desconto especial no lançamento.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp (opcional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-foreground text-sm">🎁 Benefícios da lista de espera:</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>✅ Acesso prioritário quando lançarmos</li>
                  <li>💰 30% de desconto nos primeiros 3 meses</li>
                  <li>📊 Relatório exclusivo sobre prop bets da NBA</li>
                  <li>🎯 Webinar gratuito sobre estratégias de apostas</li>
                </ul>
              </div>

              <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={loading}>
                {loading ? "Enviando..." : "Entrar na lista de espera"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/")}
                className="text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Waitlist;
