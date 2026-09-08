import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrirDestino } from './abrir-destino';

// O erro que este módulo existe para impedir: `navigate('https://wa.me/...')`
// não abre o WhatsApp — ele monta uma rota interna com a URL inteira dentro e
// entrega um 404. É silencioso no código e óbvio na cara do usuário.

const semNavegar = () => {
  throw new Error('navigate não deveria ter sido chamado para link externo');
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('abrirDestino', () => {
  it('rota interna vai pelo router', () => {
    const navigate = vi.fn();
    abrirDestino('/settings', navigate);
    expect(navigate).toHaveBeenCalledWith('/settings');
  });

  it('link externo abre em aba nova, e não pelo router', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    abrirDestino('https://exemplo.com/oi', semNavegar as never);
    expect(open).toHaveBeenCalledWith(
      'https://exemplo.com/oi',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('http também é externo', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    abrirDestino('http://exemplo.com', semNavegar as never);
    expect(open).toHaveBeenCalled();
  });

  it('mailto não abre aba, entrega ao cliente de e-mail', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const navigate = vi.fn();
    abrirDestino('mailto:time@exemplo.com', navigate);
    expect(open).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('uma rota que só COMEÇA parecida com externa continua interna', () => {
    // "/httpsomething" não é link externo. A checagem é pelo esquema completo,
    // e não por um `startsWith('http')` solto.
    const navigate = vi.fn();
    abrirDestino('/https-guia', navigate);
    expect(navigate).toHaveBeenCalledWith('/https-guia');
  });
});
