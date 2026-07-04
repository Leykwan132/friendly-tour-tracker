import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { getHeroItems } from "@/data/dotaHeroes";

interface HeroComboboxProps {
  value: string;
  onChange: (hero: string) => void;
}

export function HeroCombobox({ value, onChange }: HeroComboboxProps) {
  const items = useMemo(() => getHeroItems(value), [value]);

  return (
    <Combobox
      items={items}
      value={value || null}
      onValueChange={(hero) => onChange(hero ?? "")}
    >
      <ComboboxInput placeholder="Hero" className="min-w-0 w-full" />
      <ComboboxContent>
        <ComboboxEmpty>No heroes found.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
