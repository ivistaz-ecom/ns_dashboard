"use client"

import { analyticsPanelHtml } from "./analyticsPanelHtml"
import { HtmlPanel } from "@/components/shared/HtmlPanel"

export function AnalyticsPanel() {
  return <HtmlPanel html={analyticsPanelHtml} />
}
