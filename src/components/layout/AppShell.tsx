"use client"

import { memo, useEffect, useState } from "react"
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

const DASHBOARD_JS = "/js/dashboard.js?v=perf-boot-1"

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

function dashboardScriptReady() {
  return typeof window.__nsActivateTab === "function"
}

export function AppShell() {
  const pathname = usePathname()
  const router = useRouter()
  const activeTab: NavTab = tabFromPath(pathname)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    window.__nsNavigate = (tab: string) => {
      const item = navItems.find((n) => n.tab === tab)
      if (item) router.push(item.href)
    }
  }, [router])

  useEffect(() => {
    let alive = true

    function onReady() {
      window.__NS_DASHBOARD_BOOTED__ = true
      if (!alive) return
      setScriptReady(true)
      activateDashboardTab(activeTab)
    }

    if (dashboardScriptReady()) {
      onReady()
      return () => {
        alive = false
      }
    }

    let script = document.getElementById(
      "ns-dashboard-js"
    ) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement("script")
      script.id = "ns-dashboard-js"
      script.src = DASHBOARD_JS
      script.async = true
      script.onerror = () => {
        window.__NS_DASHBOARD_LOADING__ = false
        console.error("[AppShell] failed to load", DASHBOARD_JS)
      }
      document.body.appendChild(script)
    }

    script.addEventListener("load", onReady)
    if (dashboardScriptReady()) onReady()

    return () => {
      alive = false
      script?.removeEventListener("load", onReady)
    }
  }, [activeTab])

  return (
    <main className="dashboard-root">
      <div className="app-shell">
        <Sidebar activeTab={activeTab} />
        <div className="main-area">
          <Topbar />
          <div className="main-stage">
            <MainPanels />
            {!scriptReady && (
              <div className="dashboard-boot-mask" role="status">
                Loading dashboard…
              </div>
            )}
          </div>
        </div>
      </div>
      <DashboardModals />
    </main>
  )
}
