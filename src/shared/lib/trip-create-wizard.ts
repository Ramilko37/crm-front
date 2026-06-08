export type TripCreateWizardStep = "trip" | "path_points" | "loading_points";

export const TRIP_CREATE_WIZARD_STEPS: Array<{ key: TripCreateWizardStep; title: string }> = [
  { key: "trip", title: "Рейс" },
  { key: "path_points", title: "Маршрут" },
  { key: "loading_points", title: "Погрузки" },
];

export function clampTripCreateWizardStep(currentStep: number) {
  const lastStep = TRIP_CREATE_WIZARD_STEPS.length - 1;
  return Math.max(0, Math.min(currentStep, lastStep));
}
