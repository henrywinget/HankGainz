import type { Metadata, Viewport } from "next";
import { Outfit, Orbitron, Mr_Dafoe } from "next/font/google";
import { Nav } from "@/components/nav";
import { ChartDefs } from "@/components/chart-defs";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], weight: ["500", "700", "900"] });
const dafoe = Mr_Dafoe({ variable: "--font-dafoe", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "HankGainz", template: "%s · HankGainz" },
  description: "Nutrition, steps and strength, all in one place.",
};

export const viewport: Viewport = { themeColor: "#07021a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${orbitron.variable} ${dafoe.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ChartDefs />
        <div className="relative z-10 flex min-h-screen">
          <Nav />
          <main className="flex-1 min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
