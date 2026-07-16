import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { MatchDetailPanel } from "./MatchDetail";
import { SortableTable } from "./SortableTable";
import type { Match } from "../types";

interface MatchesTableProps {
  matches: Match[];
  emptyMessage?: string;
  initialLimit?: number;
  renderActions?: (match: Match) => React.ReactNode;
}

function formatMvp(match: Match) {
  if (!match.mvp) return "—";
  const { playerName, hero, kills, deaths, assists } = match.mvp;
  return `${playerName} · ${hero} ${kills}/${deaths}/${assists}`;
}

function teamSizeLabel(match: Match) {
  const count = match.participantCount ?? 0;
  if (count <= 0) return "—";
  const perSide = count / 2;
  if (Number.isInteger(perSide)) return `${perSide}v${perSide}`;
  return `${count}`;
}

export function MatchesTable({
  matches,
  emptyMessage = "No matches recorded yet.",
  initialLimit,
  renderActions,
}: MatchesTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, Match>>({});
  const [expandLoadingId, setExpandLoadingId] = useState<number | null>(null);
  const [expandError, setExpandError] = useState<string | null>(null);

  useEffect(() => {
    const ids = new Set(matches.map((match) => match.id));
    setExpandedDetails((current) => {
      const next: Record<number, Match> = {};
      for (const [id, detail] of Object.entries(current)) {
        const matchId = Number(id);
        if (ids.has(matchId)) next[matchId] = detail;
      }
      return next;
    });
    setExpandedId((current) => (current != null && ids.has(current) ? current : null));
  }, [matches]);

  async function toggleMatchDetails(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandError(null);
      return;
    }

    setExpandedId(id);
    setExpandError(null);

    if (expandedDetails[id]) return;

    setExpandLoadingId(id);
    try {
      const match = await api.getMatch(id);
      setExpandedDetails((current) => ({ ...current, [id]: match }));
    } catch (e) {
      setExpandError(e instanceof ApiError ? e.message : "Failed to load match details");
    } finally {
      setExpandLoadingId(null);
    }
  }

  return (
    <SortableTable
      data={matches}
      rowKey={(row) => row.id}
      defaultSortKey="sortOrder"
      defaultDirection="asc"
      emptyMessage={emptyMessage}
      initialLimit={initialLimit}
      expandedRowKey={expandedId}
      onRowClick={(row) => void toggleMatchDetails(row.id)}
      renderExpandedRow={(row) => (
        <MatchDetailPanel
          match={expandedDetails[row.id]}
          loading={expandLoadingId === row.id}
          error={expandError}
        />
      )}
      columns={[
        {
          key: "sortOrder",
          label: "#",
          align: "center",
          sortValue: (row) => row.sortOrder,
        },
        {
          key: "playedAt",
          label: "Date",
          sortValue: (row) => row.playedAt,
        },
        {
          key: "score",
          label: "Score",
          align: "center",
          sortValue: (row) => (row.radiantKills ?? 0) + (row.direKills ?? 0),
          render: (row) => (
            <span className={`match-score ${row.winnerSide}`}>
              <span className={row.winnerSide === "radiant" ? "score-winner" : undefined}>
                {row.radiantKills ?? 0}
              </span>
              <span className="score-sep">–</span>
              <span className={row.winnerSide === "dire" ? "score-winner" : undefined}>
                {row.direKills ?? 0}
              </span>
            </span>
          ),
        },
        {
          key: "mvp",
          label: "MVP",
          sortValue: (row) => row.mvp?.kills ?? -1,
          render: (row) =>
            row.mvp ? (
              <span className="match-mvp" title={formatMvp(row)}>
                <span className="match-mvp-name">{row.mvp.playerName}</span>
                <span className="match-mvp-meta">
                  {row.mvp.hero} · {row.mvp.kills}/{row.mvp.deaths}/{row.mvp.assists}
                </span>
              </span>
            ) : (
              "—"
            ),
        },
        {
          key: "format",
          label: "Fmt",
          align: "center",
          sortValue: (row) => row.participantCount ?? 0,
          render: (row) => teamSizeLabel(row),
        },
        ...(renderActions
          ? [
              {
                key: "actions",
                label: "Actions",
                align: "right" as const,
                render: (row: Match) => (
                  <div className="action-buttons" onClick={(event) => event.stopPropagation()}>
                    {renderActions(row)}
                  </div>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
