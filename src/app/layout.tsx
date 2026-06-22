import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Spends",
  description: "Monthly expense analytics",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-gray-50 min-h-screen antialiased`}>
        <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
            <span className="font-semibold text-gray-900">💰 Spends</span>
            <div className="flex gap-5">
              <a href="/" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
              <a href="/summary" className="text-sm text-gray-600 hover:text-gray-900">Summary</a>
              <a href="/upload" className="text-sm text-gray-600 hover:text-gray-900">Upload</a>
            </div>
          </div>
        </nav>
        <main className="max-w-2xl mx-auto px-4 py-5">
          {children}
        </main>
      </body>
    </html>
  );
}
