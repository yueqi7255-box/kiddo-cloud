import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiddo Cloud",
  description: "家庭照片与成长内容的本地原型，预留 Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="antialiased">
        {children}
      </body>
    </html>
  );
}
