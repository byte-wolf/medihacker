import type { Metadata } from "next";
import { Theme } from "@carbon/react";
import "@carbon/styles/css/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediHacker",
  description: "Clinical documentation assistant",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Theme theme="white">{children}</Theme>
      </body>
    </html>
  );
}
