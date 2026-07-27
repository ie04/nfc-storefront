import { Suspense } from "react";

import ClaimCodePage from "./ClaimCodePage";

export default async function PartnersClaimPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  return (
    <Suspense fallback={<main className="p-6 font-black">Loading...</main>}>
      <ClaimCodePage code={params.code || ""} />
    </Suspense>
  );
}
