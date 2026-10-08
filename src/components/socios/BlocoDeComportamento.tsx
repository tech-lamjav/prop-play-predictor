import { useTranslation } from 'react-i18next';
import { brtDayOf } from '@/utils/futebol-datas';
import { formatarDia } from './crm-lista';
import { historiaTruncada, tempoDeTela } from './crm-comportamento';
import type { EstadoDoComportamento } from '@/hooks/use-comportamento';
import { Bloco } from './Bloco';

const dia = (carimbo: string | null) => {
  const d = brtDayOf(carimbo);
  return d ? formatarDia(d) : null;
};

/**
 * O que o PostHog sabe sobre a pessoa.
 *
 * O bloco existia desde a primeira volta como lugar reservado, dizendo que os
 * números moravam no PostHog e ainda não estavam aqui. Agora estão.
 *
 * ⚠️ Ele diz de quando a história começa, e não só os totais. Se o plano do
 * PostHog descartou o que era antigo, "2 sessões" para quem se cadastrou em
 * março parece abandono — e pode ser só retenção de dados. O aviso é o que
 * separa as duas leituras.
 */
export function BlocoDeComportamento({
  estado,
  cadastradoEm,
}: {
  estado: EstadoDoComportamento;
  cadastradoEm: string | null;
}) {
  const { t } = useTranslation('socios');

  if (estado.tipo === 'carregando') {
    return (
      <Bloco titulo={t('ficha.comportamento.titulo')}>
        <p className="text-[13px] text-ink-2">{t('ficha.comportamento.consultando')}</p>
      </Bloco>
    );
  }

  if (estado.tipo === 'erro') {
    const semChave = estado.motivo.includes('sem_chave');
    return (
      <Bloco titulo={t('ficha.comportamento.titulo')}>
        <p className="text-[13px] text-ink-2">
          {semChave ? t('ficha.comportamento.semChave') : t('ficha.comportamento.erro')}
        </p>
      </Bloco>
    );
  }

  const { comportamento: c } = estado;
  const primeiro = dia(c.primeiroEvento);
  const ultimo = dia(c.ultimoEvento);

  if (c.sessoes === 0) {
    // ⚠️ O texto NÃO afirma que a pessoa não voltou.
    //
    // Ele afirmava, e estava errado no primeiro teste real: o sócio que estava
    // usando o produto naquele instante apareceu como quem nunca voltou. A
    // busca por identificador e por e-mail ainda não encontra todo mundo, e
    // enquanto isso for verdade a frase tem de falar do que ACHAMOS, e não do
    // que a pessoa fez. Está registrado na #397.
    //
    // Zero evento na pessoa E zero no projeto inteiro é outra coisa: é a
    // função perguntando no lugar errado. Dizer "não voltou ao site" aí seria
    // uma afirmação sobre alguém, feita com base numa falha de configuração.
    const projetoMudo = c.eventosNoProjetoNaSemana === 0;

    return (
      <Bloco titulo={t('ficha.comportamento.titulo')}>
        <p className="text-[13px] text-ink-2">
          {projetoMudo ? t('ficha.comportamento.projetoMudo') : t('ficha.comportamento.semVisita')}
        </p>
      </Bloco>
    );
  }

  return (
    <Bloco titulo={t('ficha.comportamento.titulo')}>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <p
            className="font-display text-xl font-black tabular-nums text-ink"
            aria-label={t('ficha.comportamento.sessoes')}
          >
            {c.sessoes}
          </p>
          {/* Plural pelo `count` do catálogo, e não por ternário no código: em
              espanhol a regra de plural não é a mesma, e um ternário aqui
              decidiria por ela. */}
          <p className="text-[12px] text-ink-2">
            {t('ficha.comportamento.visitas', { count: c.sessoes })}
          </p>
        </div>
        <div>
          {/* ⚠️ `tempoDeTela` vem de `crm-comportamento.ts` e ainda devolve
              PORTUGUÊS ("menos de 1min", "sem tempo registrado"): não foi
              migrado neste passo. */}
          <p
            className="text-[15px] font-bold text-ink"
            aria-label={t('ficha.comportamento.tempoDeTela')}
          >
            {tempoDeTela(c.segundosDeTela)}
          </p>
          <p className="text-[12px] text-ink-2">{t('ficha.comportamento.deTelaSomado')}</p>
        </div>
        {ultimo && (
          <div>
            <p
              className="text-[15px] font-bold text-ink"
              aria-label={t('ficha.comportamento.ultimaVisita')}
            >
              {ultimo}
            </p>
            <p className="text-[12px] text-ink-2">{t('ficha.comportamento.ultimaVisitaRotulo')}</p>
          </div>
        )}
      </div>

      {c.paginas.length > 0 && (
        <ul className="mt-3 border-t border-line-2 pt-2">
          {c.paginas.map((p) => (
            <li key={p.caminho} className="flex justify-between gap-3 py-0.5 text-[13px]">
              <span className="truncate text-ink-2">
                {p.caminho || t('ficha.comportamento.semCaminho')}
              </span>
              <span className="tabular-nums text-ink">{p.vezes}</span>
            </li>
          ))}
        </ul>
      )}

      {historiaTruncada(c, cadastradoEm) && primeiro && (
        <p className="mt-3 text-[12px] text-ink-2">
          {t('ficha.comportamento.historiaTruncada', { desde: primeiro })}
        </p>
      )}
    </Bloco>
  );
}
