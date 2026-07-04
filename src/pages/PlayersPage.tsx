import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { Button } from "@/components/ui/button";
import { PlayersPageSkeleton } from "../components/PageSkeletons";
import type { Player, PlayerStats } from "../types";
import { SortableTable } from "../components/SortableTable";

interface PlayersPageProps {
  refreshKey: number;
  onDataChange: () => void;
}

export function PlayersPage({ refreshKey, onDataChange }: PlayersPageProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [playersData, statsData] = await Promise.all([
        api.getPlayers(),
        api.getPlayerStats(),
      ]);
      setPlayers(playersData);
      setStats(statsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load players");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const statsById = new Map(stats.map((s) => [s.id, s]));

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      await api.createPlayer(newName);
      setNewName("");
      onDataChange();
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to create player");
    }
  }

  async function handleUpdate(id: number) {
    setActionError(null);
    try {
      await api.updatePlayer(id, editName);
      setEditingId(null);
      setEditName("");
      onDataChange();
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to update player");
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete player "${name}"?`)) return;
    setActionError(null);
    try {
      await api.deletePlayer(id);
      onDataChange();
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to delete player");
    }
  }

  if (loading) return <PlayersPageSkeleton />;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Players</h2>
      </div>

      <form className="inline-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Player name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <Button type="submit">Add Player</Button>
      </form>

      {actionError && <p className="error-message">{actionError}</p>}

      <SortableTable
        data={players.map((player) => {
          const stat = statsById.get(player.id);
          return {
            ...player,
            games: stat?.games ?? 0,
            wins: stat?.wins ?? 0,
            losses: stat?.losses ?? 0,
            winPct: stat?.winPct ?? 0,
          };
        })}
        rowKey={(row) => row.id}
        defaultSortKey="name"
        defaultDirection="asc"
        emptyMessage="No players yet. Add your first player above."
        columns={[
          {
            key: "name",
            label: "Name",
            sortValue: (row) => row.name,
            render: (row) =>
              editingId === row.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              ) : (
                row.name
              ),
          },
          {
            key: "games",
            label: "Games",
            align: "center",
            sortValue: (row) => row.games,
          },
          {
            key: "record",
            label: "W-L",
            align: "center",
            sortValue: (row) => row.wins,
            render: (row) => `${row.wins}-${row.losses}`,
          },
          {
            key: "winPct",
            label: "Win %",
            align: "center",
            sortValue: (row) => row.winPct,
            render: (row) => `${row.winPct}%`,
          },
          {
            key: "actions",
            label: "Actions",
            align: "right",
            render: (row) =>
              editingId === row.id ? (
                <div className="action-buttons">
                  <Button type="button" size="sm" onClick={() => void handleUpdate(row.id)}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setEditName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="action-buttons">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(row.id);
                      setEditName(row.name);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDelete(row.id, row.name)}
                  >
                    Delete
                  </Button>
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
