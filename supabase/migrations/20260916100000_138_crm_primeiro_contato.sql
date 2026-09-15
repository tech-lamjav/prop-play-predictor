-- 20260916100000_138_crm_primeiro_contato
--
-- `contatado` passa a se chamar `primeiro_contato`, e "em teste" sai do funil.
--
-- As duas mudanças vêm da mesma conversa. Olhando a tela em produção, o Victor
-- perguntou por que o seletor da ficha tinha seis opções e a faixa do funil
-- tinha oito, e se não estávamos misturando duas coisas. Estávamos.
--
-- ⚠️ O DESENHO QUE ELE FECHOU
--
--   Novo → Primeiro contato → Nutrindo → Boletada → Interesse → Assinante
--                                                            ↘ Sem resposta
--
-- "Assinante" É o destino do funil, e continua sendo o banco quem responde:
-- ninguém arrasta alguém para lá, a pessoa chega pagando.
--
-- "Em teste" SAI do funil e vira etiqueta da pessoa. Ele nunca foi etapa de
-- conversa — é um fato do produto, e estar em teste não diz nada sobre até onde
-- a conversa chegou. Pior: como a posição calculada vencia a etapa manual na
-- tela, as pessoas em teste apareciam como "Em teste" e a etapa delas ficava
-- invisível. Quem está em teste é o lead mais quente que existe, e era
-- justamente nele que a conversa se perdia. Por isso o efeito prático desta
-- migration é que os 59 em teste voltam a mostrar a etapa que têm.
--
-- Só o RÓTULO de `contatado` mudou de ideia, não o significado: "contatado" não
-- diz se foi a primeira vez ou a quinta, e o funil precisa do primeiro toque
-- como marco. Renomeio o valor no banco em vez de só traduzir na tela, porque
-- tela e código falando línguas diferentes é o que o glossário existe para
-- impedir.
--
-- Conferência depois de aplicar:
--   select etapa, count(*) from public.crm_etapa group by 1 order by 2 desc;

-- Primeiro os dados, depois a restrição: o caminho contrário derruba a
-- migration na primeira linha que ainda estiver no valor velho.
alter table public.crm_etapa drop constraint if exists crm_etapa_etapa_check;

update public.crm_etapa
   set etapa = 'primeiro_contato'
 where etapa = 'contatado';

alter table public.crm_etapa
  add constraint crm_etapa_etapa_check
  check (
    etapa in (
      'novo',
      'primeiro_contato',
      'nutrindo',
      'boletada',
      'interesse',
      'sem_resposta'
    )
  );

comment on column public.crm_etapa.etapa is
  'Etapa manual da conversa, de novo a interesse, com sem_resposta como saida. Assinante NAO e etapa: o banco responde. Em teste tambem nao: e etiqueta da pessoa.';

-- ── A linha do tempo não é reescrita ────────────────────────────────────────
-- `crm_etapa_evento` guarda `de` e `para` como texto solto, sem restrição, e
-- continua assim. Um evento que diz "moveu para contatado" segue verdadeiro
-- depois do rename: ele registra o que aconteceu, com o nome que a etapa tinha
-- naquele dia. Reescrever o passado para caber no vocabulário de hoje é o
-- oposto de append-only, e é o que faria a linha do tempo mentir sobre si.
