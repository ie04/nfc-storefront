export type ProductType = "plain" | "instagram" | "snapchat" | "x" | "custom";
export type FulfillmentMethod = "local_delivery" | "usps_standard";

export type NfcDesign = {
  additionalComments?: string;
  colorDescription?: string;
  customColors: boolean;
  customDesignDescription?: string;
  programmedDestination: string;
  productType: ProductType;
  uploadedAssetId?: string;
};

export type NfcAddress = {
  city: string;
  country: string;
  line1: string;
  line2?: string;
  postalCode: string;
  state: string;
};

export type NfcCustomer = {
  email: string;
  fullName: string;
  phone: string;
};

export type QuoteResponse = {
  attribution: { active: boolean; code?: string };
  currency: "usd";
  fulfillmentEligibility: {
    audit?: {
      destinationHash: string;
      distanceMeters: number;
      estimatedTravelMinutes: number;
      status: string;
    };
    fulfillmentMethod: FulfillmentMethod;
    reason?: string;
    status: string;
  };
  money: {
    basePriceCents: number;
    customColorSurchargeCents: number;
    deliveryFeeCents: number;
    estimatedTaxCents: number;
    subtotalCents: number;
    totalCents: number;
  };
  normalizedDestination: string;
  pricingPolicy: {
    commissionCents: number;
    localDeliveryMaxMinutes: number;
  };
};

export type OrderCreateResponse = {
  clientSecret: string | null;
  order: {
    fulfillment: unknown;
    fulfillmentEligibility: unknown;
    money: QuoteResponse["money"];
    orderId: string;
    status: string;
  };
};

export type PartnerPortalData = {
  account?: { displayName: string; email: string; joinedAt: string; payoutStatus: string; status: string };
  earnings?: { eligibleCents: number; lifetimeCents: number; paidCents: number; pendingCents: number; reversedCents: number };
  metrics?: { clicks: number; completedOrders: number; referredCustomers: number };
  partner?: { displayName: string; email: string; referralCode: string; status: string; uid: string };
  referralCode?: string;
  referralLink?: string;
  referrals?: Array<{ customerLabel: string; date: string; earnedCents: number; id: string; orderStatus: string; commissionStatus: string }>;
  payouts?: Array<{ amountCents: number; createdAt: string; id: string; status: string }>;
};
