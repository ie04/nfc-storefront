import { Suspense } from "react";

import AuthDashboard from "../components/AuthDashboard";

export default function PartnersPage() {
  return (
    <Suspense fallback={<main className="p-6 font-black">Loading...</main>}>
      <AuthDashboard mode="partner" />
    </Suspense>
  );
}
