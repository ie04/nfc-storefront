import { describe, expect, it } from "vitest";

import { buildProgrammedDestination, initialAddress, validateAddress, validateCustomer, validateDesign } from "./form-model";

describe("NFC storefront validation", () => {
  it("requires a destination for every product", () => {
    expect(validateDesign({
      customColors: false,
      programmedDestination: "",
      productType: "plain",
    }).programmedDestination).toBeTruthy();
  });

  it("requires custom design details for custom tags", () => {
    expect(validateDesign({
      customColors: false,
      programmedDestination: "https://example.com",
      productType: "custom",
    }).customDesignDescription).toBeTruthy();
  });

  it("requires a color description only when generic custom colors are selected", () => {
    expect(validateDesign({
      customColors: true,
      programmedDestination: "@bayblaze",
      productType: "instagram",
    }).colorDescription).toBeTruthy();

    expect(validateDesign({
      customColors: false,
      programmedDestination: "@bayblaze",
      productType: "instagram",
    }).colorDescription).toBeUndefined();
  });

  it("validates customer receipt and fulfillment fields", () => {
    expect(validateCustomer({ email: "bad", fullName: "", phone: "1" })).toEqual({
      email: "Enter a valid email.",
      fullName: "Enter your full name.",
      phone: "Enter a phone number.",
    });
    expect(validateAddress(initialAddress, "usps_standard").postalCode).toBe("Enter a shipping ZIP code.");
  });

  it("builds website destinations from bare domains", () => {
    expect(buildProgrammedDestination({
      customColors: false,
      destinationInput: "bayblaze.net/nfc",
      destinationKind: "website",
      programmedDestination: "",
      productType: "plain",
    })).toBe("https://bayblaze.net/nfc");
  });

  it("builds common and custom social destinations", () => {
    expect(buildProgrammedDestination({
      customColors: false,
      destinationInput: "@bayblaze",
      destinationKind: "social",
      programmedDestination: "",
      productType: "custom",
      socialPlatform: "instagram",
    })).toBe("https://instagram.com/bayblaze");

    expect(buildProgrammedDestination({
      customColors: false,
      destinationInput: "bayblaze",
      destinationKind: "social",
      programmedDestination: "",
      productType: "plain",
      socialOtherSite: "threads.net",
      socialPlatform: "other",
    })).toBe("https://threads.net/bayblaze");
  });
});
