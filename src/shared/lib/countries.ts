import type { Country } from "@/shared/types/entities";

export const COUNTRY_NOT_AVAILABLE = "—";

function normalizeCountryValue(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

export function getCountryEnglishName(country: Country | undefined | null) {
  const name = country?.name_en?.trim();
  return name || null;
}

export function countryMatchesEnglishPrefix(country: Country, input: string) {
  const englishName = getCountryEnglishName(country);
  if (!englishName) return false;

  const normalizedInput = normalizeCountryValue(input);
  return normalizedInput.length === 0 || normalizeCountryValue(englishName).startsWith(normalizedInput);
}

export function getSelectableCountries(countries: Country[]) {
  return countries
    .filter((country) => Boolean(getCountryEnglishName(country)))
    .toSorted((left, right) =>
      getCountryEnglishName(left)!.localeCompare(getCountryEnglishName(right)!, "en", { sensitivity: "base" }),
    );
}

export function findCountry(countries: Country[], value: number | string | null | undefined) {
  if (typeof value === "number") {
    return countries.find((country) => country.id === value);
  }

  if (!value) return undefined;
  const normalizedValue = normalizeCountryValue(value);

  return countries.find((country) =>
    [country.name_en, country.name_ru, country.iso2, country.iso3]
      .filter((candidate): candidate is string => Boolean(candidate))
      .some((candidate) => normalizeCountryValue(candidate) === normalizedValue),
  );
}

export function formatCountryEnglishName(
  countries: Country[],
  storedValue: string | null | undefined,
  countryId?: number | null,
) {
  const country = findCountry(countries, countryId ?? storedValue);
  return getCountryEnglishName(country) ?? COUNTRY_NOT_AVAILABLE;
}
