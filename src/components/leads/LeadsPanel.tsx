"use client"

import { leadsPanelHtml } from "./leadsPanelHtml"
import { HtmlPanel } from "@/components/shared/HtmlPanel"

export function LeadsPanel() {
  return <HtmlPanel html={leadsPanelHtml} />
}
