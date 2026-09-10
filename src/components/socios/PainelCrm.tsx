import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  agruparPorDia,
  buscar,
  contadores,
  ehAssinante,
  formatarDia,
  type Cadastro,
} from './crm-lista';
import { ETAPAS, ROTA_DOS_SOCIOS, ROTULO_DA_ETAPA, type Etapa } from './crm-vocabulario';
import type { EtapasGravadas } from './crm-funil';
import { etapaDe, filtrarPorEtapa } from './crm-funil';
import type { EstadoDasEtapas } from '@/hooks/use-etapas';

/**
 * O que a tela sabe no momento em que desenha.
 *
 * Três estados num tipo só, e não campos soltos. Com `cadastros` e `carregando`
 * separados existiria a combinação "sem dados e sem carregar", que não quer
 * dizer nada e cairia no galho da base vazia — a tela mentiria "nenhum
 * cadastro" justamente quando a consulta falhasse.
 *
 * `totalNaBase` vem junto porque a consulta tem teto. Sem ele, uma base que
 * passasse do teto seria desenhada inteira, com os contadores contando só a
 * fatia — dois números errados sem nada denunciando.
 */
export type EstadoDoPainel =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; cadastros: Cadastro[]; totalNaBase: number };

/** Um array novo a cada render invalidaria os useMemo abaixo sem nada ter mudado. */
const VAZIO: Cadastro[] = [];

/** Mesmo motivo: um mapa novo a cada render invalidaria os useMemo à toa. */
const SEM_ETAPAS: EtapasGravadas = {};

function Contador({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex-1">
      <p className="font-display text-3xl font-black tabular-nums text-ink" aria-label={rotulo}>
        {valor}
      </p>
      <p className="mt-0.5 text-[12px] text-ink-2">{rotulo.toLowerCase()}</p>
    </div>
  );
}

function LinhaDoCadastro({ cadastro, etapa }: { cadastro: Cadastro; etapa: Etapa | null }) {
  const contato = [cadastro.name ? cadastro.email : null, cadastro.whatsapp_number]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="border-t border-line-2 first:border-t-0">
      <Link
        to={`${ROTA_DOS_SOCIOS}/${cadastro.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-canvas"
      >
        <div className="min-w-0 flex-1">
          {/* Sem nome, o e-mail sobe para a linha principal em vez de deixar uma
              faixa em branco onde deveria estar a pessoa. */}
          <p className="truncate text-[15px] font-bold text-ink">
            {cadastro.name ?? cadastro.email}
          </p>
          {contato ? <p className="truncate text-[13px] text-ink-2">{contato}</p> : null}
        </div>
        {etapa ? (
          <span className="shrink-0 rounded-full border border-line-2 px-2.5 py-1 text-[11px] font-bold text-ink-2">
            {ROTULO_DA_ETAPA[etapa]}
          </span>
        ) : null}
        {ehAssinante(cadastro) ? (
          <span className="shrink-0 rounded-full bg-forest px-2.5 py-1 text-[11px] font-bold text-white">
            Assinante
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * O painel dos sócios: os cadastros agrupados pelo dia em que nasceram.
 *
 * A busca mora aqui e não no container porque ela não toca o banco — a base
 * inteira já veio, e filtrar seiscentas linhas em memória é instantâneo. Uma
 * busca que fosse ao servidor a cada tecla seria mais código e mais lenta.
 *
 * `hoje` chega por prop em vez de ser lido do relógio aqui dentro: assim o
 * teste manda o dia e a tela não muda de comportamento à meia-noite.
 */
export function PainelCrm({
  estado,
  etapas,
  hoje,
}: {
  estado: EstadoDoPainel;
  etapas: EstadoDasEtapas;
  hoje: string;
}) {
  const [busca, setBusca] = useState('');
  const [etapa, setEtapa] = useState<Etapa | null>(null);

  const cadastros = estado.tipo === 'pronto' ? estado.cadastros : VAZIO;
  const gravadas = etapas.tipo === 'pronto' ? etapas.etapas : SEM_ETAPAS;
  // Sem as etapas na mão, o crachá some em vez de afirmar "Novo" para todo
  // mundo — e o filtro sai do ar em vez de devolver a base inteira em qualquer
  // etapa que o sócio escolher.
  const temEtapas = etapas.tipo === 'pronto';
  const filtrados = useMemo(
    () => filtrarPorEtapa(buscar(cadastros, busca), gravadas, temEtapas ? etapa : null),
    [cadastros, busca, gravadas, temEtapas, etapa],
  );
  const dias = useMemo(() => agruparPorDia(filtrados), [filtrados]);
  const numeros = useMemo(() => contadores(filtrados, hoje), [filtrados, hoje]);

  const baseVazia = estado.tipo === 'pronto' && estado.cadastros.length === 0;
  const truncada = estado.tipo === 'pronto' && estado.totalNaBase > estado.cadastros.length;

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-forest">
          Uso interno
        </p>
        <h1 className="mt-2 font-display text-4xl font-black text-ink">CRM</h1>

        {estado.tipo === 'carregando' && (
          <p className="mt-8 text-[15px] text-ink-2">Carregando os cadastros…</p>
        )}

        {estado.tipo === 'erro' && (
          <p className="mt-8 text-[15px] text-ink-2">Não deu para carregar os cadastros agora.</p>
        )}

        {baseVazia && <p className="mt-8 text-[15px] text-ink-2">Nenhum cadastro na base.</p>}

        {estado.tipo === 'pronto' && !baseVazia && (
          <>
            {/* O aviso vem ANTES dos números de propósito: com a base truncada
                eles contam a fatia, e um número errado sem aviso é pior que
                número nenhum. */}
            {truncada && (
              <p className="mt-8 rounded-rebrand-sm border border-line-2 bg-white px-4 py-3 text-[13px] text-ink-2">
                A base passou do teto da consulta. Estes são os {estado.cadastros.length} cadastros
                mais recentes de {estado.totalNaBase}, e os números abaixo contam só eles.
              </p>
            )}

            <section
              role="region"
              aria-label="Resumo da base"
              className="mt-6 flex gap-4 rounded-rebrand-md border border-line-2 bg-white p-5"
            >
              <Contador rotulo="Cadastros hoje" valor={numeros.hoje} />
              <Contador rotulo="Cadastros na semana" valor={numeros.semana} />
              <Contador rotulo="Assinantes" valor={numeros.assinantes} />
            </section>

            <div className="mt-6 flex gap-3">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                aria-label="Buscar cadastro"
                className="h-11 flex-1 rounded-rebrand-sm border border-line-2 bg-white px-4 text-[15px] text-ink placeholder:text-ink-3"
              />
              <select
                value={etapa ?? ''}
                disabled={!temEtapas}
                onChange={(e) => setEtapa((e.target.value || null) as Etapa | null)}
                aria-label="Filtrar por etapa"
                className="h-11 rounded-rebrand-sm border border-line-2 bg-white px-3 text-[15px] text-ink"
              >
                <option value="">Todas as etapas</option>
                {ETAPAS.map((e) => (
                  <option key={e} value={e}>
                    {ROTULO_DA_ETAPA[e]}
                  </option>
                ))}
              </select>
            </div>

            <section role="region" aria-label="Cadastros por dia" className="mt-6">
              {dias.length === 0 ? (
                <p className="text-[15px] text-ink-2">Nenhum cadastro encontrado com esses filtros.</p>
              ) : (
                dias.map((grupo) => (
                  <div key={grupo.dia ?? 'sem-data'} className="mb-6">
                    <h2 className="mb-2 font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-ink-2">
                      {grupo.dia ? formatarDia(grupo.dia) : 'Sem data de cadastro'}
                      <span className="ml-2 font-sans normal-case tracking-normal text-ink-3">
                        {grupo.cadastros.length}
                      </span>
                    </h2>
                    <ul className="rounded-rebrand-md border border-line-2 bg-white">
                      {grupo.cadastros.map((c) => (
                        <LinhaDoCadastro
                          key={c.id}
                          cadastro={c}
                          etapa={temEtapas ? etapaDe(gravadas, c.id) : null}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
