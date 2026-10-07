import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { definirMoedaAtiva, guardarMoeda, moedaAtiva, moedaEscolhida } from '@/utils/moeda-ativa';

/**
 * Em que moeda a pessoa lê o próprio dinheiro.
 *
 * ⚠️ POR QUE UM CONTEXTO, E NÃO SÓ O ESTADO DE MÓDULO. `fmtDinheiro` lê o
 * estado de módulo, que é invisível ao React: trocar a moeda não invalida
 * memo nenhum nem agenda repintura, e a tela continuaria em reais até alguém
 * mexer em outra coisa. É a mesma armadilha que já mordeu o idioma ativo, e
 * está escrita lá.
 *
 * O contexto existe para dar o empurrão: quem troca a moeda muda um estado de
 * React, e quem desenha dinheiro repinta. Ver o `key` em `App.tsx`.
 *
 * ⚠️ E NÃO HÁ CONVERSÃO. Trocar a moeda troca símbolo e pontuação, nunca o
 * número. Ver `config/moedas.ts`.
 */

interface Contexto {
  moeda: string;
  trocarMoeda: (moeda: string) => void;
}

const MoedaContexto = createContext<Contexto | null>(null);

export function MoedaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // O inicializador roda antes da primeira pintura: sem isto, a primeira tela
  // sairia em real e trocaria na frente da pessoa.
  const [moeda, setMoeda] = useState(() => {
    const inicial = moedaEscolhida(null);
    definirMoedaAtiva(inicial);
    return moedaAtiva();
  });

  // A sessão chega depois do primeiro desenho. Quando ela traz o país do
  // cadastro, a moeda é recalculada — e só mexe no estado se tiver MUDADO, para
  // não repintar a árvore à toa em toda visita.
  useEffect(() => {
    const doCadastro = (user?.user_metadata?.country as string | undefined) ?? null;
    const resolvida = moedaEscolhida(doCadastro);
    if (resolvida === moedaAtiva()) return;
    definirMoedaAtiva(resolvida);
    setMoeda(moedaAtiva());
  }, [user]);

  const trocarMoeda = useCallback((nova: string) => {
    guardarMoeda(nova);
    definirMoedaAtiva(nova);
    setMoeda(moedaAtiva());
  }, []);

  const valor = useMemo(() => ({ moeda, trocarMoeda }), [moeda, trocarMoeda]);

  // ⚠️ O `key` É O EMPURRÃO, e não enfeite. `fmtDinheiro` lê estado de módulo,
  // que o React não enxerga: sem remontar, o dinheiro já desenhado continuaria
  // com o símbolo antigo até alguém mexer em outra coisa. Trocar de moeda é
  // ação rara e explícita, então o custo de remontar a árvore é aceitável — e
  // é bem menor que mostrar dois símbolos na mesma tela.
  return (
    <MoedaContexto.Provider value={valor}>
      <Fragment key={moeda}>{children}</Fragment>
    </MoedaContexto.Provider>
  );
}

export function useMoeda(): Contexto {
  const ctx = useContext(MoedaContexto);
  if (!ctx) {
    // Fora do provider — em teste de componente isolado, por exemplo. Ler a
    // moeda ativa continua funcionando; trocar não tem a quem avisar.
    return { moeda: moedaAtiva(), trocarMoeda: definirMoedaAtiva };
  }
  return ctx;
}
