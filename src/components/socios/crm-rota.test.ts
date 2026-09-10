import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROTA_DOS_SOCIOS } from './crm-vocabulario';

// ============================================================================
// A rota não pode ser anunciada
// ============================================================================
// O painel não aparece em menu nenhum, e três arquivos podem estragar isso sem
// que ninguém perceba: o public-routes.json (que vira sitemap.xml no build), o
// robots.txt, e o próprio App.tsx se alguém montar a rota sem o portão.
//
// O robots.txt é o mais contraintuitivo dos três. Ele lista com Disallow tudo
// que exige login, e a tentação é acrescentar o painel na lista. Mas robots.txt
// é público: escrever o caminho lá é publicá-lo num arquivo que qualquer um lê.
// A rota fica de fora, e quem a protege é a política de linha no banco.
// ============================================================================

const raiz = (caminho: string) =>
  readFileSync(resolve(__dirname, '../../..', caminho), 'utf8').replace(/\r\n/g, '\n');

describe('o painel não é anunciado', () => {
  it('não entra no sitemap', () => {
    expect(raiz('src/seo/public-routes.json')).not.toContain(ROTA_DOS_SOCIOS);
  });

  it('não entra no robots.txt — listar o caminho lá é publicá-lo', () => {
    expect(raiz('public/robots.txt')).not.toContain(ROTA_DOS_SOCIOS);
  });

  it('a página do painel é noindex', () => {
    const pagina = 'src/pages/PainelDosSocios.tsx';
      // Ficar fora do sitemap não basta: o Google chega por qualquer link, e
      // uma página de app sem noindex vira página fantasma no índice. Tirar o
      // noindex não quebrava nada até este guarda existir.
      expect(raiz(pagina)).toMatch(/<Seo\s+noindex/);
    },
  );
});

describe('a rota nasce com o portão', () => {
  const APP = raiz('src/App.tsx');

  it('toda rota do painel passa pelo PortaoDoSocio', () => {
    // Montar a página sem o portão deixa o painel aberto para qualquer pessoa
    // logada. A tela quebraria sozinha na primeira consulta — a política de
    // linha devolve zero — mas a rota já teria confirmado que existe.
    //
    // O filtro procura a CONSTANTE, e não a string do endereço. Assim ele pega
    // também a segunda rota do painel, que vai nascer como `${ROTA}/:id` e não
    // conteria o endereço literal.
    const rotas = APP.split('\n').filter(
      (l) => l.includes('ROTA_DOS_SOCIOS') && l.includes('<Route'),
    );
    expect(rotas.length).toBeGreaterThan(0);
    for (const rota of rotas) expect(rota).toContain('PortaoDoSocio');
  });

  it('o App não escreve o endereço na mão', () => {
    // Com a string solta na tabela de rotas, mudar o endereço deixaria os
    // guardas do sitemap e do robots verdes protegendo um caminho morto.
    expect(APP).not.toContain(`path="${ROTA_DOS_SOCIOS}"`);
  });
});

describe('o painel usa o cabeçalho do site', () => {
  it('a página do painel monta o header do produto', () => {
    // O pedido foi explícito: o painel é uma tela interna do produto, e não um
    // lugar à parte. Sem este guarda, tirar o header não quebra teste nenhum —
    // e foi assim que ele nasceu sem header na primeira versão.
    expect(raiz('src/pages/PainelDosSocios.tsx')).toContain('<AnalyticsNav');
  });

  it('e a ficha herda isso, porque as duas rotas desenham a mesma página', () => {
    // A rota da lista e a da ficha apontam para PainelDosSocios: a segunda é a
    // primeira com o modal aberto por cima. É isso que mantém o endereço
    // compartilhável sem tirar ninguém da lista.
    const rotas = raiz('src/App.tsx')
      .split('\n')
      .filter((l) => l.includes('ROTA_DOS_SOCIOS') && l.includes('<Route'));
    expect(rotas).toHaveLength(2);
    for (const rota of rotas) expect(rota).toContain('PainelDosSocios');
  });

  it('e o painel tem a faixa de identidade do CRM', () => {
    expect(raiz('src/components/socios/PainelCrm.tsx')).toContain('<CabecalhoDoCrm');
  });
});
