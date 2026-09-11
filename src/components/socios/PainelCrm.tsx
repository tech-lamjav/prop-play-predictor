import { useMemo, useState } from 'react';
import { agruparPorDia, buscar, formatarDia, type Cadastro } from './crm-lista';
import {
  contarPorPosicao,
  metricasDeNegocio,
  montarLeads,
  precisamDeAtencao,
  type Lead,
  type Posicao,
} from './crm-painel';
import type { EstadoDasEtapas } from '@/hooks/use-etapas';
import type { EstadoDoMovimento } from '@/hooks/use-painel-do-crm';
import { CabecalhoDoCrm } from './CabecalhoDoCrm';
import { FaixaDoFunil } from './FaixaDoFunil';
import { MetricasDoTopo } from './MetricasDoTopo';
import { KanbanDeLeads } from './KanbanDeLeads';
import { TabelaDeLeads } from './TabelaDeLeads';

/**
 * O que a tela sabe no momento em que desenha.
 *
 * `totalNaBase` vem junto porque a consulta tem teto. Sem ele, uma base que
 * passasse do teto seria desenhada inteira, com os números contando só a
 * fatia — errados sem nada denunciando.
 */
export type EstadoDoPainel =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; cadastros: Cadastro[]; totalNaBase: number };

/** Um array novo a cada render invalidaria os useMemo abaixo sem nada ter mudado. */
const VAZIO: Cadastro[] = [];

/**
 * Qual fatia da base a lista mostra.
 *
 * Duas, e não mais: a primeira versão tinha três abas, e a primeira delas ainda
 * se dividia em duas tabelas por dentro — cinco listas para uma base só. O
 * recorte é filtro, e agrupar por dia é uma chave à parte, porque as duas
 * coisas se combinam em vez de competir.
 */
type Recorte = 'atencao' | 'todos';

const RECORTES: { id: Recorte; rotulo: string; explicacao: string }[] = [
  {
    id: 'atencao',
    rotulo: 'Precisa de atenção',
    explicacao:
      'quem está esperando você: conversas sem toque há 7 dias ou mais, e quem nunca foi abordado',
  },
  {
    id: 'todos',
    rotulo: 'Todos',
    explicacao:
      'a base inteira, incluindo casos fechados e conversas que já tiveram toque esta semana',
  },
];

/**
 * O que dizer quando a lista sai vazia.
 *
 * A frase muda com o recorte de propósito: lista vazia em "precisa de atenção"
 * é uma boa notícia, e a mesma frase genérica faria parecer defeito.
 */
const vazioDo = (recorte: Recorte) =>
  recorte === 'atencao'
    ? 'Ninguém esperando. Toda conversa começada teve toque na última semana, e todo lead novo já foi abordado.'
    : 'Nenhum cadastro com esses filtros.';

/**
 * O painel dos sócios.
 *
 * A primeira versão era uma lista por dia, e o diagnóstico do Victor estava
 * certo: um registro cronológico responde "o que aconteceu", e um CRM precisa
 * responder "com quem eu falo agora". A ordem da tela é essa resposta —
 * números de acompanhamento, funil clicável, e só então a lista, com a FILA na
 * frente e a visão por dia em último.
 *
 * O funil e a busca filtram as três abas ao mesmo tempo: são recortes da mesma
 * base, e não três telas diferentes.
 *
 * `hoje` chega por prop em vez de ser lido do relógio aqui dentro: assim o
 * teste manda o dia e a tela não muda de comportamento à meia-noite.
 */
export function PainelCrm({
  estado,
  etapas,
  movimento,
  hoje,
}: {
  estado: EstadoDoPainel;
  etapas: EstadoDasEtapas;
  movimento: EstadoDoMovimento;
  hoje: string;
}) {
  const [busca, setBusca] = useState('');
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const [recorte, setRecorte] = useState<Recorte>('atencao');
  const [agrupado, setAgrupado] = useState(false);
  /**
   * Tabela ou kanban.
   *
   * Os dois desenham o MESMO recorte: a busca e o filtro do funil valem para os
   * dois. Trocar de vista muda a disposição, e nunca o conteúdo.
   */
  const [vista, setVista] = useState<'tabela' | 'kanban'>('tabela');

  const cadastros = estado.tipo === 'pronto' ? estado.cadastros : VAZIO;
  // Nulo enquanto as etapas não chegam. Um mapa vazio faria todo mundo cair em
  // "Novo", que é uma afirmação e não um vazio — e o funil inteiro mentiria.
  const gravadas = etapas.tipo === 'pronto' ? etapas.etapas : null;

  // Sem os toques não dá para dizer há quanto tempo alguém está parado, e um
  // mapa vazio faria a fila inchar com gente que já foi abordada. Por isso o
  // painel espera as duas consultas, e não desenha com meia informação.
  const movido = movimento.tipo === 'pronto' ? movimento.movimento : null;

  /**
   * A base inteira, sem filtro nenhum.
   *
   * Os números do topo e o funil saem DAQUI, e não do recorte: eles respondem
   * "como está a operação", e essa resposta não pode mudar porque alguém
   * digitou um nome na busca. Na primeira versão saíam do recorte, e procurar
   * "maria" fazia a conversão ser recalculada sobre uma pessoa só.
   */
  const todos = useMemo(
    () =>
      gravadas && movido
        ? montarLeads(cadastros, gravadas, movido.toques, movido.apostas, hoje)
        : null,
    [cadastros, gravadas, movido, hoje],
  );

  const faltouAlgo = etapas.tipo === 'erro' || movimento.tipo === 'erro';

  const contagem = useMemo(() => (todos ? contarPorPosicao(todos) : null), [todos]);
  const metricas = useMemo(() => (todos ? metricasDeNegocio(todos, hoje) : null), [todos, hoje]);

  // A busca roda sobre os cadastros porque é lá que ela já existe e está
  // testada; o conjunto de ids traz o resultado de volta para o mundo dos leads
  // sem uma segunda implementação de busca.
  const achados = useMemo(
    () => new Set(buscar(cadastros, busca).map((c) => c.id)),
    [cadastros, busca],
  );

  const noRecorte = useMemo(
    () =>
      todos?.filter((l) => achados.has(l.id) && (posicao === null || l.posicao === posicao)) ??
      null,
    [todos, achados, posicao],
  );

  /**
   * A lista que a tela desenha, já no recorte e na ordem certa.
   *
   * "Todos" ordena pelo mais parado, e não pelo mais recente: numa base que
   * ninguém abordou, a ordem cronológica só mostra os últimos que chegaram, que
   * são justamente os menos urgentes.
   */
  const lista = useMemo(() => {
    if (!noRecorte) return null;
    if (recorte === 'atencao') return precisamDeAtencao(noRecorte);
    return [...noRecorte].sort((a, b) => (b.diasParado ?? 0) - (a.diasParado ?? 0));
  }, [noRecorte, recorte]);

  const porDia = useMemo(
    () => (lista && agrupado ? agruparPorDia(lista, (l) => l.cadastradoEm) : null),
    [lista, agrupado],
  );

  const resumo =
    estado.tipo === 'pronto'
      ? `${estado.totalNaBase} ${estado.totalNaBase === 1 ? 'cadastro' : 'cadastros'} na base`
      : estado.tipo === 'erro'
        ? 'base indisponível'
        : 'carregando…';

  const baseVazia = estado.tipo === 'pronto' && estado.cadastros.length === 0;
  const truncada = estado.tipo === 'pronto' && estado.totalNaBase > estado.cadastros.length;

  return (
    <div className="min-h-screen bg-canvas">
      <CabecalhoDoCrm resumo={resumo} />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {estado.tipo === 'carregando' && (
          <p className="text-[15px] text-ink-2">Carregando os cadastros…</p>
        )}
        {estado.tipo === 'erro' && (
          <p className="text-[15px] text-ink-2">Não deu para carregar os cadastros agora.</p>
        )}
        {baseVazia && <p className="text-[15px] text-ink-2">Nenhum cadastro na base.</p>}

        {estado.tipo === 'pronto' && !baseVazia && (
          <>
            {/* O aviso vem ANTES dos números: com a base truncada eles contam a
                fatia, e um número errado sem aviso é pior que número nenhum. */}
            {truncada && (
              <p className="mb-4 rounded-rebrand-sm border border-line-2 bg-white px-4 py-3 text-[13px] text-ink-2">
                A base passou do teto da consulta. Estes são os {estado.cadastros.length} cadastros
                mais recentes de {estado.totalNaBase}, e os números abaixo contam só eles.
              </p>
            )}

            {metricas && <MetricasDoTopo metricas={metricas} />}

            <div className="mt-4">
              {contagem ? (
                <FaixaDoFunil contagem={contagem} selecionada={posicao} aoSelecionar={setPosicao} />
              ) : (
                <p className="rounded-rebrand-md border border-line-2 bg-white px-4 py-6 text-[14px] text-ink-2">
                  {faltouAlgo
                    ? 'Não deu para montar o funil: o histórico de etapas não carregou.'
                    : 'Carregando o funil…'}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                aria-label="Buscar cadastro"
                className="h-11 min-w-[240px] flex-1 rounded-rebrand-sm border border-line-2 bg-white px-4 text-[15px] text-ink placeholder:text-ink-dim"
              />
              {posicao && (
                <button
                  type="button"
                  onClick={() => setPosicao(null)}
                  className="h-11 rounded-rebrand-sm border border-line-2 bg-white px-4 text-[14px] font-bold text-ink hover:border-forest hover:text-forest"
                >
                  Limpar filtro do funil
                </button>
              )}
            </div>

            <div className="mt-5 rounded-rebrand-md border border-line-2 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-4 pb-1 pt-3">
                <div
                  role="radiogroup"
                  aria-label="Recorte da lista"
                  className="flex flex-wrap gap-1"
                >
                  {RECORTES.map(({ id, rotulo, explicacao }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={recorte === id}
                      title={explicacao}
                      onClick={() => setRecorte(id)}
                      className={`rounded-rebrand-sm px-3 py-1.5 text-[14px] font-bold transition ${
                        recorte === id
                          ? 'bg-forest text-white'
                          : 'text-ink-2 hover:bg-canvas hover:text-ink'
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div role="radiogroup" aria-label="Formato da lista" className="flex gap-1">
                    {(['tabela', 'kanban'] as const).map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={vista === id}
                        onClick={() => setVista(id)}
                        className={`rounded-rebrand-sm px-3 py-1.5 text-[13px] font-bold transition ${
                          vista === id
                            ? 'bg-ink text-white'
                            : 'text-ink-2 hover:bg-canvas hover:text-ink'
                        }`}
                      >
                        {id === 'tabela' ? 'Tabela' : 'Kanban'}
                      </button>
                    ))}
                  </div>

                  {/* Agrupar é chave à parte, e não um terceiro recorte: ela se
                    combina com os dois recortes em vez de competir com eles.
                    Some no kanban, onde a coluna já é o agrupamento. */}
                  {vista === 'tabela' && (
                    <label className="flex items-center gap-2 text-[13px] text-ink-2">
                      <input
                        type="checkbox"
                        checked={agrupado}
                        onChange={(e) => setAgrupado(e.target.checked)}
                        aria-label="Agrupar por dia de cadastro"
                      />
                      Agrupar por dia
                    </label>
                  )}
                </div>
              </div>

              {/* A explicação do recorte na TELA, e não só como dica de mouse.
                  Ela existia só no `title`, que é invisível na prática — e a
                  pergunta "qual a diferença entre os dois?" veio de quem tinha
                  os dois botões à vista. */}
              <p className="border-b border-line-2 px-4 pb-3 text-[12px] text-ink-2">
                {RECORTES.find((r) => r.id === recorte)?.explicacao}
              </p>

              {lista === null ? (
                <p className="px-4 py-6 text-[14px] text-ink-2">
                  {faltouAlgo
                    ? 'Sem o histórico de etapas não dá para montar a lista sem inventar.'
                    : 'Carregando a lista…'}
                </p>
              ) : vista === 'kanban' ? (
                <KanbanDeLeads leads={lista} />
              ) : porDia ? (
                porDia.map((grupo) => (
                  <div key={grupo.dia ?? 'sem-data'}>
                    <h3 className="border-b border-line-2 bg-canvas px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2">
                      {grupo.dia ? formatarDia(grupo.dia) : 'Sem data de cadastro'}
                      <span className="ml-2 font-sans normal-case tracking-normal">
                        {grupo.itens.length}
                      </span>
                    </h3>
                    <TabelaDeLeads leads={grupo.itens} vazio="" />
                  </div>
                ))
              ) : (
                <TabelaDeLeads leads={lista} vazio={vazioDo(recorte)} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
