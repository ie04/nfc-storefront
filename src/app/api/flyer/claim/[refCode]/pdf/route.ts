import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<unknown> },
) {
  const { refCode } = await parseParams(context.params);
  const code = refCode.trim();
  if (!code) {
    return Response.json({ message: "Flyer code is required." }, { status: 400 });
  }

  const origin = getRequestOrigin(request);
  const flyerUrl = `${origin}/flyer/claim/${encodeURIComponent(code)}?pdf=1`;
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath: await getChromiumExecutablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { height: 1056, width: 816 },
    });
    await page.goto(flyerUrl, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((image) => {
        if (image.complete && image.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }));
    });

    const pdf = await page.pdf({
      format: "Letter",
      margin: { bottom: "0in", left: "0in", right: "0in", top: "0in" },
      pageRanges: "1",
      preferCSSPageSize: true,
      printBackground: true,
    });

    return new Response(toUint8Array(pdf), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${safeFilename(code)}"`,
        "content-type": "application/pdf",
      },
    });
  } finally {
    await browser.close();
  }
}

async function parseParams(paramsPromise: Promise<unknown>) {
  const params = await paramsPromise;
  if (!params || typeof params !== "object" || typeof (params as { refCode?: unknown }).refCode !== "string") {
    return { refCode: "" };
  }
  return { refCode: (params as { refCode: string }).refCode };
}

function toUint8Array(buffer: Buffer) {
  return new Uint8Array(buffer);
}

async function getChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  return chromium.executablePath();
}

function getRequestOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

function safeFilename(code: string) {
  return `bayblaze-claim-flyer-${code.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}.pdf`;
}
