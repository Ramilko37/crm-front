import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Form } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TripPointFormFields } from "@/features/trips/trip-point-form-fields";
import { apiRequest } from "@/shared/lib/api";
import type { TripPointFormValues } from "@/shared/lib/trip-point-forms";

vi.mock("@/shared/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

function PointState({ form }: { form: ReturnType<typeof Form.useForm<TripPointFormValues>>[0] }) {
  const country = Form.useWatch("country", form);
  const city = Form.useWatch("city", form);
  const factoryId = Form.useWatch("factory_id", form);

  return <output data-testid="point-state">{JSON.stringify({ country, city, factoryId })}</output>;
}

function LoadingPointForm({ onCitySearch }: { onCitySearch: (value: string) => void }) {
  const [form] = Form.useForm<TripPointFormValues>();

  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Form
        form={form}
        initialValues={{
          point_kind: "loading",
          loading_source: "factory",
          country_id: 1,
          country: "Italy",
          city: "Milan",
          factory_id: 7,
          forwarder_user_id: 25,
        }}
      >
        <TripPointFormFields
          form={form}
          cities={["Milan"]}
          factories={[]}
          forwarders={[]}
          pathPoints={[]}
          onCitySearch={onCitySearch}
        />
        <PointState form={form} />
      </Form>
    </QueryClientProvider>
  );
}

describe("TripPointFormFields", () => {
  beforeEach(() => {
    apiRequestMock.mockResolvedValue({
      items: [
        { id: 1, name_ru: "Италия", name_en: "Italy", iso2: "IT", iso3: "ITA" },
        { id: 2, name_ru: "Германия", name_en: "Germany", iso2: "DE", iso3: "DEU" },
      ],
      meta: { page: 1, page_size: 300, total: 2, total_pages: 1 },
    });
  });

  it("passes city input to the remote lookup", async () => {
    const onCitySearch = vi.fn();

    render(<LoadingPointForm onCitySearch={onCitySearch} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Город" }), { target: { value: "mil" } });

    await waitFor(() => {
      expect(onCitySearch).toHaveBeenLastCalledWith("mil");
    });
  });

  it("stores the English country name and clears dependent fields", async () => {
    render(<LoadingPointForm onCitySearch={vi.fn()} />);

    const countrySelect = screen.getByRole("combobox", { name: "Страна" });
    fireEvent.mouseDown(countrySelect);
    fireEvent.change(countrySelect, { target: { value: "Ger" } });
    fireEvent.click(await screen.findByTitle("Germany"));

    await waitFor(() => {
      expect(screen.getByTestId("point-state")).toHaveTextContent(
        JSON.stringify({ country: "Germany" }),
      );
    });
  });
});
