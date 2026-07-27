import type { FulfillmentMethod, NfcAddress, NfcCustomer, NfcDesign, ProductType } from "./contracts";

export const productLabels: Record<ProductType, string> = {
  custom: "Custom design",
  instagram: "Instagram",
  plain: "Plain",
  snapchat: "Snapchat",
  x: "X",
};

export const initialDesign: NfcDesign = {
  customColors: false,
  destinationInput: "",
  destinationKind: "website",
  programmedDestination: "",
  productType: "plain",
  socialPlatform: "instagram",
};

export const initialCustomer: NfcCustomer = {
  email: "",
  fullName: "",
  phone: "",
};

export const initialAddress: NfcAddress = {
  city: "",
  country: "US",
  line1: "",
  postalCode: "",
  state: "",
};

export function validateDesign(design: NfcDesign) {
  const errors: Record<string, string> = {};
  if (!buildProgrammedDestination(design).trim()) errors.programmedDestination = "Enter the destination to program.";
  if (usesGuidedDestination(design) && design.destinationKind === "social" && design.socialPlatform === "other" && !design.socialOtherSite?.trim()) {
    errors.socialOtherSite = "Enter the social media site.";
  }
  if (design.productType === "custom" && !design.customDesignDescription?.trim()) {
    errors.customDesignDescription = "Describe the custom design.";
  }
  if (design.productType !== "custom" && design.customColors && !design.colorDescription?.trim()) {
    errors.colorDescription = "Describe the requested colors.";
  }
  return errors;
}

export function usesGuidedDestination(design: Pick<NfcDesign, "productType">) {
  return design.productType === "plain" || design.productType === "custom";
}

export function buildProgrammedDestination(design: NfcDesign) {
  const raw = (design.destinationInput || design.programmedDestination || "").trim();

  if (!usesGuidedDestination(design)) return raw;
  if (design.destinationKind !== "social") {
    return raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
  }

  const platform = design.socialPlatform || "instagram";
  const handle = raw.replace(/^@/, "");

  if (platform === "other") {
    const site = (design.socialOtherSite || "").trim();
    if (!site || !handle) return raw;
    const normalizedSite = /^https?:\/\//i.test(site) ? site : `https://${site}`;
    return `${normalizedSite.replace(/\/+$/, "")}/${handle}`;
  }

  const baseUrl = socialPlatformBaseUrls[platform] || socialPlatformBaseUrls.instagram;
  return baseUrl.endsWith("@") ? `${baseUrl}${handle}` : `${baseUrl}/${handle}`;
}

export const socialPlatformLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  other: "Other",
  snapchat: "Snapchat",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
};

const socialPlatformBaseUrls: Record<string, string> = {
  facebook: "https://facebook.com",
  instagram: "https://instagram.com",
  linkedin: "https://linkedin.com/in",
  snapchat: "https://snapchat.com/add",
  tiktok: "https://tiktok.com/@",
  x: "https://x.com",
  youtube: "https://youtube.com/@",
};

export function validateCustomer(customer: NfcCustomer) {
  const errors: Record<string, string> = {};
  if (!customer.fullName.trim()) errors.fullName = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) errors.email = "Enter a valid email.";
  if (customer.phone.trim().length < 7) errors.phone = "Enter a phone number.";
  return errors;
}

export function validateAddress(address: NfcAddress, method: FulfillmentMethod) {
  const errors: Record<string, string> = {};
  if (!address.line1.trim()) errors.line1 = "Enter a street address.";
  if (!address.city.trim()) errors.city = "Enter a city.";
  if (!address.state.trim()) errors.state = "Enter a state.";
  if (!address.postalCode.trim()) errors.postalCode = method === "usps_standard" ? "Enter a shipping ZIP code." : "Enter a ZIP code.";
  return errors;
}
