import type { ReactNode } from 'react';
import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { ETAPAS, ROTULO_DA_ETAPA, type Etapa } from './crm-vocabulario';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bloco } from './Bloco';
import { MensagemPronta } from './MensagemPronta';
import { mensagemPara } from './crm-mensagens';
import {
  ganchoDe,
  nomeDoPlano,
  type Pessoa,
  type ResumoDeApostas,
  primeiroNome,
  type TipoDeGancho,
} from './crm-ficha';

export type EstadoDaFicha =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'nao-encontrada' }
  /** `apostas` nulo é a consulta que falhou, e não a pessoa que não apostou. */
  | { tipo: 'pronta'; pessoa: Pessoa; apostas: ResumoDeApostas | null };

/** Carimbo do banco → `10/09/2026`. Nulo vira nulo, e quem chama decide o texto. */
function dia(carimbo: string | null): string | null {
  const d = brtDayOf(carimbo);
  return d ? formatarDia(d) : null;
}

/**
 * Rótulo em cima, valor embaixo.
 *
 * A primeira versão punha os dois na mesma linha, com o valor à direita. Um
 * e-mail comprido não cabia, o navegador espremia o rótulo, e "E-mail" quebrava
 * em duas linhas: a coluna ficava com cara de apertada mesmo tendo espaço. Em
 * cima, o valor tem a largura inteira e o rótulo nunca quebra.
 */
function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="border-t border-line-2 py-2 first:border-t-0 first:pt-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">{rotulo}</p>
      {/* Sem valor, a palavra explícita. Um campo em branco é lido como dado, e
          o que existe aqui é a ausência dele. */}
      <p className="break-words text-[14px] text-ink">
        {valor ?? <span className="text-ink-2">não informado</span>}
      </p>
    </div>
  );
}

/**
 * Um contato no cabeçalho.
 *
 * Rótulo em cima, valor embaixo, como o `Campo` — mas sem a borda de cima, que
 * numa faixa horizontal viraria um risco entre colunas em vez de um separador
 * entre linhas.
 */
function Contato({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="min-w-[140px]">
      <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-dim">
        {rotulo}
      </p>
      {/* Sem valor, a palavra explícita: um campo em branco é lido como dado, e
          o que existe aqui é a ausência dele. */}
      <p className="mt-0.5 break-words text-[13.5px] text-ink">
        {valor ?? <span className="text-ink-2">não informado</span>}
      </p>
    </div>
  );
}

/**
 * O gatilho de uma aba: sublinhado, e não pílula.
 *
 * A primeira versão era uma pílula branca sobre o fundo creme, dentro de um
 * `grid-cols-3`. Duas coisas saíram erradas ao mesmo tempo: as três colunas
 * ficavam da largura da mais longa, então "Conversa" e "Planos" carregavam um
 * vão morto do tamanho de "Comportamento"; e a pílula branca flutuando sobre o
 * creme lia como botão apertado, não como aba selecionada.
 *
 * Sublinhado resolve os dois: cada aba ocupa a largura do próprio texto, e a
 * linha de baixo é o que o olho já reconhece como "você está aqui".
 *
 * ⚠️ Os três `data-[state=active]` que ANULAM coisa são obrigatórios, e faltar
 * qualquer um deles estraga a aba. A base do componente traz
 * `data-[state=active]:bg-background` e `:shadow-sm`, e dentro de
 * `.theme-bolao` o `background` é escuro: sem anular o fundo, a aba ativa
 * virava um retângulo escuro com o texto escuro em cima, ilegível. E o
 * `rounded-none` tira o `rounded-sm` da base, que desenhava um canto
 * arredondado no meio de um sublinhado reto.
 */
const ABA =
  'relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2.5 text-[13.5px] font-bold text-ink-2 shadow-none transition hover:text-ink data-[state=active]:border-forest data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:shadow-none';

/**
 * O painel de uma aba.
 *
 * `min-h-0` junto do `flex-1` não é redundância: sem ele, um filho que rola
 * dentro de um container flex cresce até o conteúdo caber, o `overflow-y-auto`
 * nunca entra em ação, e a rolagem vaza para o modal — que foi o que produziu
 * as duas barras de rolagem disputando a lateral.
 */
const PAINEL = 'min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-canvas p-6 pt-5';

const COMO_CHAMAR: Record<TipoDeGancho, string> = {
  betinho: 'veio pelo Betinho',
  futebol: 'veio pelo futebol',
  nba: 'veio pela NBA',
  indefinido: 'não dá para dizer ainda',
};

/**
 * A ficha de uma pessoa.
 *
 * Componente de apresentação puro: recebe o estado e desenha. Toda a leitura do
 * banco fica no hook, e todo o raciocínio em `crm-ficha.ts` — que é o que torna
 * o gancho testável sem montar tela nenhuma.
 */
export function Ficha({
  estado,
  etapa,
  aoMudarEtapa,
  mudandoEtapa,
  erroAoMudarEtapa,
  linhaDoTempo,
  comportamento,
  edicaoDeAcesso,
  assinatura,
}: {
  estado: EstadoDaFicha;
  /**
   * Fora do estado de propósito: a etapa vem de outra consulta, e um lead sem
   * linha gravada já vale como novo sem precisar que a ficha tenha carregado.
   */
  etapa: Etapa | null;
  aoMudarEtapa: (etapa: Etapa) => void;
  mudandoEtapa: boolean;
  erroAoMudarEtapa: boolean;
  comportamento: ReactNode;
  /** O editor de acesso entra por fora: ele tem escrita própria, e a ficha
   *  continua sendo só desenho. */
  edicaoDeAcesso: ReactNode;
  /**
   * O formulário de assinatura, separado dos acessos avulsos.
   *
   * Eram uma prop só, com a assinatura renderizada DENTRO do editor de acesso.
   * Separei para a aba de planos poder pôr as duas em colunas diferentes: são
   * a venda e os remendos, e empilhadas deixavam metade da largura vazia.
   */
  assinatura: ReactNode;
  /** A linha do tempo entra por fora: ela tem consulta e escrita próprias, e a
   *  ficha continua sendo só desenho. */
  linhaDoTempo: ReactNode;
}) {
  if (estado.tipo !== 'pronta') {
    const recado =
      estado.tipo === 'carregando'
        ? 'Carregando a ficha…'
        : estado.tipo === 'erro'
          ? 'Não deu para carregar a ficha agora.'
          : 'Não encontramos esse cadastro.';
    return <p className="p-8 text-[15px] text-ink-2">{recado}</p>;
  }

  return (
    <Conteudo
      {...estado}
      etapa={etapa}
      aoMudarEtapa={aoMudarEtapa}
      mudandoEtapa={mudandoEtapa}
      erroAoMudarEtapa={erroAoMudarEtapa}
      linhaDoTempo={linhaDoTempo}
      comportamento={comportamento}
      edicaoDeAcesso={edicaoDeAcesso}
      assinatura={assinatura}
    />
  );
}

function Conteudo({
  pessoa,
  apostas,
  etapa,
  aoMudarEtapa,
  mudandoEtapa,
  erroAoMudarEtapa,
  linhaDoTempo,
  comportamento,
  edicaoDeAcesso,
  assinatura,
}: {
  pessoa: Pessoa;
  apostas: ResumoDeApostas | null;
  etapa: Etapa | null;
  aoMudarEtapa: (etapa: Etapa) => void;
  mudandoEtapa: boolean;
  erroAoMudarEtapa: boolean;
  linhaDoTempo: ReactNode;
  /** Entra por fora, como a linha do tempo: tem consulta própria, e só sai
   *  quando o modal abre. */
  comportamento: ReactNode;
  edicaoDeAcesso: ReactNode;
  assinatura: ReactNode;
}) {
  const plano = nomeDoPlano(pessoa.subscription_product_type);
  const bruto = (pessoa.subscription_product_type ?? '').trim();
  const gancho = ganchoDe(pessoa, apostas);
  const cadastroEm = dia(pessoa.created_at);
  const ultimaAposta = apostas?.ultima ? dia(apostas.ultima) : null;

  return (
    <div className="flex max-h-[82vh] flex-col">
      {/*
        O cabeçalho carrega tudo que se olha UMA VEZ: quem é, em que pé está, e
        como falar com a pessoa. Antes isso era uma coluna de 360px à esquerda,
        e o Victor apontou o problema: planos, acessos e comportamento estavam
        empilhados ali junto, quando são coisas que se CONSULTA de verdade — com
        gráfico, com histórico, com detalhe. A coluna gastava a largura da ficha
        para mostrar três linhas de contato.

        Numa faixa horizontal, as mesmas informações ocupam duas linhas e
        devolvem a largura inteira para as abas. A etapa fica aqui e não numa
        aba de propósito: ela precisa estar à mão enquanto o sócio olha o que a
        pessoa faz, que é justamente quando ele decide mover.
      */}
      <section
        role="region"
        aria-label="Identificação do lead"
        className="shrink-0 bg-white px-6 pt-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            {/* Sem nome, o e-mail vira o título: a ficha precisa ter uma pessoa
                no topo, e não uma faixa vazia. */}
            <h1 className="truncate font-display text-[26px] font-black leading-tight text-ink">
              {pessoa.name ?? pessoa.email}
            </h1>
            <p className="mt-0.5 text-[12.5px] text-ink-2">
              {cadastroEm ? `Cadastrou em ${cadastroEm}` : 'Sem data de cadastro no banco'}
            </p>
          </div>

          {/* A etapa fica alinhada à DIREITA do nome, e não abaixo dos
              contatos. É o único controle do cabeçalho, e misturá-lo na fileira
              de leitura fazia o seletor parecer mais um campo de texto. */}
          <div className="shrink-0">
            <label
              htmlFor="etapa-do-lead"
              className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-dim"
            >
              Etapa
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select
                id="etapa-do-lead"
                value={etapa ?? ''}
                disabled={mudandoEtapa || etapa === null}
                onChange={(e) => aoMudarEtapa(e.target.value as Etapa)}
                aria-label="Etapa do lead"
                className="h-9 rounded-rebrand-sm border border-line-2 bg-white px-2.5 text-[13.5px] font-bold text-ink disabled:opacity-60"
              >
                {etapa === null ? <option value="">Carregando…</option> : null}
                {ETAPAS.map((e) => (
                  <option key={e} value={e}>
                    {ROTULO_DA_ETAPA[e]}
                  </option>
                ))}
              </select>
              {/* Travar enquanto grava não é conforto: duas mudanças em voo
                  gravariam dois eventos, e o segundo registraria um "de" que já
                  não era verdade.

                  O recado só aparece quando tem o que dizer. A versão anterior
                  mantinha "Cada mudança fica registrada" permanentemente embaixo
                  do seletor, e uma promessa que está sempre lá não é lida — só
                  ocupa a linha de baixo. Quando a gravação falha, ela ainda
                  virava mentira no exato momento em que nada foi registrado. */}
              {(mudandoEtapa || erroAoMudarEtapa) && (
                <span
                  className={`text-[11.5px] ${erroAoMudarEtapa ? 'font-bold text-ink' : 'text-ink-2'}`}
                >
                  {erroAoMudarEtapa ? 'Não gravou. Continua como estava.' : 'Gravando…'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-x-7 gap-y-3">
          <Contato rotulo="E-mail" valor={pessoa.email} />
          <Contato rotulo="WhatsApp" valor={pessoa.whatsapp_number} />
          <Contato
            rotulo="Telegram"
            valor={
              pessoa.telegram_username
                ? `@${pessoa.telegram_username}${pessoa.telegram_synced ? '' : ' (não vinculado)'}`
                : null
            }
          />
        </div>
      </section>

      {/*
        Três abas, e a divisão é por PERGUNTA e não por tipo de dado.

        Conversa responde "o que eu digo a essa pessoa": o palpite do gancho, a
        mensagem pronta e o registro do que já aconteceu. É a aba que abre,
        porque é o trabalho.

        Planos responde "o que essa pessoa tem", e é onde se dá e se tira. Ler e
        escrever no mesmo lugar, pela razão de sempre: dois lugares dizendo a
        mesma coisa acabam discordando, e ninguém sabe qual acreditar.

        Comportamento responde "o que essa pessoa faz" — como ela aposta, e o
        que o PostHog viu.
      */}
      <Tabs defaultValue="conversa" className="flex min-h-0 flex-1 flex-col">
        {/* A tira das abas mora no BRANCO do cabeçalho e divide a borda de
            baixo com ele. Antes ela flutuava sobre o creme, e a aba ativa
            parecia um botão solto no meio do nada: o sublinhado precisa de uma
            linha para interromper, senão não há o que sublinhar. */}
        {/* ⚠️ `p-0` vem ANTES de `px-6`, e a ordem importa: o merge de classes
            resolve conflito pelo último que aparece, então `px-6 p-0` zerava o
            respiro lateral e as abas encostavam na borda do modal. */}
        <TabsList className="h-auto shrink-0 justify-start gap-6 rounded-none border-b border-line-2 bg-white p-0 px-6">
          <TabsTrigger value="conversa" className={ABA}>
            Conversa
          </TabsTrigger>
          <TabsTrigger value="planos" className={ABA}>
            Planos
          </TabsTrigger>
          <TabsTrigger value="comportamento" className={ABA}>
            Comportamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversa" className={PAINEL}>
          <Bloco titulo="Gancho">
            <p className="text-[15px] text-ink">
              <span className="font-bold">Palpite:</span> {COMO_CHAMAR[gancho.tipo]}
            </p>
            <p className="mt-1 text-[13px] text-ink-2">Porque {gancho.porque}.</p>
            {ultimaAposta ? (
              <p className="mt-1 text-[13px] text-ink-2">Última aposta em {ultimaAposta}.</p>
            ) : null}
            {/* A aposta é o sinal mais forte e o primeiro da fila. Sem ela, o
                palpite pode estar apontando para o lado errado, e o sócio
                precisa saber disso antes de abrir a conversa. */}
            {gancho.apostasDesconhecidas ? (
              <p className="mt-2 text-[13px] font-bold text-ink">
                Não deu para consultar as apostas, então este palpite está incompleto.
              </p>
            ) : null}
            <p className="mt-3 text-[12px] text-ink-2">
              É leitura do que o banco registrou, não do que a pessoa disse.
            </p>
          </Bloco>

          {/* Só depois de saber a etapa: o modelo depende dela, e o campo é
              semeado uma vez só — nascer com a etapa errada deixaria o texto
              desatualizado sem o sócio perceber. */}
          {etapa && (
            <MensagemPronta
              modelo={mensagemPara(gancho.tipo, etapa, primeiroNome(pessoa.name))}
              numero={pessoa.whatsapp_number}
            />
          )}

          {linhaDoTempo}
        </TabsContent>

        <TabsContent value="planos" className={PAINEL}>
          {/*
            Duas colunas, porque o conteúdo são duas coisas de naturezas
            diferentes empilhadas: a VENDA (qual plano, até quando) e os
            REMENDOS (ligar um produto solto, dar os Relatórios, mexer no
            teste). Em coluna única o modal ficava com metade da largura vazia e
            a venda enterrada no topo de uma pilha.

            A venda ocupa a coluna maior e vem primeiro, porque é o que se faz
            aqui na maior parte das vezes.
          */}
          <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.15fr_1fr]">
            <Bloco titulo="Assinatura">
              <Campo
                rotulo="Plano"
                valor={plano ?? (bruto ? `Não identificado: ${bruto}` : null)}
              />
              {assinatura}
            </Bloco>

            <Bloco titulo="Acessos avulsos">{edicaoDeAcesso}</Bloco>
          </div>
        </TabsContent>

        <TabsContent value="comportamento" className={PAINEL}>
          {comportamento}
        </TabsContent>
      </Tabs>
    </div>
  );
}
