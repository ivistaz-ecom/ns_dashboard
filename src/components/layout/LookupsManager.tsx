"use client"

import { useEffect, useState } from "react"

type LookupRow = { id: number; [key: string]: unknown }
type ListName = "type" | "country" | "stage"

const CONFIG: Record<
  ListName,
  { label: string; nameField: string; list: string; create: string }
> = {
  type: { label: "Management Type", nameField: "type_name", list: "listTypes", create: "createType" },
  country: { label: "Country", nameField: "country_name", list: "listCountries", create: "createCountry" },
  stage: { label: "Stage", nameField: "status_name", list: "listStages", create: "createStage" },
}

function LookupList({ kind }: { kind: ListName }) {
  const cfg = CONFIG[kind]
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<LookupRow[]>([])
  const [newValue, setNewValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!window.NsApi) return
    setLoading(true)
    setError(null)
    try {
      const data = (await (window.NsApi[cfg.list] as () => Promise<{ items: LookupRow[] }>)()) as {
        items: LookupRow[]
      }
      setRows(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleAdd() {
    const value = newValue.trim()
    if (!value || !window.NsApi) return
    try {
      await (window.NsApi[cfg.create] as (v: string) => Promise<unknown>)(value)
      setNewValue("")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add")
    }
  }

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:text-slate-700"
      >
        {cfg.label}
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          {loading && <div className="text-xs text-slate-400">Loading…</div>}
          {error && <div className="text-xs text-red-500">{error}</div>}

          <ul className="mb-2 max-h-32 space-y-1 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id} className="truncate rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                {String(r[cfg.nameField] ?? "")}
              </li>
            ))}
            {!loading && rows.length === 0 && (
              <li className="text-xs text-slate-400">No entries yet.</li>
            )}
          </ul>

          <div className="flex gap-1">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd()
              }}
              placeholder={`Add ${cfg.label.toLowerCase()}…`}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="shrink-0 rounded bg-slate-800 px-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Static sidebar section for admin-managing the type/country/stage lookup tables. */
export function LookupsManager() {
  return (
    <div className="border-t border-slate-100 py-1">
      <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Manage Lists
      </div>
      <LookupList kind="type" />
      <LookupList kind="country" />
      <LookupList kind="stage" />
    </div>
  )
}
