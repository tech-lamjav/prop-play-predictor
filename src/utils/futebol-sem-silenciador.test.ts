import { describe, expect, it } from 'vitest';
import { evidenciaDe } from './futebol-evidencias';
import { evidenciaDaPremissa } from './futebol-evidencia-da-premissa';
import { prestacaoDaPremissa, divergenciaDaPrestacao } from './futebol-criterio';
import type { FutebolFixtureHistorico, FutebolFixtureNumeros } from '@/services/futebol-data.service';
import CASOS_CAPTURADOS from './__fixtures__/futebol-criterios-casos.json';

// ============================================================================
// As guardas que escondiam a contradição saíram (issue #358, spec #349)
// ============================================================================
// `desmenteAlta` e `desmenteBaixa` devolviam `null` quando o número contradizia
// a premissa acesa, e o card ficava mudo. Elas existiam porque alguém já sabia
// que os números podiam contradizer — e resolveu escondendo, não corrigindo a
// origem. É por isso que o defeito da spec só aparecia em alguns cards.
//
// Com as dez premissas de gols prestando contas, o número embaixo de cada uma é
// o que o modelo comparou. Contradição agora é SINAL de derivação errada, e quem
// a acusa é a guarda de divergência da #353 — nunca o silenciador.
// ============================================================================

const numeros = (over: Partial<FutebolFixtureNumeros> = {}): FutebolFixtureNumeros[] => {
  const base = (side: 'home' | 'away', id: number, nome: string): FutebolFixtureNumeros => ({
    side,
    team_id: id,
    team_name: nome,
    posicao: 1,
    pontos: 10,
    zona: null,
    jogos: 10,
    jogos_casa: 5,
    jogos_fora: 5,
    gf_casa: 1,
    ga_casa: 1,
    gf_fora: 1,
    ga_fora: 1,
    gf_total: 1,
    ga_total: 1,
    clean_sheets: 2,
    sem_marcar: 2,
    forma: 'VVEDD',
    ...over,
  }) as FutebolFixtureNumeros;
  return [base('home', 1, 'Casa'), base('away', 2, 'Fora')];
};

describe('o número contraditório volta a aparecer', () => {
  it('"defesas firmes" acesa com soma ACIMA da linha mostra o número', () => {
    // Cada lado sofrendo 2,0 dá soma 4,0 numa linha 2,5: a soma contradiz a
    // premissa. Antes isto devolvia `null` e o card ficava mudo.
    const ev = evidenciaDe('defesas_firmes', numeros({ ga_casa: 2, ga_fora: 2 }), 'home', true, 2.5);

    expect(ev).not.toBeNull();
    expect(ev!.texto).toContain('4,0');
  });

  it('"defesas frágeis" acesa com soma ABAIXO da linha também mostra', () => {
    const ev = evidenciaDe('defesas_vazaveis', numeros({ ga_casa: 0.5, ga_fora: 0.5 }), 'home', true, 2.5);

    expect(ev).not.toBeNull();
    expect(ev!.texto).toContain('1,0');
  });

  it.each(['ataque_combinado', 'ataques_fracos'])('%s idem', (slug) => {
    const alto = evidenciaDe(slug, numeros({ gf_casa: 3, gf_fora: 3 }), 'home', true, 2.5);
    const baixo = evidenciaDe(slug, numeros({ gf_casa: 0.2, gf_fora: 0.2 }), 'home', true, 2.5);

    expect(alto).not.toBeNull();
    expect(baixo).not.toBeNull();
  });
});

// ============================================================================
// E o número que o assinante vê é o da PRESTAÇÃO, não o do perfil de temporada
// ============================================================================

const jogo = (over: Partial<FutebolFixtureHistorico> = {}): FutebolFixtureHistorico => ({
  side: 'home',
  team_id: 1,
  team_name: 'Casa',
  past_fixture_id: 1,
  data: '2026-08-01',
  ordem: 1,
  mesma_competicao: true,
  em_casa: true,
  adversario: 'Adversário',
  adversario_id: 9,
  gols_pro: 1,
  gols_contra: 1,
  total_gols: 2,
  ambos_marcaram: true,
  sem_sofrer: false,
  sem_marcar: false,
  xg: 1,
  xg_contra: 1,
  resultado: 'E',
  ...over,
});

describe('a evidência tem uma fonte só', () => {
  it('a prestação ganha do perfil de temporada quando existe', () => {
    // O perfil diz 4,0 (2,0 de cada). O histórico da janela diz 2,0 (1,0 de
    // cada). O card mostrava um e o subtítulo o outro; agora é o da prestação.
    const hist = [
      jogo({ side: 'home', team_id: 1, team_name: 'Casa', em_casa: true, gols_contra: 1 }),
      jogo({ side: 'away', team_id: 2, team_name: 'Fora', past_fixture_id: 2, em_casa: false, gols_contra: 1 }),
    ];
    const ev = evidenciaDaPremissa({
      mercado: 'goals_over_under',
      slug: 'defesas_firmes',
      numeros: numeros({ ga_casa: 2, ga_fora: 2 }),
      historico: hist,
      lado: 'home',
      linha: 3.25,
    });

    expect(ev!.texto).toContain('2,0');
    expect(ev!.texto).not.toContain('4,0');
    // E declara o corte, que o perfil de temporada nunca soube dizer.
    expect(ev!.texto).toContain('2,95');
  });

  it('sem prestação, o perfil de temporada continua servindo', () => {
    // As premissas dos outros mercados ainda não têm critério transcrito (#361).
    const ev = evidenciaDaPremissa({
      mercado: 'match_winner',
      slug: 'forca_mismatch',
      numeros: numeros(),
      historico: [],
      lado: 'home',
      linha: null,
    });

    expect(ev).not.toBeNull();
  });
});

// ============================================================================
// A verificação que a #358 pede: nenhum número contraditório em produção
// ============================================================================

interface CasoCapturado {
  origem: string;
  confronto: string;
  linha: number;
  veredito: Partial<Record<string, boolean>>;
  jogos: FutebolFixtureHistorico[];
}

const FAMILIA: Record<string, string> = {
  defesas_firmes: 'média combinada',
  defesas_vazaveis: 'média combinada',
  ataque_combinado: 'média combinada',
  xg_combinado_alto: 'média combinada',
  xg_baixo_combinado: 'média combinada',
  clean_sheets_altos: 'percentual por time',
  ambos_vazam: 'percentual por time',
  ataques_fracos: 'percentual por time',
  historico_over: 'contagem de jogos',
  historico_under: 'contagem de jogos',
};

const CASOS = CASOS_CAPTURADOS as unknown as CasoCapturado[];

describe('sem silenciador, e sem contradição — em jogos reais', () => {
  it('as três famílias estão cobertas por casos de produção', () => {
    const familias = new Set<string>();
    for (const c of CASOS) {
      if (c.origem !== 'producao') continue;
      for (const slug of Object.keys(c.veredito)) familias.add(FAMILIA[slug]);
    }

    expect([...familias].sort()).toEqual(['contagem de jogos', 'média combinada', 'percentual por time']);
  });

  it('em nenhum caso o número exibido contradiz o veredito do mart', () => {
    // O silenciador existia para tampar exatamente isto. Se ele voltasse a ser
    // necessário, este teste é quem diria — e a resposta seria consertar a
    // derivação, não esconder o número de novo.
    const contradicoes: string[] = [];
    for (const c of CASOS) {
      for (const [slug, doMart] of Object.entries(c.veredito)) {
        const p = prestacaoDaPremissa('goals_over_under', slug, c.jogos, 'home', c.linha);
        if (!p) continue;
        if (divergenciaDaPrestacao(p, doMart!)) {
          contradicoes.push(`${slug} · ${c.confronto} · linha ${c.linha} (${c.origem})`);
        }
      }
    }

    expect(contradicoes).toEqual([]);
  });
});
