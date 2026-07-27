import { NextResponse, type NextRequest } from "next/server";

import { startGoogleOAuth } from "@/app/lib/api";

function getOAuthCallbackUrl(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin = process.env.NODE_ENV === "production" && siteUrl
    ? siteUrl
    : request.nextUrl.origin;

  return new URL("/auth/google/callback", origin).toString();
}

function getSafeRedirect(value: string | null) {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  return "/partners";
}

export async function GET(request: NextRequest) {
  try {
    const oauth = await startGoogleOAuth({
      callbackUrl: getOAuthCallbackUrl(request),
      redirectTo: getSafeRedirect(request.nextUrl.searchParams.get("redirect")),
    });

    return NextResponse.redirect(oauth.authorizationUrl);
  } catch (caught) {
    const redirect = getSafeRedirect(request.nextUrl.searchParams.get("redirect"));
    const url = new URL(redirect, request.nextUrl.origin);
    url.searchParams.set("oauth_error", caught instanceof Error ? caught.message : "Unable to start Google sign in.");
    return NextResponse.redirect(url);
  }
}
