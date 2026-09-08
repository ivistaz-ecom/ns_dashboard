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
  icons: {
    icon: [{ url: "/favicon-150x150.png", type: "image/png", sizes: "150x150" }],
    shortcut: "/favicon-150x150.png",
    apple: "/favicon-150x150.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ""

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__NS_API_BASE__=${JSON.stringify(apiBase)};`,
          }}
        />
      </head>
      <body className="h-full overflow-hidden font-sans">
        <Script src="/js/api-client.js?v=api-base-2" strategy="beforeInteractive" />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/sweetalert2/11.10.7/sweetalert2.all.min.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  )
}
