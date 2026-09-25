import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/integrations/supabase/client';
import type { RespostaDoPerfil } from '@/utils/perfil-declarado';

/**
 * A linha de `perfil_declarado` da pessoa logada, e as duas escritas.
 *
 * Spec na issue #522, ticket #523.
 *
 * A regra de QUANDO perguntar não mora aqui — ela é pura e vive em
 * `@/utils/perfil-declarado`. Este hook é só o adaptador: vai ao banco buscar o
 * estado que a regra precisa, e grava o que a pessoa fez.
 *
 * Por que o banco e não o `localStorage` dos tours: a pesquisa volta a cada
 * sessão até ser respondida, e com memória por navegador quem trocasse de
 * celular seria perguntada para sempre. "Já respondeu" vale para a PESSOA.
 */

interface LinhaDoPerfil {
  respondido_em: string | null;
  adiamentos: number;
}

export interface PerfilDeclarado {
  /** Ainda não se sabe se deve perguntar. Enquanto isto for verdade, nada abre. */
  carregando: boolean;
  /** Já respondeu alguma vez. Enquanto for falso, a pesquisa está pendente. */
  respondeu: boolean;
  /** Apertou Pular: soma um à contagem e segue. */
  adiar: () => Promise<void>;
  /** Respondeu: grava as duas escolhas com o carimbo. */
  responder: (resposta: RespostaDoPerfil) => Promise<void>;
}

export function usePerfilDeclarado(userId: string | undefined): PerfilDeclarado {
  const [carregando, setCarregando] = useState(true);
  const [respondeu, setRespondeu] = useState(false);
  const [adiamentos, setAdiamentos] = useState(0);

  useEffect(() => {
    let vivo = true;

    const ler = async () => {
      if (!userId) {
        // Sem ninguém logado não há a quem perguntar, e não há o que consultar.
        if (vivo) {
          setRespondeu(false);
          setAdiamentos(0);
          setCarregando(false);
        }
        return;
      }

      const { data, error } = await createClient()
        .from('perfil_declarado')
        .select('respondido_em, adiamentos')
        .eq('user_id', userId)
        .maybeSingle();

      if (!vivo) return;

      if (error) {
        // Leitura que falha CALA a pesquisa, em vez de insistir. Perguntar de
        // novo a quem já respondeu é pior do que deixar de perguntar a quem não
        // respondeu: o primeiro é atrito em cima de quem já colaborou, e o
        // segundo volta sozinho na sessão seguinte.
        setRespondeu(true);
        setCarregando(false);
        return;
      }

      // Sem linha = nunca respondeu e nunca adiou. A ausência é o estado
      // inicial, pelo mesmo motivo que `crm_etapa` registra na migration dela.
      const linha = (data ?? null) as LinhaDoPerfil | null;
      setRespondeu(!!linha?.respondido_em);
      setAdiamentos(linha?.adiamentos ?? 0);
      setCarregando(false);
    };

    setCarregando(true);
    void ler();

    return () => {
      vivo = false;
    };
  }, [userId]);

  const adiar = useCallback(async () => {
    if (!userId) return;
    const proximo = adiamentos + 1;
    setAdiamentos(proximo);
    // Sem try/catch em volta do await: o cliente devolve o erro em `error` em
    // vez de lançar. O retorno é ignorado de propósito — não conseguir contar
    // um adiamento não é motivo para segurar ninguém na porta.
    await createClient()
      .from('perfil_declarado')
      .upsert({ user_id: userId, adiamentos: proximo, atualizado_em: new Date().toISOString() });
  }, [adiamentos, userId]);

  const responder = useCallback(
    async (resposta: RespostaDoPerfil) => {
      // A pessoa para de ser perguntada AGORA, antes de a gravação voltar. Se
      // ela falhar, "já respondeu" continua falso no banco e a pergunta volta na
      // próxima sessão — a falha se conserta sozinha, e ninguém fica preso no
      // pop-up enquanto isso.
      setRespondeu(true);
      if (!userId) return;

      const agora = new Date().toISOString();
      await createClient().from('perfil_declarado').upsert({
        user_id: userId,
        objetivo: resposta.objetivo,
        frequencia: resposta.frequencia,
        respondido_em: agora,
        atualizado_em: agora,
      });
    },
    [userId],
  );

  return { carregando, respondeu, adiar, responder };
}
