import { getAccessCookieOptions, getUnauthorizedPayload } from "@/server/auth/cookie";

describe("auth cookie helpers", () => {
  it("returns secure cookie options shape", () => {
    const options = getAccessCookieOptions(60);
    expect(options.name).toBe("crm_access_token");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(60);
  });

  it("returns unauthorized payload", () => {
    expect(getUnauthorizedPayload()).toEqual({
      detail: "Authentication credentials were not provided",
    });
  });
});
