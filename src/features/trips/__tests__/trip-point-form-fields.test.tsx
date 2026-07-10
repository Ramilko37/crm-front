import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Form } from "antd";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { TripPointFormFields } from "@/features/trips/trip-point-form-fields";
import type { TripPointFormValues } from "@/shared/lib/trip-point-forms";

function LoadingPointForm({ onCitySearch }: { onCitySearch: (value: string) => void }) {
  const [form] = Form.useForm<TripPointFormValues>();
  const formRef = useRef(form);

  return (
    <Form
      form={form}
      initialValues={{
        point_kind: "loading",
        loading_source: "factory",
        country_id: 1,
        city: "Milan",
        factory_id: 7,
        forwarder_user_id: 25,
      }}
    >
      <TripPointFormFields
        form={formRef.current}
        countries={[{ id: 1, name_ru: "Италия", name_en: "Italy", iso2: "IT", iso3: "ITA" }]}
        cities={["Milan"]}
        factories={[]}
        forwarders={[]}
        pathPoints={[]}
        onCitySearch={onCitySearch}
      />
    </Form>
  );
}

describe("TripPointFormFields", () => {
  it("passes city input to the remote lookup", async () => {
    const onCitySearch = vi.fn();

    render(<LoadingPointForm onCitySearch={onCitySearch} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Город" }), { target: { value: "mil" } });

    await waitFor(() => {
      expect(onCitySearch).toHaveBeenLastCalledWith("mil");
    });
  });
});
