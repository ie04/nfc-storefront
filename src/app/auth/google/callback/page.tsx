import { Suspense } from "react";

import GoogleCallbackClient from "./GoogleCallbackClient";

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<main className="p-6 font-black">Finishing Google sign-in...</main>}>
      <GoogleCallbackClient />
    </Suspense>
  );
}
