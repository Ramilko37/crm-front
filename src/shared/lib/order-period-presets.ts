import dayjs, { type Dayjs } from "dayjs";

export type OrderPeriodPresetCode =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "current_month"
  | "previous_month";

export type OrderPeriodPresetRange = {
  order_date_from: string;
  order_date_to: string;
};

export const ORDER_PERIOD_PRESET_OPTIONS: Array<{ label: string; value: OrderPeriodPresetCode }> = [
  { label: "Сегодня", value: "today" },
  { label: "Вчера", value: "yesterday" },
  { label: "Последние 7 дней", value: "last_7_days" },
  { label: "Последние 30 дней", value: "last_30_days" },
  { label: "Текущий месяц", value: "current_month" },
  { label: "Прошлый месяц", value: "previous_month" },
];

function formatDate(value: Dayjs) {
  return value.format("YYYY-MM-DD");
}

export function getOrderPeriodPresetRange(
  preset: OrderPeriodPresetCode,
  today: Dayjs = dayjs(),
): OrderPeriodPresetRange {
  const date = today.startOf("day");

  if (preset === "today") {
    return {
      order_date_from: formatDate(date),
      order_date_to: formatDate(date),
    };
  }

  if (preset === "yesterday") {
    const yesterday = date.subtract(1, "day");
    return {
      order_date_from: formatDate(yesterday),
      order_date_to: formatDate(yesterday),
    };
  }

  if (preset === "last_7_days") {
    return {
      order_date_from: formatDate(date.subtract(6, "day")),
      order_date_to: formatDate(date),
    };
  }

  if (preset === "last_30_days") {
    return {
      order_date_from: formatDate(date.subtract(29, "day")),
      order_date_to: formatDate(date),
    };
  }

  if (preset === "current_month") {
    return {
      order_date_from: formatDate(date.startOf("month")),
      order_date_to: formatDate(date),
    };
  }

  const previousMonth = date.subtract(1, "month");
  return {
    order_date_from: formatDate(previousMonth.startOf("month")),
    order_date_to: formatDate(previousMonth.endOf("month")),
  };
}

export function getOrderPeriodPresetCodeForRange(
  orderDateFrom: string | undefined,
  orderDateTo: string | undefined,
  today: Dayjs = dayjs(),
) {
  if (!orderDateFrom || !orderDateTo) return undefined;

  return ORDER_PERIOD_PRESET_OPTIONS.find((preset) => {
    const range = getOrderPeriodPresetRange(preset.value, today);
    return range.order_date_from === orderDateFrom && range.order_date_to === orderDateTo;
  })?.value;
}
