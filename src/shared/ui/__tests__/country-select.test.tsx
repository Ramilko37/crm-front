import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/shared/lib/api";
import { CountrySelect } from "@/shared/ui/country-select";

vi.mock("@/shared/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);
const countryResponse = {
  items: [
    { id: 49, name_ru: "Германия", name_en: "Germany", iso2: "DE", iso3: "DEU" },
    { id: 39, name_ru: "Италия", name_en: "Italy", iso2: "IT", iso3: "ITA" },
    { id: 7, name_ru: "Россия", name_en: null, iso2: "RU", iso3: "RUS" },
  ],
  meta: { page: 1, page_size: 300, total: 3, total_pages: 1 },
};

function renderCountrySelect(
  props: Partial<React.ComponentProps<typeof CountrySelect>> = {},
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <CountrySelect aria-label="Country" {...props} />
    </QueryClientProvider>,
  );
}

describe("CountrySelect", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("loads the staff directory once with the shared lookup parameters", async () => {
    apiRequestMock.mockResolvedValue(countryResponse);

    renderCountrySelect();

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/api/countries", {
        query: { page: 1, page_size: 300, sort_by: "name_en", sort_desc: false },
      });
    });
  });

  it("uses the client endpoint for client scope", async () => {
    apiRequestMock.mockResolvedValue(countryResponse);

    renderCountrySelect({ scope: "client" });

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/api/client/countries", {
        query: { page: 1, page_size: 300, sort_by: "name_en", sort_desc: false },
      });
    });
  });

  it("filters English options by prefix and returns the selected country", async () => {
    apiRequestMock.mockResolvedValue(countryResponse);
    const onChange = vi.fn();

    renderCountrySelect({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Country" });
    fireEvent.mouseDown(combobox);
    fireEvent.change(combobox, { target: { value: "It" } });

    expect(await screen.findByRole("option", { name: "Italy" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Germany" })).not.toBeInTheDocument();
    expect(screen.queryByText("Италия")).not.toBeInTheDocument();
    expect(screen.queryByText("Country ID")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Italy"));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(39, countryResponse.items[1]);
    });
  });

  it("supports selecting a prefix match with the keyboard", async () => {
    apiRequestMock.mockResolvedValue(countryResponse);
    const onChange = vi.fn();

    renderCountrySelect({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Country" });
    fireEvent.mouseDown(combobox);
    fireEvent.change(combobox, { target: { value: "Ger" } });

    expect(await screen.findByRole("option", { name: "Germany" })).toBeInTheDocument();
    fireEvent.keyDown(combobox, { key: "Enter", code: "Enter", keyCode: 13, which: 13 });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(49, countryResponse.items[0]);
    });
  });

  it("does not accept arbitrary text and clears with an undefined country", async () => {
    apiRequestMock.mockResolvedValue(countryResponse);
    const onChange = vi.fn();

    renderCountrySelect({ allowClear: true, value: 39, onChange });

    const combobox = screen.getByRole("combobox", { name: "Country" });
    fireEvent.mouseDown(combobox);
    fireEvent.change(combobox, { target: { value: "Atlantis" } });
    fireEvent.keyDown(combobox, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByLabelText("close-circle"));
    expect(onChange).toHaveBeenCalledWith(undefined, undefined);
  });

  it("shows loading, empty, and error states without exposing ids", async () => {
    let resolveRequest: ((value: typeof countryResponse) => void) | undefined;
    apiRequestMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const firstRender = renderCountrySelect();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Country" }));
    expect(await screen.findByText("Загрузка...")).toBeInTheDocument();

    resolveRequest?.({ ...countryResponse, items: [] });
    expect(await screen.findByText("Страны не найдены")).toBeInTheDocument();
    firstRender.unmount();

    apiRequestMock.mockRejectedValue(new Error("network"));
    renderCountrySelect({}, new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Country" }));

    expect(await screen.findByText("Не удалось загрузить страны")).toBeInTheDocument();
    expect(screen.queryByText("49")).not.toBeInTheDocument();
  });
});
