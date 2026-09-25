import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { usePerfilDeclarado } from '@/hooks/use-perfil-declarado';
import { marcarPesquisaPendente } from '@/hooks/use-pesquisa-pendente';
import {
  perfilDeclaradoDaPessoa,
  pesquisaDePerfilAdiada,
  pesquisaDePerfilExibida,
  pesquisaDePerfilRespondida,
} from '@/lib/analytics';
import {
  aberturaPara,
  deveAbrirAPesquisa,
  voltandoDeUmPagamento,
  type RespostaDoPerfil,
} from '@/utils/perfil-declarado';
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
 * Voltou de um pagamento nesta sessão.
 *
 * Precisa de memória própria porque **o endereço esquece antes de a pesquisa
 * abrir**: a tela do bolão reescreve a URL sem `success=true` assim que mostra
 * a boas-vindas premium, e o pop-up só abre 1200ms depois. Sem isto, a pesquisa
 * subiria em cima da conclusão do pagamento — que é a única interrupção que
 * custa dinheiro.
 */
const CHAVE_DE_PAGAMENTO = 'sb_pesquisa_perfil_pos_pagamento';

/**
 * Atraso antes de abrir, para não estourar no primeiro paint.
 *
 * O mesmo motivo do cross-sell, e um pouco maior que o dos tours (700ms) de
 * propósito: a pesquisa precisa chegar por cima, e chegar antes só trocaria
 * quem atropela quem.
 */
const ATRASO_MS = 1200;

function marcado(chave: string): boolean {
  try {
    return sessionStorage.getItem(chave) === '1';
  } catch {
    return false;
  }
}

function marcar(chave: string): void {
  try {
    sessionStorage.setItem(chave, '1');
  } catch {
    /* sessionStorage indisponível — a pergunta volta na próxima navegação, e
       isso é melhor do que derrubar a tela por causa de uma memória de sessão */
  }
}

export const PesquisaDePerfil: React.FC = () => {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const { carregando, respondeu, leituraFalhou, adiamentos, adiar, responder } = usePerfilDeclarado(
    user?.id,
  );

  const [adiouNestaSessao, setAdiouNestaSessao] = useState(() => marcado(CHAVE_DE_ADIAMENTO));
  const [aberto, setAberto] = useState(false);

  const temPessoa = !isLoading && !!user;

  // O pagamento é visto uma vez, na chegada, e lembrado pelo resto da sessão —
  // o endereço perde a query antes de o pop-up abrir.
  const [pagamentoNestaSessao, setPagamentoNestaSessao] = useState(() =>
    marcado(CHAVE_DE_PAGAMENTO),
  );
  useEffect(() => {
    if (!voltandoDeUmPagamento(location.search)) return;
    marcar(CHAVE_DE_PAGAMENTO);
    setPagamentoNestaSessao(true);
  }, [location.search]);

  const deveAbrir =
    !carregando &&
    deveAbrirAPesquisa({
      logada: temPessoa,
      // Falha de leitura cala a pesquisa como se já tivesse sido respondida,
      // mas as duas coisas chegam separadas do hook de propósito: uma é saber
      // que não, a outra é não saber.
      respondeu: respondeu || leituraFalhou,
      adiouNestaSessao,
      pagamentoNestaSessao,
      pathname: location.pathname,
      search: location.search,
    });

  // O sinal que segura os dezessete tours. Ele liga ANTES do atraso, e liga
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

  const abertura = aberturaPara(user?.created_at);

  useEffect(() => {
    if (!deveAbrir) {
      setAberto(false);
      return;
    }
    const relogio = setTimeout(() => {
      setAberto(true);
      // O evento sai JUNTO com a caixa aparecendo, e não quando o sentinela
      // decide abrir: entre as duas coisas há 1200ms em que a pessoa pode ter
      // trocado de tela, e contar essas seria inflar o denominador da taxa de
      // resposta com gente que nunca viu a pergunta.
      pesquisaDePerfilExibida({ audience: abertura });
    }, ATRASO_MS);
    return () => clearTimeout(relogio);
  }, [deveAbrir, abertura]);

  const aoResponder = (resposta: RespostaDoPerfil) => {
    pesquisaDePerfilRespondida({
      goal: resposta.objetivo,
      betting_frequency: resposta.frequencia,
      audience: abertura,
      deferrals: adiamentos,
    });
    // A resposta também vira traço da pessoa. É o que permite segmentar por
    // perfil funis que já existiam antes de ela responder — e é a única ponte
    // com campanha, porque o banco não guarda origem nenhuma.
    perfilDeclaradoDaPessoa({ goal: resposta.objetivo, betting_frequency: resposta.frequencia });
    // `responder` marca a pessoa como respondida na hora, antes de a gravação
    // voltar — é isso que fecha o pop-up sem esperar a rede.
    void responder(resposta);
  };

  const aoPular = () => {
    marcar(CHAVE_DE_ADIAMENTO);
    setAdiouNestaSessao(true);
    // A contagem relatada é a de DEPOIS deste adiamento, igual à que vai para o
    // banco: as duas precisam contar a mesma coisa para poderem ser comparadas.
    pesquisaDePerfilAdiada({ audience: abertura, deferrals: adiamentos + 1 });
    void adiar();
  };

  if (!temPessoa || carregando) return null;

  return (
    <PesquisaDePerfilModal
      open={aberto}
      abertura={abertura}
      onResponder={aoResponder}
      onPular={aoPular}
    />
  );
};
