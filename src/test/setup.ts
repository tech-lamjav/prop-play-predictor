/**
 * Setup global executado antes de todos os testes.
 * - Adiciona matchers extras do jest-dom (toBeInTheDocument, toHaveClass, etc.)
 * - Faz cleanup automático do DOM entre testes
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
