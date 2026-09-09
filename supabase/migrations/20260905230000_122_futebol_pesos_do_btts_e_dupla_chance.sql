-- 20260905230000_122_futebol_pesos_do_btts_e_dupla_chance
--
-- Ambos marcam e Dupla chance deixam de estar "em revisão", e a ordem da
-- evidência passa a seguir o peso.
--
-- As duas famílias tinham `peso: null` no catálogo do front desde que foram
-- escritas, e isso disparava três textos que já eram falsos:
--
--   · o aviso "Mercado em revisão: hoje não gera aposta porque falta referência
--     de preço" — medido em produção em 05/09, o board tem 184 linhas de BTTS,
--     TODAS com preço, 103 delas publicáveis, e o maior Score médio de todos os
--     mercados (40,0). O da Dupla chance dizia "não alcança a régua": 121
--     linhas, 72 publicáveis, mesmo Score médio.
--   · o "Peso a calibrar" em cada premissa
--   · o "Mercado em revisão" no resumo do jogo
--
-- ⚠️ OS PESOS FORAM RECUPERADOS DO DADO, NÃO ESTIMADOS
--
-- No board de produção, uma linha com UMA premissa acesa e nenhuma penalidade
-- tem `pts_premissas` igual ao peso daquela premissa. As sete do BTTS e as
-- quatro da Dupla chance apareceram assim, e a soma confere com os tetos que o
-- Score já usava:
--
--     BTTS "sim"      12 + 8 + 8 + 6  = 34
--     BTTS "não"      12 + 10 + 6     = 28
--     Dupla chance    12 + 8 + 8 + 6  = 34
--
-- Se algum peso estivesse errado, a soma não fecharia com o teto.
--
-- O QUE MUDA NO BANCO
--
-- Só a ORDEM da evidência do BTTS, e ela importa: a DM do Telegram mostra o
-- PRIMEIRO item da lista. `defesa_forte` (12) e `ataque_trava` (10) sobem das
-- posições 4 e 5 para 2 e 3, e passam à frente de `ataque_dos_dois` (8) e
-- `defesas_vazaveis` (8). Antes a ordem era a de escrita, e a DM podia mostrar
-- a premissa de 8 tendo a de 12 acesa — o mesmo defeito que a #272 mediu em
-- 12.736 linhas do handicap.
--
-- A Dupla chance não muda de ordem: os pesos coincidiram com a ordem escrita.
--
-- A semente foi GERADA do catálogo (`copyDeServing()`), não transcrita à mão.
--
-- Conferência depois de aplicar:
--   select slug, ordem, texto from public.futebol_premissa_copy
--    where market = 'btts' and tipo = 'evidencia' order by ordem;
--   -- espera defesa_forte em 2 e ataque_trava em 3

delete from public.futebol_premissa_copy;

insert into public.futebol_premissa_copy (tipo, market, slug, mando, ordem, texto) values
  ('evidencia', 'goals_over_under', 'defesas_firmes', 'any', 1, 'Defesas firmes dos dois lados'),
  ('evidencia', 'goals_over_under', 'defesas_vazaveis', 'any', 2, 'Defesas frágeis dos dois lados'),
  ('evidencia', 'goals_over_under', 'ataque_combinado', 'any', 3, 'Os dois somam muitos gols'),
  ('evidencia', 'goals_over_under', 'xg_baixo_combinado', 'any', 4, 'Os dois criam pouca chance de gol'),
  ('evidencia', 'goals_over_under', 'xg_combinado_alto', 'any', 5, 'Os dois criam muita chance de gol'),
  ('evidencia', 'goals_over_under', 'clean_sheets_altos', 'any', 6, 'Os dois passam muitos jogos sem sofrer gol'),
  ('evidencia', 'goals_over_under', 'ataques_fracos', 'any', 7, 'Ataque fraco em pelo menos um lado'),
  ('evidencia', 'goals_over_under', 'historico_under', 'any', 8, 'Histórico de jogo com poucos gols'),
  ('evidencia', 'goals_over_under', 'ambos_vazam', 'any', 9, 'Os dois sofrem gol quase todo jogo'),
  ('evidencia', 'goals_over_under', 'ritmo_alto', 'any', 10, 'Jogo de ritmo alto'),
  ('evidencia', 'goals_over_under', 'historico_over', 'any', 11, 'Histórico de jogo com muitos gols'),
  ('contra', 'goals_over_under', 'defesas_firmes', 'any', 1, 'A solidez das defesas não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'ataque_combinado', 'any', 2, 'O ataque dos dois times não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'xg_baixo_combinado', 'any', 3, 'O baixo volume de chances não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'xg_combinado_alto', 'any', 4, 'O alto volume de chances não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'clean_sheets_altos', 'any', 5, 'Os jogos sem sofrer gol não entraram como sinal a favor'),
  ('contra', 'goals_over_under', 'ritmo_alto', 'any', 6, 'O ritmo do jogo não entrou como sinal a favor'),
  ('aviso', 'goals_over_under', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'goals_over_under', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'goals_over_under', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'goals_over_under', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'goals_over_under', 'linha_extrema', 'any', 5, 'Linha muito longe do normal'),
  ('evidencia', 'match_winner', 'forma', 'any', 1, 'Em boa fase, vem ganhando'),
  ('evidencia', 'match_winner', 'mando', 'any', 2, 'O mando pesa neste jogo'),
  ('evidencia', 'match_winner', 'mando', 'home', 2, 'Manda bem em casa'),
  ('evidencia', 'match_winner', 'mando', 'away', 2, 'Vai bem fora de casa'),
  ('evidencia', 'match_winner', 'superioridade_tabela', 'any', 3, 'Bem à frente na tabela'),
  ('evidencia', 'match_winner', 'forca_mismatch', 'any', 4, 'Ataque forte contra defesa frágil do adversário'),
  ('evidencia', 'match_winner', 'superioridade_xg', 'any', 5, 'Cria mais chances de gol que o adversário'),
  ('evidencia', 'match_winner', 'h2h_favoravel', 'any', 6, 'Leva vantagem no histórico do confronto'),
  ('evidencia', 'match_winner', 'desfalque_adversario', 'any', 7, 'Adversário com desfalque de titular importante'),
  ('contra', 'match_winner', 'mando', 'home', 1, 'Em casa, o desempenho não entrou como sinal a favor'),
  ('contra', 'match_winner', 'mando', 'away', 1, 'Fora de casa, o desempenho não entrou como sinal a favor'),
  ('contra', 'match_winner', 'superioridade_tabela', 'any', 2, 'A posição na tabela não entrou como sinal a favor'),
  ('contra', 'match_winner', 'forca_mismatch', 'any', 3, 'O duelo entre ataque e defesa não entrou como sinal a favor'),
  ('aviso', 'match_winner', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'match_winner', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'match_winner', 'desfalque_proprio', 'any', 3, 'Time apostado com desfalque de titular importante'),
  ('aviso', 'match_winner', 'pen_poucas_casas', 'any', 4, 'Poucas casas cotando esse mercado'),
  ('aviso', 'match_winner', 'pen_odd_juice', 'any', 5, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'match_winner', 'pick_empate', 'any', 6, 'Empate é o resultado mais difícil de prever'),
  ('evidencia', 'asian_handicap', 'tende_golear', 'any', 1, 'Costuma ganhar por muitos gols'),
  ('evidencia', 'asian_handicap', 'supremacia', 'any', 2, 'Muito superior ao adversário'),
  ('evidencia', 'asian_handicap', 'defesa_fora_solida', 'any', 3, 'Defesa sólida jogando fora'),
  ('evidencia', 'asian_handicap', 'defesa_fora_solida', 'home', 3, 'Defesa sólida em casa'),
  ('evidencia', 'asian_handicap', 'sem_rodizio', 'any', 4, 'Deve entrar com força máxima'),
  ('evidencia', 'asian_handicap', 'raramente_perde_por_2', 'any', 5, 'Quando perde, perde apertado'),
  ('evidencia', 'asian_handicap', 'adversario_fragil_fora', 'any', 6, 'Adversário fraco fora de casa'),
  ('evidencia', 'asian_handicap', 'adversario_fragil_fora', 'away', 6, 'Adversário fraco em casa'),
  ('evidencia', 'asian_handicap', 'mando_forte', 'any', 7, 'Manda muito bem em casa'),
  ('evidencia', 'asian_handicap', 'mando_forte', 'away', 7, 'Vai muito bem fora de casa'),
  ('contra', 'asian_handicap', 'tende_golear', 'any', 1, 'A margem das vitórias não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'supremacia', 'any', 2, 'A superioridade sobre o adversário não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'defesa_fora_solida', 'any', 3, 'A solidez defensiva não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'defesa_fora_solida', 'home', 3, 'Em casa, a solidez defensiva não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'raramente_perde_por_2', 'any', 4, 'A margem das derrotas não entrou como sinal a favor'),
  ('aviso', 'asian_handicap', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'asian_handicap', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'asian_handicap', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'asian_handicap', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'asian_handicap', 'handicap_alto', 'any', 5, 'Handicap muito alto'),
  ('evidencia', 'btts', 'ambos_marcam', 'any', 1, 'Os dois costumam marcar'),
  ('evidencia', 'btts', 'defesa_forte', 'any', 2, 'Defesa forte de um dos lados'),
  ('evidencia', 'btts', 'ataque_trava', 'any', 3, 'Um dos ataques costuma passar em branco'),
  ('evidencia', 'btts', 'ataque_dos_dois', 'any', 4, 'Os dois atacam bem'),
  ('evidencia', 'btts', 'defesas_vazaveis', 'any', 5, 'Defesas frágeis dos dois lados'),
  ('evidencia', 'btts', 'historico_btts', 'any', 6, 'Nos últimos jogos, os dois marcaram'),
  ('evidencia', 'btts', 'historico_seco', 'any', 7, 'Jogos recentes sem os dois marcarem'),
  ('contra', 'btts', 'ambos_marcam', 'any', 1, 'Os gols dos dois times não entraram como sinal a favor'),
  ('contra', 'btts', 'defesa_forte', 'any', 2, 'A força defensiva não entrou como sinal a favor'),
  ('contra', 'btts', 'ataque_trava', 'any', 3, 'A limitação ofensiva não entrou como sinal a favor'),
  ('contra', 'btts', 'defesas_vazaveis', 'any', 4, 'A fragilidade das defesas não entrou como sinal a favor'),
  ('aviso', 'btts', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'btts', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'btts', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'btts', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('evidencia', 'double_chance', 'lado_coberto_forte', 'any', 1, 'O lado coberto é forte'),
  ('evidencia', 'double_chance', 'equilibrio_defensivo', 'any', 2, 'Equilíbrio defensivo'),
  ('evidencia', 'double_chance', 'adversario_limitado', 'any', 3, 'Adversário com campanha fraca'),
  ('evidencia', 'double_chance', 'invicto_recente', 'any', 4, 'Invicto nos últimos jogos'),
  ('contra', 'double_chance', 'lado_coberto_forte', 'any', 1, 'A força do lado coberto não entrou como sinal a favor'),
  ('contra', 'double_chance', 'adversario_limitado', 'any', 2, 'A campanha do adversário não entrou como sinal a favor'),
  ('aviso', 'double_chance', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'double_chance', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'double_chance', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'double_chance', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco');
