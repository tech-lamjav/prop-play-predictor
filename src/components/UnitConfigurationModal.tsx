import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserUnit } from '@/hooks/use-user-unit';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface UnitConfigurationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnitConfigurationModal({
  open,
  onOpenChange,
}: UnitConfigurationModalProps) {
  const { config, isLoading, error, updateConfig, clearConfig, isConfigured } = useUserUnit();
  const [activeTab, setActiveTab] = useState<'direct' | 'division'>('direct');
  const [formData, setFormData] = useState({
    directValue: '',
    bankAmount: '',
    divisor: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form with existing config when modal opens
  useEffect(() => {
    if (open && config) {
      if (config.unit_calculation_method === 'direct' && config.unit_value) {
        setActiveTab('direct');
        setFormData({
          directValue: config.unit_value.toString(),
          bankAmount: '',
          divisor: '',
        });
      } else if (config.unit_calculation_method === 'division' && config.bank_amount) {
        setActiveTab('division');
        const divisor = config.bank_amount / (config.unit_value || 1);
        setFormData({
          directValue: '',
          bankAmount: config.bank_amount.toString(),
          divisor: divisor.toString(),
        });
      } else {
        // Reset form for new configuration
        setFormData({
          directValue: '',
          bankAmount: '',
          divisor: '',
        });
      }
      setLocalError(null);
      setSaveSuccess(false);
    }
  }, [open, config]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setLocalError(null);
    setSaveSuccess(false);
  };

  const validateForm = (): boolean => {
    if (activeTab === 'direct') {
      const value = parseFloat(formData.directValue);
      if (!formData.directValue || isNaN(value) || value <= 0) {
        setLocalError('O valor da unidade deve ser maior que zero');
        return false;
      }
    } else {
      const bank = parseFloat(formData.bankAmount);
      const div = parseFloat(formData.divisor);
      if (!formData.bankAmount || isNaN(bank) || bank <= 0) {
        setLocalError('O valor da banca deve ser maior que zero');
        return false;
      }
      if (!formData.divisor || isNaN(div) || div <= 0) {
        setLocalError('O divisor deve ser maior que zero');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setLocalError(null);
    setSaveSuccess(false);

    try {
      let success = false;
      if (activeTab === 'direct') {
        success = await updateConfig({
          method: 'direct',
          unitValue: parseFloat(formData.directValue),
        });
      } else {
        success = await updateConfig({
          method: 'division',
          bankAmount: parseFloat(formData.bankAmount),
          divisor: parseFloat(formData.divisor),
        });
      }

      if (success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        setLocalError('Erro ao salvar configuração. Tente novamente.');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    setLocalError(null);
    setSaveSuccess(false);

    try {
      const success = await clearConfig();
      if (success) {
        setSaveSuccess(true);
        setFormData({
          directValue: '',
          bankAmount: '',
          divisor: '',
        });
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      } else {
        setLocalError('Erro ao limpar configuração. Tente novamente.');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro ao limpar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateUnitValue = (): number | null => {
    if (activeTab === 'direct') {
      const value = parseFloat(formData.directValue);
      return isNaN(value) || value <= 0 ? null : value;
    } else {
      const bank = parseFloat(formData.bankAmount);
      const div = parseFloat(formData.divisor);
      if (isNaN(bank) || bank <= 0 || isNaN(div) || div <= 0) {
        return null;
      }
      return bank / div;
    }
  };

  const calculatedUnitValue = calculateUnitValue();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configurar Sistema de Unidades</DialogTitle>
          <DialogDescription>
            Configure o valor de uma unidade para visualizar suas métricas em unidades além dos valores monetários.
          </DialogDescription>
        </DialogHeader>

        {(error || localError) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || localError}</AlertDescription>
          </Alert>
        )}

        {saveSuccess && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Configuração salva com sucesso!
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'direct' | 'division')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">Valor Direto</TabsTrigger>
            <TabsTrigger value="division">Divisão da Banca</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="directValue">Valor de 1 Unidade (R$)</Label>
              <Input
                id="directValue"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 100.00"
                value={formData.directValue}
                onChange={(e) => handleInputChange('directValue', e.target.value)}
                disabled={isSaving || isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Informe diretamente quanto vale 1 unidade em reais.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="division" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bankAmount">Valor da Banca (R$)</Label>
              <Input
                id="bankAmount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 10000.00"
                value={formData.bankAmount}
                onChange={(e) => handleInputChange('bankAmount', e.target.value)}
                disabled={isSaving || isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="divisor">Divisor</Label>
              <Input
                id="divisor"
                type="number"
                step="1"
                min="1"
                placeholder="Ex: 100"
                value={formData.divisor}
                onChange={(e) => handleInputChange('divisor', e.target.value)}
                disabled={isSaving || isLoading}
              />
              <p className="text-xs text-muted-foreground">
                A banca será dividida por este número para calcular o valor de 1 unidade.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {calculatedUnitValue !== null && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">Valor Calculado de 1 Unidade:</p>
            <p className="text-lg font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(calculatedUnitValue)}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isConfigured() && (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isSaving || isLoading}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Limpando...
                </>
              ) : (
                'Limpar Configuração'
              )}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading || calculatedUnitValue === null}
            className="w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configuração'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

