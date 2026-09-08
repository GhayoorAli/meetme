import { Header } from "@/components/layout/header";
import { AuthBrand } from "@/components/auth/auth-brand";

import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="meet-atmosphere meet-atmosphere-page" aria-hidden />
      <Header />
      <main className="relative z-10 flex min-h-[calc(100dvh-4rem)] flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <AuthBrand />
          <div className="flex justify-center">{children}</div>
        </div>
      </main>
    </div>
  );
}
