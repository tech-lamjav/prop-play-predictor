import { describe, expect, it } from 'vitest';
import { idDaSugerida, linkDoWhatsApp, mensagemPara, modelosDeAbordagem } from './crm-mensagens';
import { ETAPAS, ROTULO_DA_ETAPA } from './crm-vocabulario';
import type { TipoDeGancho } from './crm-ficha';

const GANCHOS: TipoDeGancho[] = ['betinho', 'futebol', 'nba', 'indefinido'];

describe('mensagemPara', () => {
  it('usa o primeiro nome de quem tem nome', () => {
    const texto = mensagemPara('betinho', 'novo', 'Maria');
    expect(texto).toContain('Maria');
  });

  it('sem nome, não vira "Olá , tudo bem?"', () => {
    // O buraco clássico do modelo com lacuna. A saudação inteira muda, e não
    // só a lacuna: sobra vírgula solta em qualquer solução preguiçosa.
    const texto = mensagemPara('betinho', 'novo', null);
    expect(texto).not.toMatch(/,\s*[!?.]/);
    expect(texto).not.toMatch(/\s{2,}/);
    expect(texto.trim()).toBe(texto);
  });

  it('nenhum modelo deixa lacuna por preencher', () => {
    // Uma chave esquecida sairia como texto cru na conversa com o lead.
    for (const gancho of GANCHOS) {
      for (const etapa of ETAPAS) {
        for (const nome of ['Maria', null]) {
          expect(mensagemPara(gancho, etapa, nome)).not.toMatch(/\{|\}/);
        }
      }
    }
  });

  it('todo par de gancho e etapa tem texto', () => {
    // A garantia real é de tipo: `POR_ETAPA` é um Record total sobre Etapa, e
    // etapa nova quebra a compilação. Este teste guarda o outro lado — que o
    // texto existente não seja um toco.
    for (const gancho of GANCHOS) {
      for (const etapa of ETAPAS) {
        expect(mensagemPara(gancho, etapa, 'Maria').trim().length).toBeGreaterThan(20);
      }
    }
  });

  it('o gancho muda a conversa, e não só o nome', () => {
    // É a razão de o CRM existir: um assinante do Essencial cujo olho brilhou
    // no Betinho precisa ouvir falar de Betinho.
    const betinho = mensagemPara('betinho', 'novo', 'Maria');
    const futebol = mensagemPara('futebol', 'novo', 'Maria');
    expect(betinho).not.toBe(futebol);
    expect(betinho).toMatch(/betinho/i);
    expect(futebol).toMatch(/futebol/i);
  });

  it('a etapa também muda a conversa', () => {
    const primeiro = mensagemPara('betinho', 'novo', 'Maria');
    const retomada = mensagemPara('betinho', 'sem_resposta', 'Maria');
    expect(primeiro).not.toBe(retomada);
  });

  it('gancho indefinido cai num texto que não chuta o assunto', () => {
    const texto = mensagemPara('indefinido', 'novo', 'Maria');
    expect(texto).not.toMatch(/betinho|futebol|nba/i);
  });

  it('nenhum texto de futebol promete acesso livre a um produto pago', () => {
    // O futebol é pago, com 48 horas de teste. Prometer "sem compromisso
    // nenhum" fecha a conversa mal no dia em que a pessoa esbarra no paywall.
    for (const etapa of ETAPAS) {
      expect(mensagemPara('futebol', etapa, 'Maria')).not.toMatch(
        /sem compromisso|de graça|gratuito para sempre/i,
      );
    }
  });

  it('nenhuma mensagem do catálogo promete teste de sete dias', () => {
    // ⚠️ O teste grátis passou de 7 dias para 48 horas (#410), e uma mensagem
    // continuou dizendo "o teste de sete dias não custa nada". Com o seletor, o
    // sócio escolhe qualquer texto do catálogo, e esse chegaria ao cliente
    // prometendo cinco dias que o produto não dá.
    for (const m of modelosDeAbordagem('Maria')) {
      expect(m.texto, m.id).not.toMatch(/\b(7|sete)\s+dias\b/i);
    }
  });

  it('nenhuma mensagem afirma como fato o que o gancho só supõe', () => {
    // O gancho é palpite. "Vi que você entrou nas análises de futebol" soa como
    // fato e pode estar errado: o mesmo gancho nasce de quem só leu a
    // explicação dos alertas de publicação.
    for (const gancho of GANCHOS) {
      for (const etapa of ETAPAS) {
        expect(mensagemPara(gancho, etapa, 'Maria')).not.toMatch(
          /vi que você (entrou|acessou|olhou|assinou|viu)/i,
        );
      }
    }
  });
});

describe('linkDoWhatsApp', () => {
  it('monta o endereço com o número e o texto', () => {
    const link = linkDoWhatsApp('5511998877665', 'oi');
    expect(link).toBe('https://wa.me/5511998877665?text=oi');
  });

  it('aceita número com máscara, porque é como ele costuma ser copiado', () => {
    expect(linkDoWhatsApp('+55 (11) 99887-7665', 'oi')).toContain('5511998877665');
  });

  it('escapa o texto, senão quebra de linha e acento arruínam o link', () => {
    const link = linkDoWhatsApp('5511998877665', 'oi, tudo bem?\nabraço');
    expect(link).toContain('%0A');
    expect(link).not.toContain('\n');
    expect(link).toContain(encodeURIComponent('abraço'));
  });

  it('sem número, não existe link', () => {
    // Metade da base antiga não tem WhatsApp. Um link quebrado abre uma aba em
    // branco e o sócio não entende por quê.
    expect(linkDoWhatsApp(null, 'oi')).toBeNull();
    expect(linkDoWhatsApp('   ', 'oi')).toBeNull();
  });

  it('número curto demais para ser telefone também não vira link', () => {
    expect(linkDoWhatsApp('11999', 'oi')).toBeNull();
  });
});

describe('número sem código do país', () => {
  it('não vira link', () => {
    // Onze dígitos é um celular brasileiro sem DDI. O endereço montado assim
    // leva a outra pessoa ou a lugar nenhum — e mandar mensagem para um
    // estranho é pior que não ter botão.
    expect(linkDoWhatsApp('11998877665', 'oi')).toBeNull();
  });

  it('com o código do país, vira', () => {
    expect(linkDoWhatsApp('5511998877665', 'oi')).not.toBeNull();
  });
});

describe('nenhuma mensagem usa travessão', () => {
  it('em nenhum par de gancho e etapa', () => {
    // Pedido do Victor. A razão é prática: a mensagem é escrita aqui e colada
    // no WhatsApp, onde ninguém escreve com travessão. O sinal denuncia que o
    // texto foi redigido em outro lugar, e o que a gente quer é que pareça
    // mensagem de gente.
    //
    // O teste percorre TODOS os pares, e não só os que existem hoje: um modelo
    // novo escrito daqui a três meses cai aqui sozinho.
    for (const gancho of GANCHOS) {
      for (const etapa of ETAPAS) {
        for (const nome of ['Maria', null]) {
          const texto = mensagemPara(gancho, etapa, nome);
          expect(texto, `${gancho} + ${etapa}`).not.toMatch(/[\u2013\u2014]/);
        }
      }
    }
  });
});

describe('o catálogo para trocar de mensagem', () => {
  it('toda mensagem que a sugestão pode escolher está no catálogo', () => {
    // Senão existiria mensagem que a caixa mostra sozinha e que o sócio nunca
    // consegue escolher de volta depois de trocar para outra.
    const textos = modelosDeAbordagem('Maria').map((m) => m.texto);
    for (const gancho of GANCHOS) {
      for (const etapa of ETAPAS) {
        expect(textos, `${gancho} + ${etapa}`).toContain(mensagemPara(gancho, etapa, 'Maria'));
      }
    }
  });

  it('a marcada como sugerida é a mesma que está na caixa, em todo par', () => {
    // ⚠️ `idDaSugerida` repete a escada de `mensagemPara`. Se as duas
    // divergirem, a tela marca "(sugerida)" numa opção e mostra outro texto.
    const porId = new Map(modelosDeAbordagem('Maria').map((m) => [m.id, m.texto]));
    for (const gancho of GANCHOS) {
      for (const etapa of ETAPAS) {
        expect(porId.get(idDaSugerida(gancho, etapa)), `${gancho} + ${etapa}`).toBe(
          mensagemPara(gancho, etapa, 'Maria'),
        );
      }
    }
  });

  it('nenhum identificador se repete', () => {
    // O seletor usa o identificador como valor. Repetido, escolher um marca o
    // outro, e a caixa mostra o texto errado.
    const ids = modelosDeAbordagem('Maria').map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('as opções seguem a ordem do funil', () => {
    const grupos = modelosDeAbordagem('Maria')
      .map((m) => m.grupo)
      .filter((g, i, todos) => todos.indexOf(g) === i);
    expect(grupos).toEqual(ETAPAS.map((e) => ROTULO_DA_ETAPA[e]));
  });

  it('usa o nome, e sem nome não deixa vírgula solta', () => {
    expect(modelosDeAbordagem('Maria').every((m) => m.texto.includes('Maria'))).toBe(true);
    for (const m of modelosDeAbordagem(null)) {
      expect(m.texto, m.id).not.toMatch(/,\s*[!?.]/);
    }
  });

  it('nenhum modelo do catálogo deixa lacuna nem usa travessão', () => {
    for (const nome of ['Maria', null]) {
      for (const m of modelosDeAbordagem(nome)) {
        expect(m.texto, m.id).not.toMatch(/\{|\}/);
        expect(m.texto, m.id).not.toMatch(/[–—]/);
      }
    }
  });
});
