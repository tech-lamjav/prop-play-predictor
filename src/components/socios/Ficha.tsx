import type { ReactNode } from 'react';
import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { ETAPAS, ROTULO_DA_ETAPA, type Etapa } from './crm-vocabulario';
import { Bloco } from './Bloco';
import { MensagemPronta } from './MensagemPronta';
import { mensagemPara } from './crm-mensagens';
import {
  acessos,
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

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line-2 py-2 first:border-t-0 first:pt-0">
      <span className="text-[13px] text-ink-2">{rotulo}</span>
      {/* Sem valor, a palavra explícita. Um campo em branco é lido como dado, e
          o que existe aqui é a ausência dele. */}
      <span className="text-right text-[14px] text-ink">
        {valor ?? <span className="text-ink-2">não informado</span>}
      </span>
    </div>
  );
}

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
}) {
  const plano = nomeDoPlano(pessoa.subscription_product_type);
  const bruto = (pessoa.subscription_product_type ?? '').trim();
  const gancho = ganchoDe(pessoa, apostas);
  const cadastroEm = dia(pessoa.created_at);
  const ultimaAposta = apostas?.ultima ? dia(apostas.ultima) : null;

  return (
    <div className="flex max-h-[82vh] flex-col">
      {/* Sem nome, o e-mail vira o título: a ficha precisa ter uma pessoa no
          topo, e não uma faixa vazia. */}
      <div className="border-b border-line-2 bg-white px-6 py-5">
        <h1 className="font-display text-2xl font-black text-ink">{pessoa.name ?? pessoa.email}</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          {cadastroEm ? `Cadastrou em ${cadastroEm}` : 'Sem data de cadastro no banco'}
        </p>
      </div>

      {/*
        Duas colunas, e a divisão é a tese do formato escolhido no protótipo:
        à esquerda o que é CONSULTA — você olha uma vez e não olha mais —, e à
        direita o que é TRABALHO: o palpite, a mensagem e o registro do que
        aconteceu. A versão anterior empilhava os seis blocos com o mesmo peso,
        e era isso que fazia a ficha parecer formulário.
      */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
        <div className="space-y-4 overflow-y-auto border-line-2 bg-white p-5 md:border-r">
          <Bloco titulo="Etapa">
            <select
              value={etapa ?? ''}
              disabled={mudandoEtapa || etapa === null}
              onChange={(e) => aoMudarEtapa(e.target.value as Etapa)}
              aria-label="Etapa do lead"
              className="h-11 w-full rounded-rebrand-sm border border-line-2 bg-white px-3 text-[15px] text-ink disabled:opacity-60"
            >
              {etapa === null ? <option value="">Carregando…</option> : null}
              {ETAPAS.map((e) => (
                <option key={e} value={e}>
                  {ROTULO_DA_ETAPA[e]}
                </option>
              ))}
            </select>
            {/* Travar enquanto grava não é detalhe de conforto: duas mudanças em
            voo gravariam dois eventos, e o segundo registraria um "de" que já
            não era verdade. */}
            {/* A frase de rodapé é uma promessa. Quando a gravação falha ela vira
            mentira exatamente no momento em que nada foi registrado, e o
            seletor ainda volta sozinho para a etapa antiga — sem aviso, parece
            um clique que não pegou. */}
            {erroAoMudarEtapa ? (
              <p className="mt-2 text-[13px] font-bold text-ink">
                Não deu para gravar a etapa. Ela continua como estava.
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-ink-2">
                {mudandoEtapa
                  ? 'Gravando…'
                  : 'Cada mudança fica registrada, com quem mudou e quando.'}
              </p>
            )}
          </Bloco>

          <Bloco titulo="Contatos">
            <Campo rotulo="E-mail" valor={pessoa.email} />
            <Campo rotulo="WhatsApp" valor={pessoa.whatsapp_number} />
            <Campo
              rotulo="Telegram"
              valor={
                pessoa.telegram_username
                  ? `@${pessoa.telegram_username}${pessoa.telegram_synced ? '' : ' (não vinculado)'}`
                  : null
              }
            />
          </Bloco>

          <Bloco titulo="Planos e acessos">
            <Campo rotulo="Plano" valor={plano ?? (bruto ? `Não identificado: ${bruto}` : null)} />
            {acessos(pessoa).map((a) => (
              <Campo
                key={a.produto}
                rotulo={a.produto}
                valor={
                  a.ativo
                    ? a.renovaEm
                      ? `Ativo · renova em ${dia(a.renovaEm)}`
                      : a.semDataNoBanco
                        ? 'Ativo · o banco não guarda a renovação do futebol'
                        : 'Ativo'
                    : 'Sem acesso'
                }
              />
            ))}
          </Bloco>

          {comportamento}
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <Bloco titulo="Gancho">
            <p className="text-[15px] text-ink">
              <span className="font-bold">Palpite:</span> {COMO_CHAMAR[gancho.tipo]}
            </p>
            <p className="mt-1 text-[13px] text-ink-2">Porque {gancho.porque}.</p>
            {ultimaAposta ? (
              <p className="mt-1 text-[13px] text-ink-2">Última aposta em {ultimaAposta}.</p>
            ) : null}
            {/* A aposta é o sinal mais forte e o primeiro da fila. Sem ela, o
                palpite abaixo pode estar apontando para o lado errado, e o
                sócio precisa saber disso antes de abrir a conversa. */}
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
        </div>
      </div>
    </div>
  );
}
