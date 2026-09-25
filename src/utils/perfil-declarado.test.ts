import { describe, expect, it } from 'vitest';
import {
  aberturaPara,
  deveAbrirAPesquisa,
  FREQUENCIAS,
  JANELA_DE_CHEGADA_MS,
  OBJETIVOS,
  PERGUNTAS,
  rotaPermitePesquisa,
  type EstadoDaPesquisa,
} from './perfil-declarado';

/** Alguém logado, que nunca respondeu, numa rota comum. O caso que ABRE. */
const BASE: EstadoDaPesquisa = {
  logada: true,
  respondeu: false,
  adiouNestaSessao: false,
  pathname: '/futebol',
};

describe('rotaPermitePesquisa', () => {
  it('libera as telas de dentro do produto', () => {
    expect(rotaPermitePesquisa('/futebol')).toBe(true);
    expect(rotaPermitePesquisa('/inicio')).toBe(true);
    expect(rotaPermitePesquisa('/futebol/oportunidades')).toBe(true);
    expect(rotaPermitePesquisa('/bets')).toBe(true);
    expect(rotaPermitePesquisa('/settings')).toBe(true);
  });

  it('barra a tela de onboarding, pra uma coisa acontecer de cada vez', () => {
    expect(rotaPermitePesquisa('/onboarding')).toBe(false);
  });

  it('barra o login e a volta do provedor', () => {
    expect(rotaPermitePesquisa('/auth')).toBe(false);
    expect(rotaPermitePesquisa('/auth/callback')).toBe(false);
  });

  it('barra as landings, que é onde ainda não se entrou', () => {
    expect(rotaPermitePesquisa('/')).toBe(false);
    expect(rotaPermitePesquisa('/nba')).toBe(false);
    expect(rotaPermitePesquisa('/betinho')).toBe(false);
    expect(rotaPermitePesquisa('/futebol/comecar')).toBe(false);
    expect(rotaPermitePesquisa('/bolao/comecar')).toBe(false);
    expect(rotaPermitePesquisa('/lp/qualquer-variante')).toBe(false);
  });

  it('barra as telas de preço e assinatura', () => {
    expect(rotaPermitePesquisa('/planos')).toBe(false);
    expect(rotaPermitePesquisa('/paywall')).toBe(false);
    expect(rotaPermitePesquisa('/paywall-dashboard')).toBe(false);
    expect(rotaPermitePesquisa('/paywall-platform')).toBe(false);
    expect(rotaPermitePesquisa('/futebol/assinar')).toBe(false);
    expect(rotaPermitePesquisa('/waitlist')).toBe(false);
  });

  it('barra a página pública de compartilhamento', () => {
    expect(rotaPermitePesquisa('/share/abc123')).toBe(false);
  });

  it('barra os documentos legais', () => {
    expect(rotaPermitePesquisa('/privacidade')).toBe(false);
    expect(rotaPermitePesquisa('/termos')).toBe(false);
  });

  // A regra é "igual ao prefixo, ou filho dele". Sem o segundo pedaço, uma
  // subrota de landing escaparia; sem o primeiro, a raiz barraria o site
  // inteiro, já que toda rota começa com barra.
  it('barra as subrotas do que está barrado', () => {
    expect(rotaPermitePesquisa('/onboarding/qualquer-coisa')).toBe(false);
    expect(rotaPermitePesquisa('/auth/')).toBe(false);
  });

  it('a raiz barrada não barra o resto do site', () => {
    expect(rotaPermitePesquisa('/')).toBe(false);
    expect(rotaPermitePesquisa('/futebol')).toBe(true);
  });

  // `/nba` é landing e `/nba-dashboard` é produto. Um prefixo cru confundiria
  // os dois, porque um começa com o outro.
  it('não confunde irmão com filho', () => {
    expect(rotaPermitePesquisa('/nba')).toBe(false);
    expect(rotaPermitePesquisa('/nba-dashboard/lebron-james')).toBe(true);
  });
});

describe('deveAbrirAPesquisa', () => {
  it('abre pra quem está logada e nunca respondeu', () => {
    expect(deveAbrirAPesquisa(BASE)).toBe(true);
  });

  it('não abre pra quem não está logada', () => {
    expect(deveAbrirAPesquisa({ ...BASE, logada: false })).toBe(false);
  });

  it('não abre pra quem já respondeu', () => {
    expect(deveAbrirAPesquisa({ ...BASE, respondeu: true })).toBe(false);
  });

  it('não abre de novo pra quem adiou nesta sessão', () => {
    expect(deveAbrirAPesquisa({ ...BASE, adiouNestaSessao: true })).toBe(false);
  });

  it('não abre nas rotas barradas', () => {
    expect(deveAbrirAPesquisa({ ...BASE, pathname: '/onboarding' })).toBe(false);
    expect(deveAbrirAPesquisa({ ...BASE, pathname: '/auth' })).toBe(false);
  });

  // A volta do Stripe cai numa rota de produto comum (`/bolao/<id>` ou a tela
  // de paywall) carregando `success=true`. Barrar a rota inteira tiraria a
  // pesquisa de uma tela legítima; o que interrompe é o pagamento, e é ele que
  // aparece na query.
  it('não abre na volta de um pagamento', () => {
    expect(
      deveAbrirAPesquisa({ ...BASE, pathname: '/bolao/42', search: '?success=true&session_id=cs_123' }),
    ).toBe(false);
  });

  it('a mesma tela sem o pagamento abre normalmente', () => {
    expect(deveAbrirAPesquisa({ ...BASE, pathname: '/bolao/42' })).toBe(true);
    expect(deveAbrirAPesquisa({ ...BASE, pathname: '/bolao/42', search: '?aba=palpites' })).toBe(true);
  });
});

describe('aberturaPara', () => {
  const agora = new Date('2026-09-25T12:00:00Z').getTime();

  it('quem acabou de se cadastrar recebe a abertura de chegada', () => {
    const haUmaHora = new Date(agora - 60 * 60 * 1000).toISOString();
    expect(aberturaPara(haUmaHora, agora)).toBe('chegada');
  });

  it('quem já usava recebe a abertura de quem já está dentro', () => {
    const haSeisMeses = new Date(agora - 180 * 24 * 60 * 60 * 1000).toISOString();
    expect(aberturaPara(haSeisMeses, agora)).toBe('base');
  });

  it('a virada é a janela de chegada', () => {
    const logoAntes = new Date(agora - JANELA_DE_CHEGADA_MS + 1000).toISOString();
    const logoDepois = new Date(agora - JANELA_DE_CHEGADA_MS - 1000).toISOString();
    expect(aberturaPara(logoAntes, agora)).toBe('chegada');
    expect(aberturaPara(logoDepois, agora)).toBe('base');
  });

  // Sem data, a abertura mais branda é a que serve pros dois: "pra ajustar o
  // que a gente te mostra" faz sentido pra quem chegou agora, enquanto "pra
  // começar" soa errado pra quem usa há meses.
  it('sem data de cadastro, cai na abertura de quem já está dentro', () => {
    expect(aberturaPara(null, agora)).toBe('base');
    expect(aberturaPara(undefined, agora)).toBe('base');
    expect(aberturaPara('não é uma data', agora)).toBe('base');
  });
});

describe('o catálogo', () => {
  it('são duas perguntas, com quatro opções cada', () => {
    expect(PERGUNTAS).toHaveLength(2);
    for (const pergunta of PERGUNTAS) {
      expect(pergunta.opcoes).toHaveLength(4);
    }
  });

  // O código é o que fica gravado e nunca se renomeia; o texto é o que aparece
  // na tela e pode ser reescrito. A guarda é que todo código tenha texto: um
  // código sem frase vira uma opção invisível, que ninguém escolhe e que não
  // some da contagem.
  it('todo código tem texto, e todo texto tem código', () => {
    for (const pergunta of PERGUNTAS) {
      for (const opcao of pergunta.opcoes) {
        expect(opcao.codigo).toBeTruthy();
        expect(opcao.texto).toBeTruthy();
      }
    }
  });

  it('os códigos do catálogo são exatamente os que o banco aceita', () => {
    const [objetivo, frequencia] = PERGUNTAS;
    expect(objetivo.opcoes.map((o) => o.codigo)).toEqual([...OBJETIVOS]);
    expect(frequencia.opcoes.map((o) => o.codigo)).toEqual([...FREQUENCIAS]);
  });

  it('não repete código dentro de uma pergunta', () => {
    for (const pergunta of PERGUNTAS) {
      const codigos = pergunta.opcoes.map((o) => o.codigo);
      expect(new Set(codigos).size).toBe(codigos.length);
    }
  });
});
