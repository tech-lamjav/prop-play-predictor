import { useMemo, useState } from 'react';
import { buscar, type Cadastro } from './crm-lista';
import {
  contarPorPosicao,
  filaDeTrabalho,
  metricasDeNegocio,
  montarLeads,
  type Posicao,
} from './crm-painel';
import type { EstadoDasEtapas } from '@/hooks/use-etapas';
import type { EstadoDoMovimento } from '@/hooks/use-painel-do-crm';
import { CabecalhoDoCrm } from './CabecalhoDoCrm';
import { FaixaDoFunil } from './FaixaDoFunil';
import { FilaDeTrabalhoLista } from './FilaDeTrabalhoLista';
import { ListaPorDia } from './ListaPorDia';
import { MetricasDoTopo } from './MetricasDoTopo';
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

type Aba = 'fila' | 'todos' | 'dia';

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'fila', rotulo: 'Fila de trabalho' },
  { id: 'todos', rotulo: 'Todos' },
  { id: 'dia', rotulo: 'Por dia' },
];

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
  const [aba, setAba] = useState<Aba>('fila');

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
      todos?.filter(
        (l) => achados.has(l.id) && (posicao === null || l.posicao === posicao),
      ) ?? null,
    [todos, achados, posicao],
  );

  const fila = useMemo(() => (noRecorte ? filaDeTrabalho(noRecorte) : null), [noRecorte]);

  const baseVazia = estado.tipo === 'pronto' && estado.cadastros.length === 0;
  const truncada = estado.tipo === 'pronto' && estado.totalNaBase > estado.cadastros.length;

  return (
    <div className="min-h-screen bg-canvas">
      <CabecalhoDoCrm estado={estado} />

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
              <div
                role="tablist"
                aria-label="Como ver a base"
                className="flex border-b border-line-2"
              >
                {ABAS.map(({ id, rotulo }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={aba === id}
                    onClick={() => setAba(id)}
                    className={`px-4 py-3 text-[14px] font-bold transition ${
                      aba === id
                        ? 'border-b-2 border-forest text-ink'
                        : 'text-ink-2 hover:text-ink-2'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              {aba === 'fila' &&
                (fila ? (
                  <FilaDeTrabalhoLista fila={fila} />
                ) : (
                  <p className="px-4 py-6 text-[14px] text-ink-2">
                    {faltouAlgo
                      ? 'Sem o histórico de etapas não dá para montar a fila sem inventar.'
                      : 'Carregando a fila…'}
                  </p>
                ))}

              {aba === 'todos' && (
                <TabelaDeLeads leads={noRecorte ?? []} vazio="Nenhum cadastro com esses filtros." />
              )}

              {aba === 'dia' && <ListaPorDia leads={noRecorte ?? []} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
