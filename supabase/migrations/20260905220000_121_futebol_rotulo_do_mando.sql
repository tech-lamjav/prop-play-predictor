-- 20260905220000_121_futebol_rotulo_do_mando
--
-- "Mando" sai dos rótulos, e "Mando relevante" vira "O mando pesa neste jogo".
--
-- O rótulo negativo do 1X2 dizia "Em casa, o mando não entrou como sinal a
-- favor". "Mando" é vocabulário nosso: quem lê espera ver do que se fala, não o
-- nome técnico do conceito. O positivo já evitava a palavra — "Manda bem em
-- casa" usa o verbo, que é português corrente — e só o negativo carregava o
-- substantivo.
--
-- O sujeito passa a ser a coisa medida: "Em casa, o DESEMPENHO não entrou como
-- sinal a favor". Vale igual para a `mando_forte` do Handicap, que tem o mesmo
-- texto.
--
-- E "Mando relevante", que aparece no empate, não dizia nada a ninguém.
--
-- ⚠️ O que deliberadamente NÃO se fez: escrever "Não vai bem em casa". A aba do
-- que não atingiu o corte não afirma oposição, por decisão da #351 — estas
-- premissas são ausência de sinal, não sinal contrário. Só o SUJEITO da frase
-- muda; a construção fica.
--
-- Ressemeia a tabela inteira pelo mesmo motivo da 120: a guarda de paridade
-- compara a lista completa e na mesma ordem, então uma migration parcial não
-- serviria. O texto abaixo é o da 120 com quatro linhas diferentes.
--
-- Conferência depois de aplicar:
--   select texto from public.futebol_premissa_copy
--    where slug in ('mando', 'mando_forte') order by tipo, mando;
--   -- nenhuma linha deve conter "o mando não entrou"

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
  ('evidencia', 'btts', 'ataque_dos_dois', 'any', 2, 'Os dois atacam bem'),
  ('evidencia', 'btts', 'defesas_vazaveis', 'any', 3, 'Defesas frágeis dos dois lados'),
  ('evidencia', 'btts', 'defesa_forte', 'any', 4, 'Defesa forte de um dos lados'),
  ('evidencia', 'btts', 'ataque_trava', 'any', 5, 'Um dos ataques costuma passar em branco'),
  ('evidencia', 'btts', 'historico_btts', 'any', 6, 'Nos últimos jogos, os dois marcaram'),
  ('evidencia', 'btts', 'historico_seco', 'any', 7, 'Jogos recentes sem os dois marcarem'),
  ('contra', 'btts', 'ambos_marcam', 'any', 1, 'Os gols dos dois times não entraram como sinal a favor'),
  ('contra', 'btts', 'defesas_vazaveis', 'any', 2, 'A fragilidade das defesas não entrou como sinal a favor'),
  ('contra', 'btts', 'defesa_forte', 'any', 3, 'A força defensiva não entrou como sinal a favor'),
  ('contra', 'btts', 'ataque_trava', 'any', 4, 'A limitação ofensiva não entrou como sinal a favor'),
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
