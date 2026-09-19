import { Header } from "@/components/layout/header";
import { AuthBrand } from "@/components/auth/auth-brand";

import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="meet-atmosphere meet-atmosphere-page" aria-hidden />
      <Header />
      <main className="relative z-10 flex min-h-[calc(100dvh-3.5rem)] flex-1 items-center justify-center px-4 py-8 pb-28 sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:py-12">
        <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <AuthBrand />
          <div className="flex justify-center">{children}</div>
        </div>
      </main>
    </div>
  );
}
