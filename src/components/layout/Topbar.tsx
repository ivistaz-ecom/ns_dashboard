"use client"

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          id="global-search"
          placeholder="Search companies, notes..."
          onInput={(e) => window.globalSearch?.((e.target as HTMLInputElement).value)}
        />
      </div>
      <div className="topbar-actions">
        <button
          className="topbar-btn"
          title="Export to Excel"
          type="button"
          onClick={() => window.exportData?.()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>
        <div className="topbar-avatar">J</div>
      </div>
    </header>
  )
}
