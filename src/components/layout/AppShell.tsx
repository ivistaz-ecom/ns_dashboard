"use client"

import { memo, useEffect } from "react"
import Script from "next/script"
import { usePathname, useRouter } from "next/navigation"
import { tabFromPath, navItems, type NavTab } from "@/config/nav"
import { Sidebar } from "@/components/layout/Sidebar"
import { Topbar } from "@/components/layout/Topbar"
import { DashboardPanel } from "@/components/dashboard/DashboardPanel"
import { WeeklyPanel } from "@/components/weekly/WeeklyPanel"
import { LeadsPanel } from "@/components/leads/LeadsPanel"
import { AnalyticsPanel } from "@/components/analytics/AnalyticsPanel"
import { ContactsPanel } from "@/components/contacts/ContactsPanel"
import { SettingsPanel } from "@/components/settings/SettingsPanel"
import { DashboardModals } from "@/components/shared/DashboardModals"

declare global {
  interface Window {
    switchTab?: (tab: string) => void
    __nsActivateTab?: (tab: string) => void
    __nsNavigate?: (tab: string) => void
    globalSearch?: (q: string) => void
    exportData?: () => void
    setPipelineView?: (mode: string) => void
    setLeadsView?: (mode: string) => void
    editPipelineCompany?: (id: number | null) => void
    openPipelineTrash?: () => void
  }
}

/** Panels are isolated so sidebar/route updates never remount them. */
const MainPanels = memo(function MainPanels() {
  return (
    <div className="main-content" id="main-content">
      <DashboardPanel />
      <WeeklyPanel />
      <LeadsPanel />
      <AnalyticsPanel />
      <ContactsPanel />
      <SettingsPanel />
    </div>
  )
})

export function AppShell() {
  const pathname = usePathname()
  const router = useRouter()
  const activeTab: NavTab = tabFromPath(pathname)

  useEffect(() => {
    window.__nsNavigate = (tab: string) => {
      const item = navItems.find((n) => n.tab === tab)
      if (item) router.push(item.href)
    }

    if (typeof window.__nsActivateTab === "function") {
      window.__nsActivateTab(activeTab)
    } else if (typeof window.switchTab === "function") {
      window.switchTab(activeTab)
    }
  }, [activeTab, router])

  return (
    <>
      <main className="dashboard-root">
        <div className="app-shell">
          <Sidebar activeTab={activeTab} />
          <div className="main-area">
            <Topbar />
            <MainPanels />
          </div>
        </div>
        <DashboardModals />
      </main>
      <Script
        src="/js/dashboard.js?v=ads-megaphone-icon-1"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window.__nsActivateTab === "function") {
            window.__nsActivateTab(activeTab)
          } else if (typeof window.switchTab === "function") {
            window.switchTab(activeTab)
          }
        }}
      />
    </>
  )
}
