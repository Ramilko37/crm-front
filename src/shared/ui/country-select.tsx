"use client";

import { Select, type SelectProps } from "antd";
import { useMemo } from "react";

import {
  type CountryDirectoryScope,
  useCountryDirectory,
} from "@/shared/hooks/use-country-directory";
import {
  countryMatchesEnglishPrefix,
  findCountry,
  getCountryEnglishName,
} from "@/shared/lib/countries";
import type { Country } from "@/shared/types/entities";

type CountrySelectOption = {
  label: string;
  value: number;
  country: Country;
};

export type CountrySelectProps = Omit<
  SelectProps<number, CountrySelectOption>,
  "filterOption" | "labelRender" | "loading" | "onChange" | "options" | "optionFilterProp" | "showSearch"
> & {
  scope?: CountryDirectoryScope;
  onChange?: (countryId: number | undefined, country: Country | undefined) => void;
};

export function CountrySelect({
  scope = "staff",
  onChange,
  notFoundContent,
  placeholder = "Выберите страну",
  status,
  ...selectProps
}: CountrySelectProps) {
  const directory = useCountryDirectory(scope);
  const options = useMemo<CountrySelectOption[]>(
    () =>
      directory.countries.map((country) => ({
        label: getCountryEnglishName(country)!,
        value: country.id,
        country,
      })),
    [directory.countries],
  );

  const emptyContent = directory.isLoading
    ? "Загрузка..."
    : directory.isError
      ? "Не удалось загрузить страны"
      : (notFoundContent ?? "Страны не найдены");

  return (
    <Select<number, CountrySelectOption>
      {...selectProps}
      loading={directory.isLoading}
      notFoundContent={emptyContent}
      options={options}
      placeholder={placeholder}
      status={status ?? (directory.isError ? "error" : undefined)}
      labelRender={({ value }) => getCountryEnglishName(findCountry(directory.countries, value)) ?? ""}
      showSearch={{
        filterOption: (input, option) => Boolean(option && countryMatchesEnglishPrefix(option.country, input)),
      }}
      onChange={(countryId) => {
        const nextCountryId = typeof countryId === "number" ? countryId : undefined;
        onChange?.(nextCountryId, findCountry(directory.countries, nextCountryId));
      }}
    />
  );
}
