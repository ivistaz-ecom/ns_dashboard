"use client"

import { memo, useMemo, type ReactElement } from "react"

type HtmlPanelProps = {
  html: string
}

/** Injects legacy panel markup once; memoized so route changes don't wipe live DOM. */
export const HtmlPanel = memo(function HtmlPanel({
  html,
}: HtmlPanelProps): ReactElement {
  const markup = useMemo(
    () => html.replace(/^<!--[\s\S]*?-->\s*/, ""),
    [html]
  )

  return (
    <div
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: markup }}
      suppressHydrationWarning
    />
  )
})
