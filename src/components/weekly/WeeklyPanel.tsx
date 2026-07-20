"use client"

import { weeklyPanelHtml } from "./weeklyPanelHtml"
import { HtmlPanel } from "@/components/shared/HtmlPanel"

export function WeeklyPanel() {
  return <HtmlPanel html={weeklyPanelHtml} />
}
