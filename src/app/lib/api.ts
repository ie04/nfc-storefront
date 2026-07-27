import type { NfcAddress, NfcCustomer, NfcDesign, OrderCreateResponse, PartnerPortalData, QuoteResponse } from "./contracts";

const apiUrl = process.env.NEXT_PUBLIC_BAYBLAZE_API_URL || "http://localhost:3040";

export async function resolveAttribution(input: { code: string; existingToken?: string; sourcePath?: string }) {
  return request<{ token: string; code: string; discountPercent?: number; referralLink: string }>("/v1/nfc/attributions", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function quoteOrder(input: {
  address: NfcAddress;
  attributionToken?: string;
  design: NfcDesign;
  method: "local_delivery" | "usps_standard";
}) {
  return request<QuoteResponse>("/v1/nfc/orders/quote", {
    body: JSON.stringify({
      attributionToken: input.attributionToken,
      design: input.design,
      fulfillment: { address: input.address, method: input.method },
    }),
    method: "POST",
  });
}

export async function createOrder(input: {
  address: NfcAddress;
  attributionToken?: string;
  customer: NfcCustomer;
  design: NfcDesign;
  idempotencyKey: string;
  method: "local_delivery" | "usps_standard";
}) {
  return request<OrderCreateResponse>("/v1/nfc/orders", {
    body: JSON.stringify({
      attributionToken: input.attributionToken,
      customer: input.customer,
      design: input.design,
      fulfillment: { address: input.address, method: input.method },
      idempotencyKey: input.idempotencyKey,
    }),
    method: "POST",
  });
}

export async function uploadDesignAsset(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${apiUrl}/v1/nfc/uploads`, {
    body: formData,
    method: "POST",
  });
  if (!response.ok) throw new Error(await readMessage(response));
  return response.json() as Promise<{ uploadId: string; storageRef: string }>;
}

export async function login(email: string, password: string) {
  return request<{ token: string; account: unknown }>("/v1/auth/login", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
}

export async function loadPartnerPortal(token: string): Promise<PartnerPortalData> {
  const [overview, referrals, payouts, account] = await Promise.all([
    request<PartnerPortalData>("/v1/partners/me/overview", { token }),
    request<{ items: NonNullable<PartnerPortalData["referrals"]> }>("/v1/partners/me/referrals?limit=50", { token }),
    request<{ items: NonNullable<PartnerPortalData["payouts"]> }>("/v1/partners/me/payouts?limit=50", { token }),
    request<PartnerPortalData>("/v1/partners/me/account", { token }),
  ]);

  return {
    ...overview,
    ...account,
    payouts: payouts.items,
    referrals: referrals.items,
  };
}

export async function loadAdminDashboard(token: string) {
  return request<{
    commissionLedger: unknown[];
    metrics: { orders: number; paidSalesCents: number; pendingCommissionsCents: number };
    orders: unknown[];
  }>("/v1/admin/nfc/summary", { token });
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(await readMessage(response));
  return response.json() as Promise<T>;
}

async function readMessage(response: Response) {
  const data = await response.json().catch(() => ({}));
  return typeof data.message === "string" ? data.message : "BayBlaze could not complete that request.";
}
