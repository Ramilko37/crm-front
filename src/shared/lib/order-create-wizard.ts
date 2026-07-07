import type { OrderType } from "@/shared/lib/domain-enums";

export type OrderCreateWizardStep = "base" | "factory" | "order_data" | "goods" | "documents";

const DELIVERY_CREATE_WIZARD_STEPS: Array<{ key: OrderCreateWizardStep; title: string }> = [
  { key: "base", title: "Новый заказ" },
  { key: "factory", title: "Фабрика" },
  { key: "order_data", title: "Данные заказа" },
  { key: "goods", title: "Товары" },
  { key: "documents", title: "Документы" },
];

const REQUEST_CREATE_WIZARD_STEPS: Array<{ key: OrderCreateWizardStep; title: string }> = [
  { key: "base", title: "Новый заказ" },
  { key: "documents", title: "Документы" },
];

export function getOrderCreateWizardSteps(orderType: OrderType | undefined) {
  return orderType === "request" ? REQUEST_CREATE_WIZARD_STEPS : DELIVERY_CREATE_WIZARD_STEPS;
}

export function clampOrderCreateWizardStep(currentStep: number, orderType: OrderType | undefined) {
  const steps = getOrderCreateWizardSteps(orderType);
  return Math.min(Math.max(currentStep, 0), steps.length - 1);
}
