import { describe, expect, it } from "vitest";

import { buildCompanyCreatePayload, isCompanyPhoneValid } from "@/shared/lib/company-flow";

describe("company flow helpers", () => {
  it("omits blank optional fields and contact rows from the create payload", () => {
    expect(
      buildCompanyCreatePayload({
        name: "  Acme Logistics  ",
        country: " Italy ",
        city: " Milan ",
        address: " ",
        role: "Client",
        contacts: [
          { full_name: " ", phone: "+39 02 123456" },
          {
            full_name: " Warehouse Desk ",
            job_title: " Dispatcher ",
            phone: " +39 02 123456 ",
            email: " desk@example.com ",
            is_primary: false,
          },
        ],
      }),
    ).toEqual({
      name: "Acme Logistics",
      country: "Italy",
      city: "Milan",
      role: "Client",
      contacts: [
        {
          full_name: "Warehouse Desk",
          job_title: "Dispatcher",
          phone: "+39 02 123456",
          email: "desk@example.com",
          is_primary: false,
        },
      ],
    });
  });

  it("accepts only supported phone characters with 6 to 20 digits", () => {
    expect(isCompanyPhoneValid("+39 (02) 123-456")).toBe(true);
    expect(isCompanyPhoneValid("+39 hello 123456")).toBe(false);
    expect(isCompanyPhoneValid("12345")).toBe(false);
    expect(isCompanyPhoneValid("123456789012345678901")).toBe(false);
  });
});
