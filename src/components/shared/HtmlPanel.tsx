"use client"

import { memo, useMemo, type ReactElement } from "react"

type HtmlPanelProps = {
  html: string
  defaultActive?: boolean
}

/** Injects legacy panel markup once; memoized so route changes don't wipe live DOM. */
export const HtmlPanel = memo(function HtmlPanel({
  html,
  defaultActive = false,
}: HtmlPanelProps): ReactElement {
  const markup = useMemo(
    () => html.replace(/^<!--[\s\S]*?-->\s*/, ""),
    [html]
  )

  return (
    <div
      className={defaultActive ? "html-panel-host is-active" : "html-panel-host"}
      dangerouslySetInnerHTML={{ __html: markup }}
      suppressHydrationWarning
    />
  )
})
