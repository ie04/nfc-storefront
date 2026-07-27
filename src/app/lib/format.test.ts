import { describe, expect, it } from "vitest";

import { formatMoney } from "./format";

describe("money formatting", () => {
  it("formats integer cents as US dollars", () => {
    expect(formatMoney(2_000)).toBe("$20.00");
    expect(formatMoney(500)).toBe("$5.00");
    expect(formatMoney(4_000)).toBe("$40.00");
  });
});
