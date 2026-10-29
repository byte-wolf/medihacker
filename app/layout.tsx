import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "@carbon/styles/css/styles.css";
import "./globals.css";
import { ThemeRoot } from "@/components/ThemeRoot";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "MediHacker",
  description: "Role- and task-specific patient briefing with source-linked facts",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <ThemeRoot>{children}</ThemeRoot>
      </body>
    </html>
  );
}
