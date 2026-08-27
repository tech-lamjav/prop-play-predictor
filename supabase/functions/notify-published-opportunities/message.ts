import { esc } from "../shared/format.ts";

export interface PublishedMessageOpportunity {
  alert_id: string;
  fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  competition: string | null;
  kickoff_utc: string;
  market: string;
  outcome: string;
  line_value: number | null;
  best_odd: number;
  score: number;
  faixa: string;
  evidencias: string[] | null;
}

function kickoffDate(value: string): Date {
  return new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
}

function brtHourMin(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(kickoffDate(value));
}

function fmtHandicapLine(line: number): string {
  const sign = line > 0 ? "+" : line < 0 ? "−" : "";
  return `${sign}${String(Math.abs(line)).replace(".", ",")}`;
}

function outcomePt(
  outcome: string,
  homeName: string,
  awayName: string,
): string {
  if (outcome === "Home") return homeName;
  if (outcome === "Away") return awayName;
  if (outcome === "Draw") return "Empate";
  return outcome;
}

export function publishedPickLabel(
  row: Pick<
    PublishedMessageOpportunity,
    "market" | "outcome" | "line_value" | "home_team_name" | "away_team_name"
  >,
): string {
  if (row.market === "goals_over_under") {
    const line = row.line_value == null
      ? ""
      : String(row.line_value).replace(".", ",");
    return row.outcome === "Over"
      ? `Mais de ${line} gols`
      : `Menos de ${line} gols`;
  }
  if (row.market === "asian_handicap") {
    const team = row.outcome === "Home"
      ? row.home_team_name
      : row.away_team_name;
    const line = row.line_value == null
      ? null
      : (row.outcome === "Away" ? -row.line_value : row.line_value);
    return line == null ? team : `${team} ${fmtHandicapLine(line)}`;
  }
  if (row.market === "btts") {
    return row.outcome === "Yes" ? "Ambos marcam: Sim" : "Ambos marcam: Não";
  }
  if (row.market === "double_chance") {
    return row.outcome === "1X"
      ? `${row.home_team_name} ou empate`
      : `Empate ou ${row.away_team_name}`;
  }
  if (row.market === "match_winner") {
    return `Vitória: ${
      outcomePt(row.outcome, row.home_team_name, row.away_team_name)
    }`;
  }
  return outcomePt(row.outcome, row.home_team_name, row.away_team_name);
}

export function publishedMessageText(
  opportunities: PublishedMessageOpportunity[],
  opportunityUrls: ReadonlyMap<string, string>,
): string {
  const detailed = [...opportunities].sort((a, b) => b.score - a.score).slice(
    0,
    3,
  );
  const title = opportunities.length === 1
    ? "⚽ <b>Nova oportunidade mapeada</b>"
    : `⚽ <b>Novas oportunidades mapeadas</b> · ${opportunities.length} no painel`;
  const lines = [title, ""];

  for (const opportunity of detailed) {
    const gameUrl = opportunityUrls.get(opportunity.alert_id) ??
      "https://www.smartbetting.app/futebol/oportunidades";
    const evidence = opportunity.evidencias?.[0]
      ? `\n✓ ${esc(opportunity.evidencias[0])}`
      : "";
    lines.push(
      `<a href="${gameUrl}"><b>${esc(opportunity.home_team_name)} × ${
        esc(opportunity.away_team_name)
      }</b></a> · ${brtHourMin(opportunity.kickoff_utc)}`,
      `${
        esc(publishedPickLabel(opportunity))
      } · odd ${opportunity.best_odd} · Score <b>${opportunity.score} · ${
        esc(opportunity.faixa)
      }</b>${evidence}`,
      "",
    );
  }

  const extra = opportunities.length - detailed.length;
  if (extra > 0) {
    lines.push(
      `<i>+ ${extra} ${
        extra === 1 ? "oportunidade no painel" : "oportunidades no painel"
      }.</i>`,
      "",
    );
  }
  lines.push("<i>Leitura de risco, não recomendação de aposta.</i>");
  return lines.join("\n");
}
