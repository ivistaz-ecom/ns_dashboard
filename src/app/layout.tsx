import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Nautilus BD Dashboard",
  description:
    "Business development dashboard migrated to Next.js and Tailwind CSS",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden font-sans">
        <Script id="ns-api-config" strategy="beforeInteractive">
          {`window.__NS_API_BASE__ = ${JSON.stringify(process.env.NEXT_PUBLIC_API_URL ?? "")};`}
        </Script>
        <Script src="/js/api-client.js?v=lead-deactivate-1" strategy="beforeInteractive" />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/sweetalert2/11.10.7/sweetalert2.all.min.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  )
}
