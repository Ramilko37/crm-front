export const defaultLocale = "ru" as const;
export const supportedLocales = ["ru", "en", "it"] as const;
export type AppLocale = (typeof supportedLocales)[number];
