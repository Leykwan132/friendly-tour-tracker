import type { Match, MatchParticipant } from "../types";

function MatchDetailSide({
  title,
  participants,
  isWinner,
}: {
  title: string;
  participants: MatchParticipant[];
  isWinner: boolean;
}) {
  return (
    <div className={`match-detail-side ${title.toLowerCase()}`}>
      <h4>
        {title}
        {isWinner && <span className="match-winner-badge">Winner</span>}
      </h4>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Hero</th>
            <th>K</th>
            <th>D</th>
            <th>A</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => (
            <tr key={p.id}>
              <td>{p.playerName}</td>
              <td>{p.hero}</td>
              <td>{p.kills}</td>
              <td>{p.deaths}</td>
              <td>{p.assists}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MatchDetailPanel({
  match,
  loading,
  error,
}: {
  match?: Match;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return (
      <div className="match-detail">
        <p className="match-detail-status">Loading match details…</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="match-detail">
        <p className="error-message">{error ?? "Failed to load match details"}</p>
      </div>
    );
  }

  return (
    <div className="match-detail">
      <div className="match-detail-sides">
        <MatchDetailSide
          title="Radiant"
          participants={match.radiant ?? []}
          isWinner={match.winnerSide === "radiant"}
        />
        <MatchDetailSide
          title="Dire"
          participants={match.dire ?? []}
          isWinner={match.winnerSide === "dire"}
        />
      </div>
    </div>
  );
}
