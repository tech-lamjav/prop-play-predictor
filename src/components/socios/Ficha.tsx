import { Link } from 'react-router-dom';
import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { ROTA_DOS_SOCIOS } from './crm-vocabulario';
import {
  acessos,
  ganchoDe,
  nomeDoPlano,
  type Pessoa,
  type ResumoDeApostas,
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

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section
      role="region"
      aria-label={titulo}
      className="mt-6 rounded-rebrand-md border border-line-2 bg-white p-5"
    >
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-2">
        {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line-2 py-2 first:border-t-0 first:pt-0">
      <span className="text-[13px] text-ink-2">{rotulo}</span>
      {/* Sem valor, a palavra explícita. Um campo em branco é lido como dado, e
          o que existe aqui é a ausência dele. */}
      <span className="text-right text-[14px] text-ink">
        {valor ?? <span className="text-ink-3">não informado</span>}
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
export function Ficha({ estado }: { estado: EstadoDaFicha }) {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to={ROTA_DOS_SOCIOS} className="text-[13px] font-bold text-forest hover:underline">
          ← Voltar para a lista
        </Link>

        {estado.tipo === 'carregando' && (
          <p className="mt-8 text-[15px] text-ink-2">Carregando a ficha…</p>
        )}
        {estado.tipo === 'erro' && (
          <p className="mt-8 text-[15px] text-ink-2">Não deu para carregar a ficha agora.</p>
        )}
        {estado.tipo === 'nao-encontrada' && (
          <p className="mt-8 text-[15px] text-ink-2">Não encontramos esse cadastro.</p>
        )}

        {estado.tipo === 'pronta' && <Conteudo {...estado} />}
      </div>
    </div>
  );
}

function Conteudo({ pessoa, apostas }: { pessoa: Pessoa; apostas: ResumoDeApostas | null }) {
  const plano = nomeDoPlano(pessoa.subscription_product_type);
  const bruto = (pessoa.subscription_product_type ?? '').trim();
  const gancho = ganchoDe(pessoa, apostas);
  const cadastroEm = dia(pessoa.created_at);
  const ultimaAposta = apostas?.ultima ? dia(apostas.ultima) : null;

  return (
    <>
      {/* Sem nome, o e-mail vira o título: a ficha precisa ter uma pessoa no
          topo, e não uma faixa vazia. */}
      <h1 className="mt-4 font-display text-3xl font-black text-ink">
        {pessoa.name ?? pessoa.email}
      </h1>
      <p className="mt-1 text-[13px] text-ink-2">
        {cadastroEm ? `Cadastrou em ${cadastroEm}` : 'Sem data de cadastro no banco'}
      </p>

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
        <Campo
          rotulo="Plano"
          valor={plano ?? (bruto ? `Não identificado: ${bruto}` : null)}
        />
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

      <Bloco titulo="Gancho">
        <p className="text-[15px] text-ink">
          <span className="font-bold">Palpite:</span> {COMO_CHAMAR[gancho.tipo]}
        </p>
        <p className="mt-1 text-[13px] text-ink-2">Porque {gancho.porque}.</p>
        {ultimaAposta ? (
          <p className="mt-1 text-[13px] text-ink-2">Última aposta em {ultimaAposta}.</p>
        ) : null}
        {/* A aposta é o sinal mais forte e o primeiro da fila. Sem ela, o
            palpite abaixo pode estar apontando para o lado errado, e o sócio
            precisa saber disso antes de abrir a conversa. */}
        {gancho.apostasDesconhecidas ? (
          <p className="mt-2 text-[13px] font-bold text-ink">
            Não deu para consultar as apostas, então este palpite está incompleto.
          </p>
        ) : null}
        <p className="mt-3 text-[12px] text-ink-3">
          É leitura do que o banco registrou, não do que a pessoa disse.
        </p>
      </Bloco>

      <Bloco titulo="Comportamento">
        <p className="text-[14px] text-ink-2">
          Páginas vistas, número de sessões e tempo de tela ainda não aparecem aqui. Esses números
          moram no PostHog, e trazê-los exige uma função no servidor.
        </p>
      </Bloco>
    </>
  );
}
