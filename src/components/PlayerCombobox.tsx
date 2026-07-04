import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { Player } from "@/types";

type PlayerItem = {
  label: string;
  value: string;
};

interface PlayerComboboxProps {
  players: Player[];
  value: string;
  onChange: (playerId: string) => void;
}

export function PlayerCombobox({ players, value, onChange }: PlayerComboboxProps) {
  const items = useMemo((): PlayerItem[] => {
    const mapped = players.map((player) => ({
      label: player.name,
      value: String(player.id),
    }));

    if (value && !mapped.some((item) => item.value === value)) {
      const fallback = players.find((player) => String(player.id) === value);
      if (fallback) {
        return [{ label: fallback.name, value }, ...mapped];
      }
    }

    return mapped;
  }, [players, value]);

  const selectedItem = useMemo(
    () => items.find((item) => item.value === value) ?? null,
    [items, value],
  );

  return (
    <Combobox
      items={items}
      value={selectedItem}
      onValueChange={(item) => onChange(item?.value ?? "")}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <ComboboxInput placeholder="Player" className="min-w-0 w-full" />
      <ComboboxContent>
        <ComboboxEmpty>No players found.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
