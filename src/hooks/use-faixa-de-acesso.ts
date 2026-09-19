import { useEffect, useState } from 'react';
import { faixaDeAcessoAparece } from '@/utils/futebol-bloqueio';
import { ACESSO_ANONIMO, type FutebolAccess } from '@/services/futebol-data.service';

const CHAVE = 'futebol:faixa-de-acesso';

/**
 * Esquece o que sabíamos sobre esta pessoa. Chamado ao sair da conta.
 *
 * É o que torna verdadeira a invariante de que este arquivo depende: sem
 * resposta guardada, também não há sessão guardada. Sem isto, o navegador de um
 * ex-assinante seguia dizendo "esconde" depois do logout, e o deslogado — que
 * DEVE ver o convite — voltava a receber a faixa empurrando a página, que é o
 * defeito que este arquivo existe para consertar.
 */
export function esquecerFaixaDeAcesso() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // Armazenamento bloqueado: não havia o que esquecer.
  }
}

function leu(): boolean | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'mostra' ? true : v === 'esconde' ? false : null;
  } catch {
    // Aba anônima, armazenamento bloqueado: seguimos sem memória.
    return null;
  }
}

/**
 * Decide, JÁ NA PRIMEIRA PINTURA, se a faixa de acesso vai ocupar espaço.
 *
 * O problema que isto resolve é de layout, não de dados. A faixa nascia depois
 * que o `get_futebol_access` respondia, e ao nascer empurrava o raio-x, o
 * destaque e os cartões para baixo — medimos 0,060 de CLS só nela. Esperar a
 * sessão do navegador em vez da resposta do banco melhorou, mas não resolveu:
 * ainda são ~460ms entre a página pintar e a sessão resolver, e o empurrão
 * acontecia dentro dessa janela.
 *
 * A saída é não perguntar. A resposta de ontem fica guardada, e a de hoje é
 * quase sempre igual: quem é assinante continua assinante, quem estava
 * deslogado continua deslogado.
 *
 * E quando NÃO há resposta guardada, também não há sessão guardada — as duas
 * moram no mesmo armazenamento. Então "sem memória" não é um chute: é a
 * definição de visitante anônimo, que é exatamente quem deve ver o convite.
 * O único caso que ainda pisca é o assinante na primeira visita depois deste
 * deploy, uma vez por navegador.
 */
export function useFaixaDeAcesso(access: FutebolAccess | undefined): FutebolAccess | undefined {
  // Lido UMA vez, na montagem. Se o efeito abaixo reescrevesse a memória e a
  // leitura acompanhasse, a faixa poderia sumir no meio da visita — que é o
  // empurrão que viemos consertar, ao contrário.
  const [lembrado] = useState(leu);

  useEffect(() => {
    if (!access) return;
    // A regra de quem vê a faixa mora no componente dela, e é de lá que esta
    // memória vem: guardar uma decisão própria seria guardar uma resposta que
    // a tela não dá mais no dia em que a regra mudar.
    try {
      localStorage.setItem(CHAVE, faixaDeAcessoAparece(access) ? 'mostra' : 'esconde');
    } catch {
      // Sem memória a tela continua correta, só volta a piscar.
    }
  }, [access]);

  if (access) return access;
  return lembrado === false ? undefined : ACESSO_ANONIMO;
}
