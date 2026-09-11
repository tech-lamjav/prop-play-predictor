import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { itensDaConta } from './menu-da-conta';
import { SHOW_COMO_USAR_ENTRY_POINTS } from './como-usar';
import { WHATSAPP_FALAR_COM_O_TIME } from './contato';
import { ROTA_DOS_SOCIOS } from '@/components/socios/crm-vocabulario';

// ============================================================================
// O menu da conta é o mesmo no computador e no celular
// ============================================================================
// A regra já estava escrita no topo da tela de Perfil: "mesmo conteúdo nas duas
// plataformas, formato diferente". Só que o conteúdo morava em duas listas, uma
// em cada arquivo, e cumprir a regra dependia de alguém lembrar de editar as
// duas. Não lembrou — as listas divergiram em três pontos ao mesmo tempo:
//
//   · o celular tinha "Minha banca e apostas", que o computador não tinha
//   · a mesma página era "Plano e pagamento" lá e "Planos e preços" cá
//   · o celular oferecia um guia que o computador já tinha tirado do ar
//
// Uma lista só resolve por construção. Estes testes existem para que ela
// continue sendo uma: o guarda de fonte no fim é o que impede alguém de
// reescrever um array literal dentro de uma das telas outra vez.
// ============================================================================

const fonte = (caminho: string) =>
  readFileSync(resolve(__dirname, '..', caminho), 'utf8').replace(/\r\n/g, '\n');

const USER_NAV = fonte('components/UserNav.tsx');
const PERFIL = fonte('pages/Perfil.tsx');

describe('itens do menu da conta', () => {
  it('traz a lista na ordem do desenho', () => {
    const labels = itensDaConta(() => {}).map((i) => i.label);
    expect(labels).toEqual([
      'Configurações',
      'Planos e preços',
      'Indique um amigo',
      ...(SHOW_COMO_USAR_ENTRY_POINTS ? ['Como usar'] : []),
      'Falar com o time',
    ]);
  });

  it('"Falar com o time" aponta para o WhatsApp com mensagem pronta', () => {
    const item = itensDaConta(() => {}).find((i) => i.label === 'Falar com o time');
    expect(item?.href).toBe(WHATSAPP_FALAR_COM_O_TIME);
  });

  it('"Indique um amigo" chama a ação recebida, e não navega', () => {
    const indicar = vi.fn();
    const item = itensDaConta(indicar).find((i) => i.label === 'Indique um amigo');
    expect(item?.href).toBeUndefined();
    item?.onClick?.();
    expect(indicar).toHaveBeenCalledOnce();
  });

  // O teste segue a chave em vez de fixar o valor dela: prender `false` aqui
  // faria o CI quebrar em quem religar o item, que é exatamente a instrução
  // escrita em como-usar.ts.
  it('"Como usar" respeita a chave', () => {
    const temComoUsar = itensDaConta(() => {}).some((i) => i.label === 'Como usar');
    expect(temComoUsar).toBe(SHOW_COMO_USAR_ENTRY_POINTS);
  });

  it('as duas telas leem do catálogo, e nenhuma monta lista própria', () => {
    for (const arquivo of [USER_NAV, PERFIL]) {
      expect(arquivo).toContain('itensDaConta(openReferral,');
      // Nenhum item de menu escrito à mão dentro da tela. Um item de menu é uma
      // linha com rótulo E ícone — os blocos de número da tela de Perfil também
      // têm `label`, e não são menu. O "Sair da conta" é a exceção declarada:
      // ele muda de forma entre as duas telas e por isso não entra no catálogo.
      const itensNaMao = arquivo
        .split('\n')
        .filter((l) => /label: '/.test(l) && /icon:/.test(l) && !l.includes('Sair da conta'));
      expect(itensNaMao).toEqual([]);
    }
  });
});

describe('a entrada do CRM', () => {
  const doSocio = (ehSocio: boolean) => itensDaConta(() => {}, ehSocio);

  it('não existe para quem não é sócio', () => {
    // Quem protege o painel é a política de linha do banco, e não este item.
    // Mas mostrar a porta para quem não pode entrar é anunciar que ela existe,
    // que é justamente o que a rota escondida evita.
    expect(doSocio(false).some((i) => i.label === 'CRM')).toBe(false);
  });

  it('aparece para sócio', () => {
    expect(doSocio(true).some((i) => i.label === 'CRM')).toBe(true);
  });

  it('o padrão é não mostrar', () => {
    // Errar para menos: uma tela que esquecer de passar o parâmetro esconde o
    // item de um sócio, e não mostra a porta para a base inteira.
    expect(itensDaConta(() => {}).some((i) => i.label === 'CRM')).toBe(false);
  });

  it('leva para a rota dos sócios, e não para um endereço escrito à mão', () => {
    const item = doSocio(true).find((i) => i.label === 'CRM');
    expect(item?.href).toBe(ROTA_DOS_SOCIOS);
  });

  it('vem por último, e marcado como interno', () => {
    // Último porque não disputa espaço com o que o assinante usa, e marcado
    // porque as duas telas desenham ele separado do resto.
    const itens = doSocio(true);
    expect(itens[itens.length - 1].label).toBe('CRM');
    expect(itens[itens.length - 1].interno).toBe(true);
  });

  it('nenhum outro item é interno', () => {
    // Se "interno" virasse decoração, o separador nas duas telas deixaria de
    // significar alguma coisa.
    expect(
      doSocio(true)
        .filter((i) => i.interno)
        .map((i) => i.label),
    ).toEqual(['CRM']);
  });
});
