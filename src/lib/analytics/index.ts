/**
 * A porta única da telemetria.
 *
 * Quem instrumenta importa daqui — `@/lib/analytics` — e não dos arquivos de
 * dentro. Isso deixa a fronteira visível numa busca só: qualquer
 * `posthog.capture` fora desta pasta é instrumentação que escapou da camada, e
 * a revisão consegue enxergar isso sem ler o diff inteiro.
 *
 * Quando cada evento deve disparar está no catálogo, em
 * docs/catalogo-de-eventos.md, e o comentário de cada função repete o essencial
 * no ponto de uso.
 */

export {
  EVENTOS,
  ORIGENS_DO_JOGO,
  MODOS_DE_ABERTURA,
  ACOES_DA_OPORTUNIDADE,
  TIPOS_DE_CAMPANHA,
  SITUACOES_DE_ASSINATURA,
  CHAVES_PESSOAIS,
  valorControlado,
  propsDaOportunidade,
  idDaOportunidade,
  chavesPessoaisEm,
  type NomeDeEvento,
  type OrigemDoJogo,
  type ModoDeAbertura,
  type AcaoDaOportunidade,
  type TipoDeCampanha,
  type SituacaoDeAssinatura,
  type OportunidadeIdentificavel,
  type DescricaoDaOportunidade,
  type PropsComunsDaOportunidade,
} from './eventos';

export {
  analyticsLigado,
  capturar,
  identificar,
  esquecerPessoa,
  jogoClicado,
  oportunidadeExibida,
  oportunidadeAberta,
  motivosExpandidos,
  analiseAberta,
  ctaClicado,
  apostaRegistrada,
  chegadaDoTelegram,
} from './captura';

export {
  VALIDADE_MS,
  PARAMS_DA_ATRIBUICAO,
  lerAtribuicaoDaUrl,
  tempoDesdeOEnvioMs,
  guardarAtribuicao,
  atribuicaoGuardada,
  encerrarAtribuicao,
  limparAtribuicao,
  chegadaAReportar,
  type AtribuicaoDoTelegram,
} from './atribuicao-telegram';
