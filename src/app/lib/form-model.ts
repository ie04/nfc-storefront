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
  programmedDestination: "",
  productType: "plain",
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
  if (!design.programmedDestination.trim()) errors.programmedDestination = "Enter the destination to program.";
  if (design.productType === "custom" && !design.customDesignDescription?.trim()) {
    errors.customDesignDescription = "Describe the custom design.";
  }
  if (design.productType !== "custom" && design.customColors && !design.colorDescription?.trim()) {
    errors.colorDescription = "Describe the requested colors.";
  }
  return errors;
}

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
