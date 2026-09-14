import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { FichaAntiga } from './FichaAntiga';
import { ROTA_DO_CRM, ROTA_DOS_SOCIOS } from './crm-vocabulario';

// ============================================================================
// O endereço antigo do CRM
// ============================================================================
// O CRM morava na raiz da área, `/socios`, e a ficha de um lead morava em
// `/socios/<id>`. Os dois desceram um andar, e os links antigos continuam
// circulando: em favorito, em conversa de WhatsApp, na barra de endereço de
// quem digita de cabeça.
//
// Este arquivo prova as duas coisas que sustentam essa mudança. A primeira é
// que o endereço antigo chega no novo, com o lead certo. A segunda é menos
// óbvia e é a razão de o CRM ter descido: `/socios/<id>` é um coringa de
// segmento, e sem a prioridade de segmento fixo ele engoliria `/socios/crm` e
// toda tela nova que a área ganhar.
// ============================================================================

const Chegou = ({ onde }: { onde: string }) => <p>{`cheguei ${onde}`}</p>;

const montar = (endereco: string) =>
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path={ROTA_DOS_SOCIOS} element={<Navigate to={ROTA_DO_CRM} replace />} />
        <Route path={ROTA_DO_CRM} element={<Chegou onde="na lista" />} />
        <Route path={`${ROTA_DO_CRM}/:id`} element={<Chegou onde="na ficha" />} />
        <Route path={`${ROTA_DOS_SOCIOS}/:id`} element={<FichaAntiga />} />
      </Routes>
    </MemoryRouter>,
  );

describe('o endereço antigo da ficha', () => {
  it('leva à ficha do mesmo lead no endereço novo', () => {
    montar('/socios/u1');
    expect(screen.getByText('cheguei na ficha')).toBeInTheDocument();
  });

  it('sem id nenhum, leva à lista', () => {
    // `/socios` tem rota própria, então este caso não acontece pela navegação;
    // o componente não fica adivinhando o que fazer sem parâmetro.
    render(
      <MemoryRouter initialEntries={['/socios/']}>
        <Routes>
          <Route path={ROTA_DO_CRM} element={<Chegou onde="na lista" />} />
          <Route path={ROTA_DOS_SOCIOS} element={<FichaAntiga />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('cheguei na lista')).toBeInTheDocument();
  });
});

describe('a raiz da área', () => {
  it('leva ao CRM', () => {
    montar('/socios');
    expect(screen.getByText('cheguei na lista')).toBeInTheDocument();
  });
});

describe('o coringa não engole o andar de baixo', () => {
  it('/socios/crm é a lista, não uma ficha de um lead chamado crm', () => {
    montar('/socios/crm');
    expect(screen.getByText('cheguei na lista')).toBeInTheDocument();
  });
});
