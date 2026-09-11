-- 20260911200000_128_crm_etapas_da_venda
--
-- As etapas passam a descrever a venda da Smart Betting.
--
-- As seis da migration 123 vieram de manual de CRM — novo, contatado,
-- conversando, proposta, assinou, sem resposta. O Victor já tinha desenhado um
-- funil de verdade no CRM antigo (repositório `crm-smart`, migration 012), e
-- ele diz coisas que as genéricas não dizem: NUTRINDO é mandar conteúdo sem
-- pedir nada, e BOLETADA é ter mandado um bilhete para o lead. Essas duas são
-- o que o processo tem de próprio.
--
-- ⚠️ O QUE SAIU, E POR QUÊ
-- "Trial ativo" e "convertido" eram etapas que alguém arrastava lá. Aqui não
-- podem ser: todo lead do painel JÁ TEM CADASTRO no produto, então o banco
-- responde as duas sozinho — `futebol_trial_started_at` e os três acessos
-- premium. Etapa manual para o que o banco sabe é dado que nasce desatualizado:
-- alguém esquece de mover quando a assinatura cai, e a tela passa a mentir.
--
-- "Dia 1" e "Dia 2" também saíram: são cadência de tempo, não etapa. O painel
-- já mostra há quantos dias o lead está parado, que é a mesma informação sem
-- exigir que alguém mova a ficha todo dia.
--
-- "FUP Conversão" e "FUP Promoção" viraram uma só: as duas são cobrança, e a
-- diferença entre elas cabe numa anotação da linha do tempo.
--
-- Conferência depois de aplicar:
--   select distinct etapa from public.crm_etapa;

-- ── As etapas antigas viram as novas ────────────────────────────────────────
-- Primeiro os dados, depois a restrição: o caminho contrário derruba a
-- migration na primeira linha que ainda estiver no valor velho.
--
-- `conversando` e `proposta` viram `interesse`, que é onde as duas moravam de
-- verdade. `assinou` também: quem assinou continua aparecendo como assinante,
-- agora pelo acesso premium, e a etapa manual guarda só até onde a CONVERSA
-- tinha chegado.
alter table public.crm_etapa drop constraint if exists crm_etapa_etapa_check;

update public.crm_etapa
   set etapa = 'interesse'
 where etapa in ('conversando', 'proposta', 'assinou');

alter table public.crm_etapa
  add constraint crm_etapa_etapa_check
  check (etapa in ('novo', 'contatado', 'nutrindo', 'boletada', 'interesse', 'sem_resposta'));

comment on column public.crm_etapa.etapa is
  'Etapa manual da conversa. Assinante e em teste NAO sao etapas: o banco responde as duas.';

-- ── A linha do tempo não é reescrita ────────────────────────────────────────
-- `crm_etapa_evento` guarda `de` e `para` como texto solto, sem restrição, e
-- continua assim de propósito: ela registra o que aconteceu, e um evento que
-- diz "moveu para proposta" continua verdadeiro mesmo depois de a etapa deixar
-- de existir. Reescrever o passado para caber no vocabulário de hoje é o
-- oposto de append-only.
