import { describe, expect, it } from "vitest";

import {
  countryMatchesEnglishPrefix,
  findCountry,
  formatCountryEnglishName,
  getSelectableCountries,
} from "@/shared/lib/countries";
import type { Country } from "@/shared/types/entities";

const countries: Country[] = [
  { id: 49, name_ru: "Германия", name_en: "Germany", iso2: "DE", iso3: "DEU" },
  { id: 39, name_ru: "Италия", name_en: "Italy", iso2: "IT", iso3: "ITA" },
  { id: 7, name_ru: "Россия", name_en: null, iso2: "RU", iso3: "RUS" },
];

describe("country directory helpers", () => {
  it.each([
    ["It", "Italy"],
    [" Ger ", "Germany"],
    ["iT", "Italy"],
  ])("matches %s against the start of an English country name", (query, expectedName) => {
    const matched = countries.filter((country) => countryMatchesEnglishPrefix(country, query));

    expect(matched.map((country) => country.name_en)).toEqual([expectedName]);
  });

  it("does not match a substring from the middle of a country name", () => {
    expect(countryMatchesEnglishPrefix(countries[0], "many")).toBe(false);
  });

  it("sorts selectable countries by English name and excludes missing English names", () => {
    expect(getSelectableCountries(countries).map((country) => country.name_en)).toEqual(["Germany", "Italy"]);
  });

  it.each(["Италия", "Italy", "it", "ITA"])("resolves legacy value %s to Italy", (value) => {
    expect(findCountry(countries, value)?.id).toBe(39);
    expect(formatCountryEnglishName(countries, value)).toBe("Italy");
  });

  it("uses an id before a stale stored country string", () => {
    expect(formatCountryEnglishName(countries, "Германия", 39)).toBe("Italy");
  });

  it("renders an em dash when no English country can be resolved", () => {
    expect(formatCountryEnglishName(countries, "Неизвестная страна")).toBe("—");
    expect(formatCountryEnglishName(countries, "Россия")).toBe("—");
  });
});
