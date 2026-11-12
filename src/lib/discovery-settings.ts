import type { BankTaxonomy } from "./public-bank";
export const discoveryKeys = [
  "level",
  "grade",
  "book",
  "chapter",
  "topic",
  "category",
  "difficulty",
] as const;
export type DiscoveryKey = (typeof discoveryKeys)[number];
export interface DiscoveryOption {
  id: string;
  value: string;
  label: string;
  parents: Partial<BankTaxonomy>;
  active: boolean;
  order: number;
}
export interface DiscoveryField {
  key: DiscoveryKey;
  label: string;
  options: DiscoveryOption[];
}
export interface DiscoverySettings {
  revision: number;
  fields: DiscoveryField[];
}
export function discoveryChoices(
  settings: DiscoverySettings | null,
  key: DiscoveryKey,
  selected: Partial<BankTaxonomy>,
) {
  return (settings?.fields.find((field) => field.key === key)?.options ?? [])
    .filter(
      (option) =>
        option.active &&
        Object.entries(option.parents).every(
          ([parent, value]) =>
            !selected[parent as keyof BankTaxonomy] ||
            selected[parent as keyof BankTaxonomy] === value,
        ),
    )
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "fa"));
}
