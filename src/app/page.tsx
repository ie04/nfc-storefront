import CheckoutFlow from "./components/CheckoutFlow";

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const params = await searchParams;
  return <CheckoutFlow referralCode={params.ref} />;
}
