"use client"

export function Topbar() {
  function handleExport() {
    if (typeof window.exportData === "function") {
      window.exportData()
      return
    }
    alert("Export is still loading. Please try again in a moment.")
  }

  return (
    <header className="topbar">
      <div className="topbar-actions">
        <button
          className="topbar-btn"
          title="Export to Excel"
          type="button"
          onClick={handleExport}
          aria-label="Export to Excel"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>
      </div>
    </header>
  )
}
