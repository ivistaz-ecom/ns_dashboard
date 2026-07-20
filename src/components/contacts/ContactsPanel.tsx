"use client"

import { contactsPanelHtml } from "./contactsPanelHtml"
import { HtmlPanel } from "@/components/shared/HtmlPanel"

export function ContactsPanel() {
  return <HtmlPanel html={contactsPanelHtml} />
}
