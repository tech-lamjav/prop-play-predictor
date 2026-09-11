import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { PortaoDoSocio } from './PortaoDoSocio';

// ============================================================================
// O portão, do lado da tela
// ============================================================================
// A guarda de verdade é a política de linha no banco, e ela tem testes
// próprios em crm-fundacao.test.ts. Este arquivo cuida do outro lado: o que a
// pessoa errada VÊ quando acerta o endereço.
//
// A resposta é a página de não encontrado, e não uma de acesso negado. A
// diferença não é estética: "acesso negado" confirma que existe um painel ali,
// e o painel é justamente o que não queremos anunciar.
// ============================================================================

const estado = vi.hoisted(() => ({ atual: { ehSocio: false, carregando: true } }));
vi.mock('@/hooks/use-socio', () => ({ useSocio: () => estado.atual }));

const montar = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/socios']}>
        <PortaoDoSocio>
          <p>o painel</p>
        </PortaoDoSocio>
      </MemoryRouter>
    </HelmetProvider>,
  );

beforeEach(() => {
  estado.atual = { ehSocio: false, carregando: true };
});

describe('PortaoDoSocio', () => {
  it('enquanto não sabe quem é, não mostra painel nem 404', () => {
    // O default de `ehSocio` é falso, então um portão que decidisse durante o
    // carregamento piscaria a página de erro na cara do sócio a cada F5.
    montar();
    expect(screen.queryByText('o painel')).not.toBeInTheDocument();
    expect(screen.queryByText(/não encontrada/i)).not.toBeInTheDocument();
  });

  it('sócio entra', () => {
    estado.atual = { ehSocio: true, carregando: false };
    montar();
    expect(screen.getByText('o painel')).toBeInTheDocument();
  });

  it('quem não é sócio recebe a página de não encontrado', () => {
    estado.atual = { ehSocio: false, carregando: false };
    montar();
    expect(screen.getByText(/não encontrada/i)).toBeInTheDocument();
    expect(screen.queryByText('o painel')).not.toBeInTheDocument();
  });

  it('e a resposta não denuncia que existe um painel ali', () => {
    estado.atual = { ehSocio: false, carregando: false };
    const { container } = montar();
    expect(container.textContent).not.toMatch(/acesso negado|sem permissão|sócio|admin/i);
  });
});
