"use client"

import Script from "next/script"
import { dashboardHtml } from "./dashboard-template"

export default function Home() {
  return (
    <>
      <main
        className="dashboard-root"
        dangerouslySetInnerHTML={{ __html: dashboardHtml }}
        suppressHydrationWarning
      />
      <Script src="/dashboard.js" strategy="afterInteractive" />
    </>
  )
}
