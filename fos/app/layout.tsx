import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Antigravity FIRE OS",
  description: "Build Wealth. Track The Mission. Reach Financial Freedom.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#030712] text-slate-50 min-h-screen flex flex-col selection:bg-indigo-500/30`}>
        {children}
      </body>
    </html>
  );
}
