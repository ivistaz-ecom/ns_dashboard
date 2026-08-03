"use client"

import { memo, useEffect } from "react"
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

const DASHBOARD_JS = "/js/dashboard.js?v=call-kpi-match-9"

declare global {
  interface Window {
    switchTab?: (tab: string) => void
    __nsActivateTab?: (tab: string) => void
    __nsNavigate?: (tab: string) => void
    __NS_DASHBOARD_LOADING__?: boolean
    __NS_DASHBOARD_BOOTED__?: boolean
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

function activateDashboardTab(tab: NavTab) {
  if (typeof window.__nsActivateTab === "function") {
    window.__nsActivateTab(tab)
  } else if (typeof window.switchTab === "function") {
    window.switchTab(tab)
  }
}

export function AppShell() {
  const pathname = usePathname()
  const router = useRouter()
  const activeTab: NavTab = tabFromPath(pathname)

  useEffect(() => {
    window.__nsNavigate = (tab: string) => {
      const item = navItems.find((n) => n.tab === tab)
      if (item) router.push(item.href)
    }
    activateDashboardTab(activeTab)
  }, [activeTab, router])

  // Load dashboard.js once — Next <Script> remounts re-declare `let` and crash.
  useEffect(() => {
    if (window.__NS_DASHBOARD_BOOTED__) {
      activateDashboardTab(activeTab)
      return
    }
    if (window.__NS_DASHBOARD_LOADING__) return
    if (document.getElementById("ns-dashboard-js")) {
      window.__NS_DASHBOARD_LOADING__ = true
      return
    }

    window.__NS_DASHBOARD_LOADING__ = true
    const script = document.createElement("script")
    script.id = "ns-dashboard-js"
    script.src = DASHBOARD_JS
    script.async = true
    script.onload = () => {
      window.__NS_DASHBOARD_BOOTED__ = true
      activateDashboardTab(activeTab)
    }
    script.onerror = () => {
      window.__NS_DASHBOARD_LOADING__ = false
      console.error("[AppShell] failed to load", DASHBOARD_JS)
    }
    document.body.appendChild(script)
  }, [activeTab])

  return (
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
  )
}
