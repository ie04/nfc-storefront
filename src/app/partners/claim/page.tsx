import ClaimCodePage from "./ClaimCodePage";

export default async function PartnersClaimPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  return <ClaimCodePage code={params.code || ""} />;
}
