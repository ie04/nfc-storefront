import { NextRequest, NextResponse } from "next/server";

const maxAgeSeconds = 30 * 24 * 60 * 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ refCode: string }> }) {
  const { refCode } = await params;
  const code = refCode.trim();
  const url = new URL("/", request.url);

  if (code) {
    url.searchParams.set("ref", code);
  }

  const response = NextResponse.redirect(url);
  if (code) {
    response.cookies.set({
      httpOnly: false,
      maxAge: maxAgeSeconds,
      name: "bayblaze_ref",
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      value: code,
    });
  }
  return response;
}
