import { describe, expect, it } from 'vitest';
import { agruparPorDia, buscar, ehAssinante, formatarDia } from './crm-lista';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';
import type { Cadastro } from './crm-lista';

/** O agrupamento é genérico agora; aqui ele sempre agrupa cadastros. */
const porDia = (cadastros: Cadastro[]) => agruparPorDia(cadastros, (c) => c.created_at);

// ============================================================================
// A lista por dia
// ============================================================================
// Tudo aqui é função pura sobre linhas do banco, e é de propósito: agrupar por
// dia é a parte que erra calada. O carimbo vem em UTC, e um cadastro feito às
// 22h de Brasília já é o dia seguinte lá — agrupar pelo carimbo cru joga a
// noite inteira para amanhã e ninguém percebe olhando a tela.
// ============================================================================

describe('agruparPorDia', () => {
  it('agrupa pelo dia de Brasília, não pelo carimbo cru', () => {
    // 01:30 UTC do dia 11 é 22:30 do dia 10 em Brasília. Pelo carimbo cru este
    // cadastro cairia em 11.
    const dias = porDia([cadastro({ created_at: '2026-09-11T01:30:00Z' })]);
    expect(dias).toHaveLength(1);
    expect(dias[0].dia).toBe('2026-09-10');
  });

  it('põe o dia mais recente primeiro', () => {
    const dias = porDia([
      cadastro({ id: 'a', created_at: '2026-09-08T12:00:00Z' }),
      cadastro({ id: 'b', created_at: '2026-09-10T12:00:00Z' }),
      cadastro({ id: 'c', created_at: '2026-09-09T12:00:00Z' }),
    ]);
    expect(dias.map((d) => d.dia)).toEqual(['2026-09-10', '2026-09-09', '2026-09-08']);
  });

  it('e ordena DENTRO do dia também', () => {
    // Sem isto o grupo herda a ordem que a consulta devolveu, e mexer no
    // `order by` do hook reordena a tela sem nada acender. Já passou batido
    // uma vez: inverter as linhas de cada dia deixava a suíte inteira verde.
    const dias = porDia([
      cadastro({ id: 'manha', created_at: '2026-09-10T09:00:00Z' }),
      cadastro({ id: 'noite', created_at: '2026-09-10T22:00:00Z' }),
      cadastro({ id: 'tarde', created_at: '2026-09-10T15:00:00Z' }),
    ]);
    expect(dias[0].itens.map((c) => c.id)).toEqual(['noite', 'tarde', 'manha']);
  });

  it('carimbo empatado desempata pelo identificador, e não pela sorte', () => {
    // O Postgres não garante ordem entre linhas empatadas: sem desempate, a
    // lista troca de ordem entre dois carregamentos sem nada ter mudado.
    const mesmo = '2026-09-10T12:00:00Z';
    const ordem = (ids: string[]) =>
      porDia(ids.map((id) => cadastro({ id, created_at: mesmo })))[0].itens.map((c) => c.id);
    expect(ordem(['b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    expect(ordem(['c', 'b', 'a'])).toEqual(['a', 'b', 'c']);
  });

  it('não inventa cabeçalho para dia sem cadastro', () => {
    // Entre 08 e 10 há um buraco. Um agrupamento que preenche o calendário
    // desenharia o dia 09 vazio, e a lista viraria um calendário em vez de um
    // registro do que aconteceu.
    const dias = porDia([
      cadastro({ id: 'a', created_at: '2026-09-08T12:00:00Z' }),
      cadastro({ id: 'b', created_at: '2026-09-10T12:00:00Z' }),
    ]);
    expect(dias.map((d) => d.dia)).toEqual(['2026-09-10', '2026-09-08']);
  });

  it('cadastro sem data não some: cai num grupo próprio, no fim', () => {
    // `created_at` é anulável no banco. Descartar a linha esconderia uma pessoa
    // real do painel — o pior desfecho possível num CRM.
    const dias = porDia([
      cadastro({ id: 'a', created_at: '2026-09-10T12:00:00Z' }),
      cadastro({ id: 'b', created_at: null }),
    ]);
    expect(dias).toHaveLength(2);
    expect(dias[1].dia).toBeNull();
    expect(dias[1].itens.map((c) => c.id)).toEqual(['b']);
  });
});

describe('buscar', () => {
  const base = [
    cadastro({ id: 'a', name: 'Maria Silva', email: 'maria@exemplo.com' }),
    cadastro({ id: 'b', name: null, email: 'joao@exemplo.com', whatsapp_number: '5511998877665' }),
  ];

  it('acha por nome, sem depender de acento nem de caixa', () => {
    expect(buscar(base, 'maria').map((c) => c.id)).toEqual(['a']);
    expect(buscar(base, 'SILVA').map((c) => c.id)).toEqual(['a']);
  });

  it('acha por e-mail', () => {
    expect(buscar(base, 'joao@').map((c) => c.id)).toEqual(['b']);
  });

  it('acha por telefone mesmo quando a pessoa digita com máscara', () => {
    // O banco guarda só dígitos; quem procura copia do WhatsApp, com traço e
    // parênteses. Comparar as duas strings cruas nunca acha nada.
    expect(buscar(base, '(11) 99887-7665').map((c) => c.id)).toEqual(['b']);
  });

  it('cadastro sem nome não quebra a busca', () => {
    expect(() => buscar(base, 'qualquer')).not.toThrow();
    expect(buscar(base, 'qualquer')).toEqual([]);
  });

  it('busca vazia devolve tudo', () => {
    expect(buscar(base, '   ')).toHaveLength(2);
  });
});

describe('ehAssinante', () => {
  it('basta um acesso premium', () => {
    expect(ehAssinante(cadastro({ futebol_subscription_status: 'premium' }))).toBe(true);
    expect(ehAssinante(cadastro({ betinho_subscription_status: 'premium' }))).toBe(true);
  });

  it('sem nenhum acesso, não é assinante', () => {
    expect(ehAssinante(cadastro())).toBe(false);
  });
});

describe('formatarDia', () => {
  it('vira o dia para a ordem que se lê no Brasil', () => {
    expect(formatarDia('2026-09-10')).toBe('10/09/2026');
  });
});
