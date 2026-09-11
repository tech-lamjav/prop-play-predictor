import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Bloco } from './Bloco';
import { acessoAtual, estadoDoTeste, PRODUTOS_EDITAVEIS, type ProdutoEditavel } from './crm-acesso';
import type { Pessoa } from './crm-ficha';

export interface MudancaDeAcesso {
  produto: ProdutoEditavel['id'];
  ativo: boolean;
  /** `YYYY-MM-DD`, ou nulo para sem prazo. */
  ate: string | null;
}

/**
 * O que está acontecendo com a escrita neste instante.
 *
 * União discriminada, como o resto do painel. `salvando` guarda QUAL produto
 * está indo, e não um booleano: com um booleano, salvar o Betinho travaria as
 * três linhas e pareceria que a tela congelou.
 */
export type EstadoDaEscrita =
  { tipo: 'parado' } | { tipo: 'salvando'; alvo: string } | { tipo: 'erro'; alvo: string };

/**
 * Uma linha de produto: o interruptor, o prazo e o botão de salvar.
 *
 * O formulário abre com o que JÁ vale, e não em branco. Um formulário em branco
 * sobre um acesso que existe é um convite a apagá-lo sem querer: o sócio mexe
 * numa coisa, salva, e zera as outras.
 */
function LinhaDoProduto({
  produto,
  pessoa,
  escrita,
  aoSalvar,
}: {
  produto: ProdutoEditavel;
  pessoa: Pessoa;
  escrita: EstadoDaEscrita;
  aoSalvar: (mudanca: MudancaDeAcesso) => void;
}) {
  const atual = acessoAtual(pessoa, produto.id);
  const [ativo, setAtivo] = useState(atual.ativo);
  const [ate, setAte] = useState(atual.ate);

  const salvando = escrita.tipo === 'salvando' && escrita.alvo === produto.id;
  const falhou = escrita.tipo === 'erro' && escrita.alvo === produto.id;
  // Sem mudança não há o que salvar, e um botão sempre aceso convida a gravar
  // de novo o mesmo valor: cada gravação escreve um registro na linha do tempo,
  // e a linha encheria de "Betinho: liberou" repetido.
  const mudou = ativo !== atual.ativo || (produto.temPrazo && ate !== atual.ate);

  return (
    <div className="border-t border-line-2 py-3 first:border-t-0 first:pt-0">
      <label className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-bold text-ink">{produto.nome}</span>
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={ativo}
            disabled={salvando}
            onChange={(e) => setAtivo(e.target.checked)}
            aria-label={`Acesso ao ${produto.nome}`}
          />
          {ativo ? 'Liberado' : 'Sem acesso'}
        </span>
      </label>

      {produto.temPrazo ? (
        <label className="mt-2 flex items-center gap-2 text-[12px] text-ink-2">
          até
          <input
            type="date"
            value={ate}
            disabled={salvando || !ativo}
            onChange={(e) => setAte(e.target.value)}
            aria-label={`Acesso ao ${produto.nome} até`}
            className="h-9 flex-1 rounded-rebrand-sm border border-line-2 bg-white px-2 text-[13px] text-ink disabled:opacity-50"
          />
        </label>
      ) : (
        /* O banco não guarda prazo do futebol, e está documentado em
           `shared/concessoes.ts`. O aviso fica ONDE o sócio escolhe: depois de
           digitar uma data que seria descartada já é tarde. */
        <p className="mt-2 text-[12px] text-ink-2">
          O banco não guarda prazo do futebol. Liberado aqui vale até alguém tirar.
        </p>
      )}

      {falhou && (
        <p className="mt-2 text-[13px] font-bold text-ink">
          Não deu para gravar. O acesso continua como estava.
        </p>
      )}

      <button
        type="button"
        disabled={!mudou || salvando}
        onClick={() => aoSalvar({ produto: produto.id, ativo, ate: ativo && ate ? ate : null })}
        className="mt-2 h-9 rounded-rebrand-sm bg-forest px-3 text-[13px] font-bold text-white disabled:opacity-40"
      >
        {salvando ? 'Gravando…' : `Salvar ${produto.nome}`}
      </button>
    </div>
  );
}

/**
 * O teste gratuito de sete dias.
 *
 * Controle separado dos produtos de cima, e é de propósito: o teste NÃO é
 * status de assinatura, é um carimbo de início de onde se contam sete dias.
 * Junto com os outros, ele viraria um quarto interruptor, e desligar o premium
 * do futebol apagaria o teste da pessoa sem ninguém pedir.
 *
 * Três estados, e não dois: nunca testou, está correndo, já venceu. O terceiro
 * é justamente o que o sócio precisa saber antes de dar outro.
 */
function Teste({
  pessoa,
  escrita,
  aoDefinir,
}: {
  pessoa: Pessoa;
  escrita: EstadoDaEscrita;
  aoDefinir: (ligado: boolean) => void;
}) {
  const estado = estadoDoTeste(pessoa);
  const salvando = escrita.tipo === 'salvando' && escrita.alvo === 'teste';
  const falhou = escrita.tipo === 'erro' && escrita.alvo === 'teste';

  const situacao =
    estado.tipo === 'nunca'
      ? 'Nunca usou o teste.'
      : estado.tipo === 'correndo'
        ? `Correndo, termina em ${estado.terminaEm} (${estado.diasRestantes} ${
            estado.diasRestantes === 1 ? 'dia' : 'dias'
          }).`
        : `Já usou. Terminou em ${estado.terminouEm}.`;

  const ligado = estado.tipo === 'correndo';

  return (
    <div className="border-t border-line-2 pt-3">
      <p className="text-[14px] font-bold text-ink">Teste do futebol</p>
      <p className="mt-1 text-[12px] text-ink-2">{situacao}</p>

      {falhou && (
        <p className="mt-2 text-[13px] font-bold text-ink">
          Não deu para gravar. O teste continua como estava.
        </p>
      )}

      <button
        type="button"
        disabled={salvando}
        onClick={() => aoDefinir(!ligado)}
        className="mt-2 h-9 rounded-rebrand-sm border border-line-2 bg-white px-3 text-[13px] font-bold text-ink hover:border-forest hover:text-forest disabled:opacity-40"
      >
        {salvando
          ? 'Gravando…'
          : ligado
            ? 'Encerrar o teste agora'
            : estado.tipo === 'vencido'
              ? 'Dar mais sete dias'
              : 'Começar sete dias agora'}
      </button>
    </div>
  );
}

/**
 * Mexer no acesso de alguém sem sair da ficha.
 *
 * ⚠️ As colunas mexidas aqui são as mesmas que o webhook do Stripe escreve. Um
 * acesso dado na mão vale até o Stripe falar sobre aquela pessoa, e aí ele
 * vence. É assim de propósito — se o CRM ganhasse do webhook, um clique errado
 * viraria assinatura eterna de graça —, e o aviso fica na tela porque é o tipo
 * de coisa que só aparece três semanas depois, quando o acesso "some sozinho".
 *
 * Cada gravação deixa um registro na linha do tempo, ao lado das anotações:
 * daqui a três meses alguém vai perguntar por que essa pessoa tem o Completo
 * sem nunca ter pago, e a resposta precisa estar junto do resto da conversa.
 */
export function EditorDeAcesso({
  pessoa,
  escrita,
  aoSalvar,
  aoDefinirTeste,
}: {
  pessoa: Pessoa;
  escrita: EstadoDaEscrita;
  aoSalvar: (mudanca: MudancaDeAcesso) => void;
  aoDefinirTeste: (ligado: boolean) => void;
}) {
  return (
    <Bloco titulo="Dar acesso na mão">
      <p className="mb-3 flex gap-2 rounded-rebrand-sm bg-amber-400/10 p-2.5 text-[12px] text-ink">
        <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Vale até o Stripe falar sobre esta pessoa. Quando ela assinar ou cancelar, o que vier de
          lá manda. Toda mudança fica registrada na linha do tempo.
        </span>
      </p>

      {PRODUTOS_EDITAVEIS.map((produto) => (
        <LinhaDoProduto
          // A chave inclui o valor atual do banco: depois de gravar, a ficha
          // recarrega e a linha precisa nascer de novo com o valor novo. Sem
          // isso o `useState` de dentro guarda o que o sócio digitou e a tela
          // passa a mostrar o rascunho como se fosse o que está gravado.
          key={`${produto.id}:${JSON.stringify(acessoAtual(pessoa, produto.id))}`}
          produto={produto}
          pessoa={pessoa}
          escrita={escrita}
          aoSalvar={aoSalvar}
        />
      ))}

      <Teste pessoa={pessoa} escrita={escrita} aoDefinir={aoDefinirTeste} />
    </Bloco>
  );
}
