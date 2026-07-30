export type NavTab =
  | "dashboard"
  | "pipeline"
  | "weekly"
  | "leads"
  | "analytics"
  | "contacts"
  | "settings"

export const navItems: {
  tab: NavTab
  href: string
  label: string
  /** Hide from sidebar without removing the route/panel. */
  hidden?: boolean
}[] = [
  { tab: "dashboard", href: "/", label: "Dashboard" },
  { tab: "pipeline", href: "/pipeline", label: "Pipeline" },
  { tab: "weekly", href: "/weekly", label: "Weekly Tracker" },
  { tab: "leads", href: "/leads", label: "Potential Leads" },
  { tab: "analytics", href: "/analytics", label: "Analytics", hidden: true },
  { tab: "contacts", href: "/contacts", label: "Contacts" },
  { tab: "settings", href: "/settings", label: "Settings" },
]

export const tabFromPath = (pathname: string): NavTab => {
  if (pathname.startsWith("/pipeline")) return "pipeline"
  if (pathname.startsWith("/weekly")) return "weekly"
  if (pathname.startsWith("/leads")) return "leads"
  if (pathname.startsWith("/analytics")) return "analytics"
  if (pathname.startsWith("/contacts")) return "contacts"
  if (pathname.startsWith("/settings")) return "settings"
  return "dashboard"
}
