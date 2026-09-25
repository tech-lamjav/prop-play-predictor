import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { usePerfilDeclarado } from '@/hooks/use-perfil-declarado';
import { marcarPesquisaPendente } from '@/hooks/use-pesquisa-pendente';
import { aberturaPara, deveAbrirAPesquisa, type RespostaDoPerfil } from '@/utils/perfil-declarado';
import { PesquisaDePerfilModal } from './PesquisaDePerfilModal';

/**
 * O sentinela da pesquisa de perfil.
 *
 * Spec na issue #522, ticket #523.
 *
 * Monta uma vez no App, dentro do roteador, ao lado dos outros sentinelas — não
 * desenha nada até ter o que perguntar. É assim porque a pesquisa é da PESSOA e
 * não de uma tela: prendê-la a uma página deixaria de fora quem entra por outra
 * porta, que é justamente a comparação entre campanhas que ela existe para
 * responder.
 *
 * Fiação, e só: a regra de quando abrir é pura e mora em
 * `@/utils/perfil-declarado`, o banco é do hook, e o desenho é do modal.
 */

/** Só adiou nesta sessão — a aba fechou, esquece. */
const CHAVE_DE_ADIAMENTO = 'sb_pesquisa_perfil_adiada';

/**
 * Atraso antes de abrir, para não estourar no primeiro paint.
 *
 * O mesmo motivo do cross-sell, e um pouco maior que o dos tours (700ms) de
 * propósito: a pesquisa precisa chegar por cima, e chegar antes só trocaria
 * quem atropela quem.
 */
const ATRASO_MS = 1200;

function jaAdiouNestaSessao(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_DE_ADIAMENTO) === '1';
  } catch {
    return false;
  }
}

function lembrarAdiamentoNestaSessao(): void {
  try {
    sessionStorage.setItem(CHAVE_DE_ADIAMENTO, '1');
  } catch {
    /* sessionStorage indisponível — a pergunta volta na próxima navegação, e
       isso é melhor do que derrubar a tela por causa de uma memória de sessão */
  }
}

export const PesquisaDePerfil: React.FC = () => {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const { carregando, respondeu, adiar, responder } = usePerfilDeclarado(user?.id);

  const [adiouNestaSessao, setAdiouNestaSessao] = useState(jaAdiouNestaSessao);
  const [aberto, setAberto] = useState(false);

  const temPessoa = !isLoading && !!user;
  const sabendo = temPessoa && !carregando;

  const deveAbrir =
    sabendo &&
    deveAbrirAPesquisa({
      logada: true,
      respondeu,
      adiouNestaSessao,
      pathname: location.pathname,
      search: location.search,
    });

  // O sinal que segura as dezesseis tours. Ele liga ANTES do atraso, e liga
  // também enquanto a leitura não voltou: sem isso um tour de 700ms começaria
  // debaixo de um pop-up de 1200ms, que é a colisão que este bloqueio existe
  // para impedir.
  const pendente = (temPessoa && carregando) || deveAbrir || aberto;
  useEffect(() => {
    marcarPesquisaPendente(pendente);
  }, [pendente]);

  // Sair da árvore não pode deixar o sinal ligado, ou nenhum tour voltaria a
  // armar pelo resto da vida da aba.
  useEffect(() => () => marcarPesquisaPendente(false), []);

  useEffect(() => {
    if (!deveAbrir) {
      setAberto(false);
      return;
    }
    const relogio = setTimeout(() => setAberto(true), ATRASO_MS);
    return () => clearTimeout(relogio);
  }, [deveAbrir]);

  const aoResponder = (resposta: RespostaDoPerfil) => {
    // `responder` marca a pessoa como respondida na hora, antes de a gravação
    // voltar — é isso que fecha o pop-up sem esperar a rede.
    void responder(resposta);
  };

  const aoPular = () => {
    lembrarAdiamentoNestaSessao();
    setAdiouNestaSessao(true);
    void adiar();
  };

  if (!sabendo) return null;

  return (
    <PesquisaDePerfilModal
      open={aberto}
      abertura={aberturaPara(user?.created_at)}
      onResponder={aoResponder}
      onPular={aoPular}
    />
  );
};
