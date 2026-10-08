import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { MoedaContexto } from '@/config/moeda-contexto';
import { definirMoedaAtiva, guardarMoeda, moedaAtiva, moedaEscolhida } from '@/utils/moeda-ativa';

/**
 * Em que moeda a pessoa lê o próprio dinheiro.
 *
 * ⚠️ POR QUE UM CONTEXTO, E NÃO SÓ O ESTADO DE MÓDULO. `fmtDinheiroDaPessoa` lê
 * o estado de módulo, que é invisível ao React: trocar a moeda não agenda
 * repintura nenhuma. O contexto dá o empurrão — quem troca muda um estado de
 * React, e quem ASSINOU com `useMoeda()` repinta.
 *
 * ⚠️ NÃO REMONTA A ÁRVORE. A primeira versão punha um `key={moeda}` em volta das
 * rotas, e a troca de moeda remontava tudo — inclusive o modal em que a moeda é
 * escolhida, que fechava e perdia o que a pessoa tinha digitado. Agora só quem
 * desenha dinheiro da pessoa repinta, e o resto da tela fica onde estava.
 *
 * ⚠️ E NÃO HÁ CONVERSÃO. Trocar a moeda troca símbolo e pontuação, nunca o
 * número. Ver `config/moedas.ts`.
 */
export function MoedaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // O inicializador roda antes da primeira pintura: sem isto, a primeira tela
  // sairia em real e trocaria na frente da pessoa.
  const [moeda, setMoeda] = useState(() => {
    definirMoedaAtiva(moedaEscolhida(null));
    return moedaAtiva();
  });

  // A sessão chega depois do primeiro desenho. Quando ela traz o país informado
  // no cadastro, a moeda é recalculada — e só mexe no estado se tiver MUDADO.
  useEffect(() => {
    const informado = (user?.user_metadata?.country as string | undefined) ?? null;
    const resolvida = moedaEscolhida(informado);
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

  return <MoedaContexto.Provider value={valor}>{children}</MoedaContexto.Provider>;
}
