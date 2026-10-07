import React, { useState, useEffect } from 'react';
import { fmtDinheiro } from '@/utils/formato';
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
import { useTranslation } from 'react-i18next';
import { MOEDAS } from '@/config/moedas';
import { SeletorDeMoeda } from '@/components/SeletorDeMoeda';
import { useMoeda } from '@/config/MoedaProvider';
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
  const { t } = useTranslation('apostas');
  const { moeda, trocarMoeda } = useMoeda();
  const simboloDaMoeda = MOEDAS.find((m) => m.codigo === moeda)?.simbolo ?? moeda;
  const { config, isLoading, error, updateConfig, clearConfig, isConfigured } = useUserUnit();
  const [activeTab, setActiveTab] = useState<'direct' | 'division'>('direct');
  const [formData, setFormData] = useState({
    directValue: '',
    bankAmount: '',
    divisor: '',
  });
  // ⚠️ GUARDA A CHAVE, E NÃO A FRASE. Frase traduzida guardada em estado fica
  // presa no idioma do momento em que o erro aconteceu: troca o idioma e o
  // aviso continua na língua antiga. A chave é traduzida na pintura.
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
        setLocalError('unidade.erroUnidadeZero');
        return false;
      }
    } else {
      const bank = parseFloat(formData.bankAmount);
      const div = parseFloat(formData.divisor);
      if (!formData.bankAmount || isNaN(bank) || bank <= 0) {
        setLocalError('unidade.erroBancaZero');
        return false;
      }
      if (!formData.divisor || isNaN(div) || div <= 0) {
        setLocalError('unidade.erroDivisorZero');
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
        setLocalError('unidade.erroSalvar');
      }
    } catch (err) {
      setLocalError('unidade.erroSalvar');
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
        setLocalError('unidade.erroLimpar');
      }
    } catch (err) {
      setLocalError('unidade.erroLimpar');
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
      <DialogContent className="theme-rebrand bg-white border-line text-ink sm:max-w-[500px]">
        <DialogHeader>
          <div className="text-[11px] uppercase tracking-[0.16em] text-forest font-semibold">{t('unidade.sobretitulo')}</div>
          <DialogTitle className="text-[18px] font-semibold tracking-tight text-ink">{t('unidade.titulo')}</DialogTitle>
          <DialogDescription className="text-ink-2 text-[13px]">
            {t('unidade.descricao')}
          </DialogDescription>
        </DialogHeader>

        {(error || localError) && (
          <div className="flex items-start gap-2 p-3 bg-status-danger/10 border border-status-danger/30 rounded-md text-[12px] text-status-danger">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error || (localError && t(localError))}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-start gap-2 p-3 bg-status-success/10 border border-status-success/30 rounded-md text-[12px] text-status-success">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t('unidade.salvo')}</span>
          </div>
        )}

        {/* A MOEDA VEM ANTES DOS VALORES porque ela enquadra os dois campos:
            "Valor de 1 unidade" não quer dizer nada sem saber de que moeda se
            fala. O padrão vem do país do cadastro; aqui a pessoa corrige.

            ⚠️ Trocar aqui NÃO converte nada — muda o símbolo e a pontuação, e
            o número segue o mesmo. É decisão de produto, e o aviso embaixo do
            campo diz isso para quem está escolhendo. */}
        <div className="space-y-1.5">
          <Label htmlFor="moeda" className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">
            {t('unidade.moeda')}
          </Label>
          <SeletorDeMoeda id="moeda" valor={moeda} aoEscolher={trocarMoeda} />
          {/* O aviso tinha `text-ink-3` em 11px e ficava quase invisível — e é a
              frase que impede alguém de achar que o dinheiro foi convertido. */}
          <p className="text-[12px] text-ink-2">{t('unidade.moedaAjuda')}</p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'direct' | 'division')}>
          <TabsList className="grid w-full grid-cols-2 h-9 bg-ink-3 border border-line p-0.5 rounded-md">
            <TabsTrigger
              value="direct"
              className="h-7 text-[12px] font-semibold rounded text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-line"
            >
              {t('unidade.abaDireto')}
            </TabsTrigger>
            <TabsTrigger
              value="division"
              className="h-7 text-[12px] font-semibold rounded text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-line"
            >
              {t('unidade.abaDivisao')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-2 mt-4">
            <Label htmlFor="directValue" className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">{t('unidade.valorDaUnidade', { simbolo: simboloDaMoeda })}</Label>
            <Input
              id="directValue"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Ex: 100,00"
              value={formData.directValue}
              onChange={(e) => handleInputChange('directValue', e.target.value)}
              disabled={isSaving || isLoading}
              className="h-10 bg-canvas border-line text-ink tabular focus:border-forest"
            />
            <p className="text-[11px] text-ink-2">
              {t('unidade.ajudaDireto')}
            </p>
          </TabsContent>

          <TabsContent value="division" className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label htmlFor="bankAmount" className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">{t('unidade.valorDaBanca', { simbolo: simboloDaMoeda })}</Label>
              <Input
                id="bankAmount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 10.000,00"
                value={formData.bankAmount}
                onChange={(e) => handleInputChange('bankAmount', e.target.value)}
                disabled={isSaving || isLoading}
                className="h-10 bg-canvas border-line text-ink tabular focus:border-forest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="divisor" className="text-[10px] uppercase tracking-[0.12em] text-ink-2 font-semibold">{t('unidade.divisor')}</Label>
              <Input
                id="divisor"
                type="number"
                step="1"
                min="1"
                placeholder="Ex: 100"
                value={formData.divisor}
                onChange={(e) => handleInputChange('divisor', e.target.value)}
                disabled={isSaving || isLoading}
                className="h-10 bg-canvas border-line text-ink tabular focus:border-forest"
              />
              <p className="text-[11px] text-ink-2">
                {t('unidade.ajudaDivisao')}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {calculatedUnitValue !== null && (
          <div className="rounded-md bg-forest-tint border border-forest/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-forest font-semibold">{t('unidade.calculado')}</p>
            <p className="text-[20px] font-semibold text-forest tabular tracking-tight mt-0.5">
              {fmtDinheiro(calculatedUnitValue)}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isConfigured() && (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isSaving || isLoading}
              className="w-full sm:w-auto h-10 border-line bg-white text-ink-2 hover:bg-ink-3/40 hover:text-ink"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('unidade.limpando')}
                </>
              ) : (
                t('unidade.limpar')
              )}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading || calculatedUnitValue === null}
            className="w-full sm:w-auto h-10 bg-forest hover:bg-forest-soft text-white font-semibold disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('unidade.salvando')}
              </>
            ) : (
              t('unidade.salvar')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

