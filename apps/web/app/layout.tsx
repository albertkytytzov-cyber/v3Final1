import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PERFORM | Данные. Аналитика. Результат.",
  description:
    "Платформа для тренеров и спортсменов: готовность, адаптация нагрузки, планирование, аналитика и контроль выполнения в одной системе.",
  applicationName: "PERFORM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PERFORM",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
