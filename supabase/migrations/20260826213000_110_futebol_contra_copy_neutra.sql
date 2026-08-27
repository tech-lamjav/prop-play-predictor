-- 20260826213000_110_futebol_contra_copy_neutra
-- Uma flag apagada diz apenas que a premissa não atingiu a régua para apoiar a
-- saída. Ela não prova que o fato oposto aconteceu. Mantém a copy de serving
-- alinhada ao catálogo da tela para que DM e Bancada não façam afirmações falsas.

update public.futebol_premissa_copy
set texto = case
  when market = 'goals_over_under' and slug = 'defesas_firmes' then 'A solidez das defesas não entrou como sinal a favor'
  when market = 'goals_over_under' and slug = 'ataque_combinado' then 'O ataque dos dois times não entrou como sinal a favor'
  when market = 'goals_over_under' and slug = 'xg_baixo_combinado' then 'O baixo volume de chances não entrou como sinal a favor'
  when market = 'goals_over_under' and slug = 'xg_combinado_alto' then 'O alto volume de chances não entrou como sinal a favor'
  when market = 'goals_over_under' and slug = 'clean_sheets_altos' then 'Os jogos sem sofrer gol não entraram como sinal a favor'
  when market = 'goals_over_under' and slug = 'ritmo_alto' then 'O ritmo do jogo não entrou como sinal a favor'
  when market = 'match_winner' and slug = 'mando' and mando = 'home' then 'Em casa, o mando não entrou como sinal a favor'
  when market = 'match_winner' and slug = 'mando' and mando = 'away' then 'Fora de casa, o mando não entrou como sinal a favor'
  when market = 'match_winner' and slug = 'superioridade_tabela' then 'A posição na tabela não entrou como sinal a favor'
  when market = 'match_winner' and slug = 'forca_mismatch' then 'O duelo entre ataque e defesa não entrou como sinal a favor'
  when market = 'asian_handicap' and slug = 'tende_golear' then 'A margem das vitórias não entrou como sinal a favor'
  when market = 'asian_handicap' and slug = 'supremacia' then 'A superioridade sobre o adversário não entrou como sinal a favor'
  when market = 'asian_handicap' and slug = 'defesa_fora_solida' and mando = 'any' then 'A solidez defensiva não entrou como sinal a favor'
  when market = 'asian_handicap' and slug = 'defesa_fora_solida' and mando = 'home' then 'Em casa, a solidez defensiva não entrou como sinal a favor'
  when market = 'asian_handicap' and slug = 'raramente_perde_por_2' then 'A margem das derrotas não entrou como sinal a favor'
  when market = 'btts' and slug = 'ambos_marcam' then 'Os gols dos dois times não entraram como sinal a favor'
  when market = 'btts' and slug = 'defesas_vazaveis' then 'A fragilidade das defesas não entrou como sinal a favor'
  when market = 'btts' and slug = 'defesa_forte' then 'A força defensiva não entrou como sinal a favor'
  when market = 'btts' and slug = 'ataque_trava' then 'A limitação ofensiva não entrou como sinal a favor'
  when market = 'double_chance' and slug = 'lado_coberto_forte' then 'A força do lado coberto não entrou como sinal a favor'
  when market = 'double_chance' and slug = 'adversario_limitado' then 'A campanha do adversário não entrou como sinal a favor'
  else texto
end
where tipo = 'contra';
