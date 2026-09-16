import { useMemo, useState } from 'react';
import { agruparPorDia, buscar, formatarDia, type Cadastro } from './crm-lista';
import {
  contarPorPosicao,
  contarPorEtiqueta,
  filtrarPorEtiqueta,
  filtrarPorPeriodo,
  type Periodo,
  escondeSemWhatsApp,
  metricasDeNegocio,
  montarLeads,
  precisamDeAtencao,
  semWhatsApp,
  type Lead,
  type Posicao,
} from './crm-painel';
import type { Etiqueta } from './crm-etiquetas';
import type { EstadoDasEtapas } from '@/hooks/use-etapas';
import type { EstadoDoMovimento } from '@/hooks/use-painel-do-crm';
import type { EstadoDasMarcas } from '@/hooks/use-sem-whatsapp';
import { CabecalhoDoCrm } from './CabecalhoDoCrm';
import { FaixaDoFunil } from './FaixaDoFunil';
import { FaixaDeEtiquetas } from './FaixaDeEtiquetas';
import { ATALHO_PADRAO, FiltroDePeriodo } from './FiltroDePeriodo';
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

/** Pelo mesmo motivo do `VAZIO`: um Set novo a cada render remontaria a lista. */
const VAZIO_DE_MARCAS: ReadonlySet<string> = new Set<string>();

/**
 * Qual fatia da base a lista mostra.
 *
 * Poucas, e cada uma respondendo a uma pergunta que o sócio faz de verdade: com
 * quem eu falo agora, quem eu não consigo abordar, e a base inteira. A primeira
 * versão tinha três recortes em que o primeiro ainda se dividia em duas tabelas
 * por dentro — cinco listas para uma base só. O recorte é filtro, e agrupar por
 * dia é uma chave à parte, porque as duas coisas se combinam em vez de competir.
 *
 * ⚠️ "Sem WhatsApp" é recorte, e não posição do funil. Não ter número é fato do
 * cadastro, e a pessoa continua tendo a etapa que tem — a mesma separação que
 * tirou "em teste" do funil.
 */
type Recorte = 'atencao' | 'sem-whatsapp' | 'todos';

const RECORTES: { id: Recorte; rotulo: string; explicacao: string }[] = [
  {
    id: 'atencao',
    rotulo: 'Precisa de atenção',
    explicacao:
      'quem está esperando você: conversas sem toque há 7 dias ou mais, e quem nunca foi abordado',
  },
  {
    id: 'sem-whatsapp',
    rotulo: 'Sem WhatsApp',
    explicacao:
      'quem não tem número que abra conversa: dá para ver o cadastro, mas não dá para abordar por WhatsApp',
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
const vazioDo = (recorte: Recorte) => {
  if (recorte === 'atencao') {
    return 'Ninguém esperando. Toda conversa começada teve toque na última semana, e todo lead novo já foi abordado.';
  }
  if (recorte === 'sem-whatsapp') {
    return 'Todo mundo desta lista tem número que abre conversa.';
  }
  return 'Nenhum cadastro com esses filtros.';
};

/**
 * O painel dos sócios.
 *
 * A primeira versão era uma lista por dia, e o diagnóstico do Victor estava
 * certo: um registro cronológico responde "o que aconteceu", e um CRM precisa
 * responder "com quem eu falo agora". A ordem da tela é essa resposta —
 * números de acompanhamento, funil clicável, e só então a lista, com a FILA na
 * frente e o agrupamento por dia como chave à parte.
 *
 * O funil e a busca filtram os dois recortes ao mesmo tempo: são recortes da
 * mesma base, e não duas telas diferentes.
 *
 * `hoje` chega por prop em vez de ser lido do relógio aqui dentro: assim o
 * teste manda o dia e a tela não muda de comportamento à meia-noite.
 */
export function PainelCrm({
  estado,
  etapas,
  movimento,
  marcas,
  hoje,
}: {
  estado: EstadoDoPainel;
  etapas: EstadoDasEtapas;
  movimento: EstadoDoMovimento;
  /**
   * Quem o sócio marcou na mão como impossível de abordar.
   *
   * ⚠️ Esta consulta NÃO segura a tela, ao contrário das etapas e dos toques.
   * Sem etapas o funil inteiro mente sobre todo mundo; sem as marcas manuais, o
   * pior que acontece é aparecer na lista alguém que devia estar escondido — e
   * mostrar demais é o lado seguro do erro. Esconder alguém que precisava de
   * ligação seria o lado caro.
   *
   * Quando ela falha, o esconder continua valendo pelo número e a tela diz isso
   * em vez de fingir que sabe de tudo.
   */
  marcas: EstadoDasMarcas;
  hoje: string;
}) {
  const [busca, setBusca] = useState('');
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  /**
   * O filtro do teste gratuito, num eixo à parte do funil.
   *
   * Estado próprio, e não uma sétima posição: os dois se SOMAM. "Quem está em
   * teste e ainda está em nutrindo" é pergunta legítima, e era justamente ela
   * que não dava para fazer quando "em teste" morava dentro do funil.
   */
  const [etiqueta, setEtiqueta] = useState<Etiqueta | null>(null);
  const [recorte, setRecorte] = useState<Recorte>('atencao');
  /**
   * O recorte por data de cadastro, e qual atalho o produziu.
   *
   * Os dois juntos porque "desde sempre" e um personalizado com os dois campos
   * vazios filtram igual, e só um deles deve abrir os campos de data.
   */
  const [atalhoDoPeriodo, setAtalhoDoPeriodo] = useState(ATALHO_PADRAO);
  const [periodo, setPeriodo] = useState<Periodo>({ de: null, ate: null });
  const [agrupado, setAgrupado] = useState(false);
  /**
   * Tabela ou kanban.
   *
   * Os dois desenham o MESMO recorte: a busca e o filtro do funil valem para os
   * dois. Trocar de vista muda a disposição, e nunca o conteúdo.
   */
  const [vista, setVista] = useState<'tabela' | 'kanban'>('tabela');
  /**
   * Esconder quem não dá para abordar por WhatsApp.
   *
   * `null` quer dizer "ainda não mexi nisso", e aí vale o padrão de cada
   * recorte: LIGADO na fila de atenção, que é onde o sócio age, e desligado em
   * "Todos", que é onde ele confere a base. Foi o pedido: eles somem quando o
   * trabalho é abordar, e continuam visíveis quando o trabalho é olhar tudo.
   *
   * Assim que o sócio mexe no interruptor, a escolha dele passa a valer em
   * todos os recortes — um padrão que volta sozinho depois de a pessoa ter
   * dito o contrário é o tipo de tela que parece ter vontade própria.
   */
  const [escondendo, setEscondendo] = useState<boolean | null>(null);

  const cadastros = estado.tipo === 'pronto' ? estado.cadastros : VAZIO;
  // Nulo enquanto as etapas não chegam. Um mapa vazio faria todo mundo cair em
  // "Novo", que é uma afirmação e não um vazio — e o funil inteiro mentiria.
  const gravadas = etapas.tipo === 'pronto' ? etapas.etapas : null;

  // Sem os toques não dá para dizer há quanto tempo alguém está parado, e um
  // mapa vazio faria a fila inchar com gente que já foi abordada. Por isso o
  // painel espera as duas consultas, e não desenha com meia informação.
  const movido = movimento.tipo === 'pronto' ? movimento.movimento : null;

  // Conjunto vazio enquanto carrega ou quando falha: o lead ainda sabe dizer
  // que está sem WhatsApp pelo próprio número, que é a maior parte dos casos.
  const marcados = marcas.tipo === 'pronto' ? marcas.marcados : VAZIO_DE_MARCAS;

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
        ? montarLeads(cadastros, gravadas, movido.toques, movido.apostas, hoje, marcados)
        : null,
    [cadastros, gravadas, movido, hoje, marcados],
  );

  /**
   * O esconder vale neste recorte?
   *
   * Por recorte, e não um booleano só, porque o número ao lado de cada botão
   * promete "quantos eu veria se clicasse aqui" — e cada recorte tem um padrão
   * diferente. Com um booleano único, o contador de "Todos" mostraria a conta
   * da fila enquanto o sócio estivesse na fila.
   *
   * Dentro do próprio "Sem WhatsApp" nunca esconde: lá a pilha É a lista, e
   * esconder devolveria sempre vazio.
   */
  const escondeNo = (r: Recorte) => r !== 'sem-whatsapp' && (escondendo ?? r === 'atencao');
  const escondendoAqui = escondeNo(recorte);

  const faltouAlgo = etapas.tipo === 'erro' || movimento.tipo === 'erro';

  const contagem = useMemo(() => (todos ? contarPorPosicao(todos) : null), [todos]);
  const porEtiqueta = useMemo(() => (todos ? contarPorEtiqueta(todos) : null), [todos]);
  const metricas = useMemo(() => (todos ? metricasDeNegocio(todos, hoje) : null), [todos, hoje]);

  // A busca roda sobre os cadastros porque é lá que ela já existe e está
  // testada; o conjunto de ids traz o resultado de volta para o mundo dos leads
  // sem uma segunda implementação de busca.
  const achados = useMemo(
    () => new Set(buscar(cadastros, busca).map((c) => c.id)),
    [cadastros, busca],
  );

  const noRecorte = useMemo(() => {
    if (!todos) return null;
    const porFiltros = todos.filter(
      (l) => achados.has(l.id) && (posicao === null || l.posicao === posicao),
    );
    // O período entra por último porque é o único filtro que olha uma coluna
    // que os outros ignoram, e assim ele fica testável sozinho.
    return filtrarPorPeriodo(filtrarPorEtiqueta(porFiltros, etiqueta), periodo);
  }, [todos, achados, posicao, etiqueta, periodo]);

  /**
   * A lista que a tela desenha, já no recorte e na ordem certa.
   *
   * "Todos" ordena pelo mais parado, e não pelo mais recente: numa base que
   * ninguém abordou, a ordem cronológica só mostra os últimos que chegaram, que
   * são justamente os menos urgentes.
   */
  const lista = useMemo(() => {
    if (!noRecorte) return null;
    // Esconder ANTES de montar a fila, e não depois: a fila ordena por urgência,
    // e tirar linhas de uma lista já ordenada deixaria buracos no topo.
    const visiveis = escondendoAqui ? escondeSemWhatsApp(noRecorte) : noRecorte;
    if (recorte === 'atencao') return precisamDeAtencao(visiveis);
    // Sai de `visiveis`, e não de `noRecorte`: quem manda no esconder é o
    // `escondeNo`, e só ele. Lendo a base crua aqui, o guarda que isenta este
    // recorte virava código morto — dava para apagá-lo sem nada mudar, que é o
    // pior estado de um guarda: parece proteger e não protege.
    const doRecorte = recorte === 'sem-whatsapp' ? semWhatsApp(visiveis) : visiveis;
    return [...doRecorte].sort((a, b) => (b.diasParado ?? 0) - (a.diasParado ?? 0));
  }, [noRecorte, recorte, escondendoAqui]);

  /**
   * Quanta gente cada recorte mostraria, com os filtros de agora.
   *
   * Existe por causa de uma confusão real: o Victor abordou algumas pessoas, e
   * no dia seguinte elas tinham sumido da tela. Sumiram porque o recorte padrão
   * é a FILA, e quem recebe toque sai da fila — que é o comportamento certo.
   * Sem número ao lado, "a fila encolheu porque você trabalhou" é
   * indistinguível de "a base encolheu".
   *
   * Conta sobre `noRecorte`, e não sobre a base: o número responde "quantos eu
   * veria se clicasse aqui". Contar a base inteira com a busca ligada
   * prometeria gente que o clique não traria.
   */
  const quantos = useMemo<Record<Recorte, number> | null>(() => {
    if (!noRecorte) return null;
    // Cada número segue o esconder DO SEU recorte, senão ele promete gente que
    // o clique não traria. O de "Sem WhatsApp" conta a pilha inteira: é ela
    // que o botão mostra.
    const visiveisEm = (r: Recorte) =>
      escondeNo(r) ? escondeSemWhatsApp(noRecorte) : noRecorte;
    return {
      atencao: precisamDeAtencao(visiveisEm('atencao')).length,
      'sem-whatsapp': semWhatsApp(visiveisEm('sem-whatsapp')).length,
      todos: visiveisEm('todos').length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noRecorte, escondendo]);

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
    // `theme-bolao` liga os raios de 20px, a tipografia display e as variáveis
    // de cor do rebrand. Sem essa classe na raiz, as outras existem e não fazem
    // nada: cantos quadrados e tracking padrão. As 37 telas do site abrem assim,
    // e era por isso que o painel parecia de outro produto.
    <div className="theme-bolao min-h-screen bg-canvas text-ink">
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

            {/* O teste gratuito vem DEPOIS do funil e em cartão próprio: é
                outro eixo, e colar os dois numa fileira só foi exatamente o
                que fez a tela parecer que misturava duas coisas. Some quando
                não há ninguém em teste nenhum. */}
            {porEtiqueta && (
              <div className="mt-3">
                <FaixaDeEtiquetas
                  contagem={porEtiqueta}
                  selecionada={etiqueta}
                  aoSelecionar={setEtiqueta}
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                aria-label="Buscar cadastro"
                className="h-11 min-w-[240px] flex-1 rounded-rebrand-sm border border-line-2 bg-white px-4 text-[15px] text-ink placeholder:text-ink-dim"
              />
              <FiltroDePeriodo
                atalho={atalhoDoPeriodo}
                periodo={periodo}
                hoje={hoje}
                aoMudar={(a, p) => {
                  setAtalhoDoPeriodo(a);
                  setPeriodo(p);
                }}
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
                      {/* O número entra mesmo zerado: "Precisa de atenção 0" é
                          uma boa notícia legível, e sem ele a lista vazia
                          parece defeito. Só some enquanto não se sabe.

                          O espaço é literal porque o JSX come o que existe
                          entre a chave e o comentário, e sem ele o leitor de
                          tela anuncia "Precisa de atenção1". */}
                      {quantos != null && ' '}
                      {quantos && (
                        <span
                          className={`ml-1.5 tabular-nums font-normal ${
                            recorte === id ? 'text-white/70' : 'text-ink-dim'
                          }`}
                        >
                          {quantos[id]}
                        </span>
                      )}
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

                  {/* Esconder quem não dá para abordar também é chave à parte,
                      e por isso mora aqui e não vira um recorte: ela se combina
                      com qualquer um deles. Some dentro do próprio "Sem
                      WhatsApp", onde a pilha É a lista. */}
                  {recorte !== 'sem-whatsapp' && (
                    <label className="flex items-center gap-2 text-[13px] text-ink-2">
                      <input
                        type="checkbox"
                        checked={escondendoAqui}
                        onChange={(e) => setEscondendo(e.target.checked)}
                        aria-label="Esconder quem não tem WhatsApp"
                      />
                      Esconder sem WhatsApp
                      {/* Só aparece quando tem o que dizer: sem as marcas
                          manuais o esconder ainda funciona pelo número, e
                          calar sobre isso faria a lista parecer completa. */}
                      {marcas.tipo === 'erro' && (
                        <span className="text-[12px] text-ink-dim">
                          (só pelo número — as marcas não carregaram)
                        </span>
                      )}
                    </label>
                  )}

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

              {/* A explicação do recorte viveu aqui como uma linha própria, e
                  saiu a pedido do Victor: ela custava uma faixa inteira do
                  cartão para repetir uma coisa que se aprende uma vez. Ela
                  continua no `title` de cada botão, para quem chegar depois. */}
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
