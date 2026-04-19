export type GoodsLineSummaryInput = {
  item_type?: string;
  custom_item_type?: string;
  weight_kg?: string;
  quantity_value?: string;
  quantity_unit?: string;
};

function parseDecimal(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatCoefficient(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "";
  return value.toFixed(4).replace(/\.?0+$/, "");
}

export function calculateCoefficient(numerator: string | null | undefined, denominator: string | null | undefined): string {
  const a = parseDecimal(numerator);
  const b = parseDecimal(denominator);
  if (!a || !b) return "";
  return formatCoefficient(a / b);
}

export function renderGoodsLineSummary(line: GoodsLineSummaryInput) {
  const itemTypeRaw = line.item_type?.trim();
  const itemType = itemTypeRaw === "other" ? line.custom_item_type?.trim() : itemTypeRaw;
  const item = itemType || "Тип не указан";
  const weightRaw = line.weight_kg?.trim();
  const weight = weightRaw ? `${weightRaw} кг` : "вес ?";
  const qty = line.quantity_value?.trim() || "?";
  const unit = line.quantity_unit?.trim() || "ед.";
  return `${item} · ${weight} · ${qty} ${unit}`;
}
