/**
 * Testes do helper de rascunho de palpite.
 *
 * O que verificamos:
 *  - read/write/clear funcionam como esperado
 *  - rascunho vazio (home="" away="") é tratado como "limpar" e não polui storage
 *  - rascunhos antigos (>7 dias) são removidos automaticamente ao ler
 *  - localStorage indisponível não quebra o app (modo privado)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readDraft, writeDraft, clearDraft } from './useDraftPrediction';

const BOLAO = 'b1';
const MATCH = 42;

describe('useDraftPrediction helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('writeDraft + readDraft', () => {
    it('persiste valores e lê de volta', () => {
      writeDraft(BOLAO, MATCH, '2', '1');
      expect(readDraft(BOLAO, MATCH)).toEqual({ home: '2', away: '1' });
    });

    it('rascunhos de bolões/jogos diferentes não conflitam', () => {
      writeDraft('bolao-A', 1, '3', '0');
      writeDraft('bolao-B', 1, '0', '3');
      writeDraft('bolao-A', 2, '1', '1');

      expect(readDraft('bolao-A', 1)).toEqual({ home: '3', away: '0' });
      expect(readDraft('bolao-B', 1)).toEqual({ home: '0', away: '3' });
      expect(readDraft('bolao-A', 2)).toEqual({ home: '1', away: '1' });
    });

    it('retorna null quando nunca foi escrito', () => {
      expect(readDraft(BOLAO, MATCH)).toBeNull();
    });

    it('aceita reescrever (sobrescreve valor anterior)', () => {
      writeDraft(BOLAO, MATCH, '1', '0');
      writeDraft(BOLAO, MATCH, '2', '2');
      expect(readDraft(BOLAO, MATCH)).toEqual({ home: '2', away: '2' });
    });
  });

  describe('rascunho vazio', () => {
    it('writeDraft com home="" e away="" remove o rascunho (não persiste lixo)', () => {
      writeDraft(BOLAO, MATCH, '3', '1');
      expect(readDraft(BOLAO, MATCH)).not.toBeNull();

      writeDraft(BOLAO, MATCH, '', '');
      expect(readDraft(BOLAO, MATCH)).toBeNull();
    });

    it('mantém quando só um lado tá vazio (user ainda tá digitando)', () => {
      writeDraft(BOLAO, MATCH, '2', '');
      expect(readDraft(BOLAO, MATCH)).toEqual({ home: '2', away: '' });
    });
  });

  describe('clearDraft', () => {
    it('remove o rascunho', () => {
      writeDraft(BOLAO, MATCH, '1', '1');
      clearDraft(BOLAO, MATCH);
      expect(readDraft(BOLAO, MATCH)).toBeNull();
    });

    it('é idempotente (chamar 2x não quebra)', () => {
      clearDraft(BOLAO, MATCH);
      clearDraft(BOLAO, MATCH);
      expect(readDraft(BOLAO, MATCH)).toBeNull();
    });
  });

  describe('expiração (TTL 7 dias)', () => {
    it('lê normalmente quando tem <7 dias', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-23T10:00:00Z'));
      writeDraft(BOLAO, MATCH, '2', '1');

      // 6 dias depois
      vi.setSystemTime(new Date('2026-04-29T10:00:00Z'));
      expect(readDraft(BOLAO, MATCH)).toEqual({ home: '2', away: '1' });
    });

    it('retorna null e limpa storage quando passa de 7 dias', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-23T10:00:00Z'));
      writeDraft(BOLAO, MATCH, '2', '1');

      // 8 dias depois
      vi.setSystemTime(new Date('2026-05-01T10:00:00Z'));
      expect(readDraft(BOLAO, MATCH)).toBeNull();

      // E confirma que foi removido do storage (não fica zumbi)
      const raw = localStorage.getItem('bolao_draft_pred_b1_42');
      expect(raw).toBeNull();
    });
  });

  describe('robustez', () => {
    it('readDraft retorna null se o JSON guardado tá corrompido', () => {
      // Simula um valor malformed (foi adulterado)
      localStorage.setItem('bolao_draft_pred_b1_42', 'isso-nao-eh-json');
      expect(readDraft(BOLAO, MATCH)).toBeNull();
    });

    it('writeDraft não quebra se localStorage joga (modo privado/quota cheia)', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Esperamos que NÃO lance erro
      expect(() => writeDraft(BOLAO, MATCH, '2', '1')).not.toThrow();
      setItemSpy.mockRestore();
    });
  });
});
