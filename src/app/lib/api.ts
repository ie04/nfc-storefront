import type { NfcAddress, NfcCustomer, NfcDesign, OrderCreateResponse, PartnerPortalData, QuoteResponse } from "./contracts";

const apiUrl =
  process.env.BAYBLAZE_API_URL ||
  process.env.NEXT_PUBLIC_BAYBLAZE_API_URL ||
  "http://localhost:3040";

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
  const response = await request<AccountSessionResponse>("/v1/auth/login", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
  return normalizeSession(response);
}

export async function loginCustomer(email: string, password: string) {
  const response = await request<AccountSessionResponse>("/v1/customer/auth/login", {
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
  return normalizeSession(response);
}

export async function registerCustomer(input: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  const response = await request<AccountSessionResponse>("/v1/customer/auth/accounts", {
    body: JSON.stringify(input),
    method: "POST",
  });
  return normalizeSession(response);
}

export async function startGoogleOAuth(input: {
  callbackUrl: string;
  redirectTo: string;
}) {
  return request<{ authorizationUrl: string; expiresInSeconds: number }>("/v1/auth/google/start", {
    body: JSON.stringify({
      callbackUrl: input.callbackUrl,
      commerce: "storefront",
      redirectTo: input.redirectTo,
    }),
    method: "POST",
  });
}

export async function completeGoogleOAuth(input: {
  callbackUrl: string;
  code: string;
  state: string;
}) {
  const response = await request<AccountSessionResponse & { redirectTo?: string }>("/v1/auth/google/callback", {
    body: JSON.stringify(input),
    method: "POST",
  });
  return {
    ...normalizeSession(response),
    redirectTo: response.redirectTo || "/partners",
  };
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

export async function getPartnerClaimCode(code: string) {
  return request<{ claimCode: PartnerClaimCode }>(`/v1/partners/claim-codes/${encodeURIComponent(code)}`);
}

export async function claimPartnerClaimCode(code: string, token: string) {
  return request<{ claimCode: PartnerClaimCode; partner: unknown }>(
    `/v1/partners/me/claim-codes/${encodeURIComponent(code)}/claim`,
    { method: "POST", token },
  );
}

export async function createPartnerClaimCode(token: string, input: { code?: string; note?: string } = {}) {
  return request<{ claimCode: PartnerClaimCode }>("/v1/admin/partners/claim-codes", {
    body: JSON.stringify(input),
    method: "POST",
    token,
  });
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}) {
  const url = `${apiUrl}${path}`;
  const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...init.headers,
      },
    }).catch(() => {
      const host = safeApiHost(apiUrl);
      throw new Error(`Could not reach BayBlaze API at ${host}. Check BAYBLAZE_API_URL/NEXT_PUBLIC_BAYBLAZE_API_URL.`);
    });
  if (!response.ok) throw new Error(await readMessage(response));
  return response.json() as Promise<T>;
}

function safeApiHost(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "the configured API URL";
  }
}

type AccountSessionResponse = {
  account: unknown;
  session?: {
    token?: string;
  };
  token?: string;
};

export type PartnerClaimCode = {
  claimUrl: string;
  claimedAt: string;
  claimedByUid: string;
  code: string;
  createdAt: string;
  note: string;
  referralUrl: string;
  status: "unclaimed" | "claiming" | "claimed" | "disabled";
  updatedAt: string;
};

function normalizeSession(response: AccountSessionResponse) {
  const token = response.session?.token || response.token || "";
  if (!token) throw new Error("BayBlaze did not return an account session.");
  return { account: response.account, token };
}

async function readMessage(response: Response) {
  const data = await response.json().catch(() => ({}));
  return typeof data.message === "string" ? data.message : "BayBlaze could not complete that request.";
}
