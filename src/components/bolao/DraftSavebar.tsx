import React from 'react';
import { Save, AlertCircle, Loader2, Check } from 'lucide-react';

interface DraftSavebarProps {
  /** Quantos rascunhos completos (ambos os campos preenchidos) há pendentes */
  completeCount: number;
  /** Quantos rascunhos incompletos (só um campo preenchido) há pendentes */
  incompleteCount: number;
  isSaving: boolean;
  onSave: () => void;
  /** Scrolla pro primeiro card incompleto */
  onJumpToIncomplete: () => void;
  /** "modal" deixa o sticky absolute (dentro do scroll do modal); "page" usa fixed (viewport) */
  variant?: 'modal' | 'page';
  /** Quantos foram salvos no último batch — quando > 0, mostra feedback "✓ X salvos" por 1s */
  justSavedCount?: number;
}

/**
 * Barra fixa no rodapé que aparece quando há rascunhos pendentes.
 * Mostra "Salvar X palpites" + indicador de incompletos quando houver.
 */
export const DraftSavebar: React.FC<DraftSavebarProps> = ({
  completeCount,
  incompleteCount,
  isSaving,
  onSave,
  onJumpToIncomplete,
  variant = 'modal',
  justSavedCount = 0,
}) => {
  if (completeCount === 0 && incompleteCount === 0 && justSavedCount === 0) return null;

  const positionClass =
    variant === 'modal'
      ? 'sticky bottom-0 left-0 right-0 z-20'
      : 'fixed bottom-0 left-0 right-0 z-30';

  // Feedback "✓ X salvos" — barra inteira fica verde por 1s pós-sucesso
  if (justSavedCount > 0) {
    return (
      <div
        className={`${positionClass} -mx-5 px-5 py-3 bg-terminal-green border-t-2 border-terminal-green animate-in fade-in`}
        style={{ boxShadow: '0 -12px 24px -8px rgba(0, 0, 0, 0.6)' }}
      >
        <div className="flex items-center justify-center gap-2 max-w-2xl mx-auto h-10 text-sm font-bold text-terminal-bg">
          <Check className="w-5 h-5" />
          {justSavedCount} palpite{justSavedCount !== 1 ? 's' : ''} salvo{justSavedCount !== 1 ? 's' : ''}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${positionClass} -mx-5 px-5 py-3 bg-terminal-dark-gray border-t-2 border-terminal-green/40`}
      style={{ boxShadow: '0 -12px 24px -8px rgba(0, 0, 0, 0.6)' }}
    >
      <div className="flex items-center gap-2 max-w-2xl mx-auto">
        {incompleteCount > 0 && (
          <button
            type="button"
            onClick={onJumpToIncomplete}
            className="flex items-center gap-1.5 px-3 h-10 text-xs font-medium text-terminal-yellow border border-terminal-yellow/40 bg-terminal-yellow/10 rounded hover:bg-terminal-yellow/20 transition-colors shrink-0"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {incompleteCount} incompleto{incompleteCount !== 1 ? 's' : ''}
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || completeCount === 0}
          className="flex-1 flex items-center justify-center gap-2 h-10 px-4 text-sm font-bold text-terminal-bg bg-terminal-green hover:bg-terminal-green/90 active:scale-[0.98] disabled:bg-terminal-gray disabled:text-terminal-text/40 disabled:cursor-not-allowed rounded transition-all"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : completeCount === 0 ? (
            'Nada pra salvar'
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar {completeCount} palpite{completeCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
