import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeetMe — Rooms that belong to you",
  description:
    "Unlimited video meetings with waiting rooms, whiteboard, and host controls.",
  applicationName: "MeetMe",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MeetMe",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2f49d1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ backgroundColor: "#eef2f8" }}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col"
        style={{ backgroundColor: "#eef2f8" }}
        suppressHydrationWarning
      >
        <AuthProvider>
          {children}
          <PwaRegister />
          <InstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
