"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ManageListPanel } from "@/components/settings/ManageListsSection"
import { SettingsFormModal } from "@/components/settings/SettingsFormModal"
import {
  SettingsConfirmModal,
  SettingsItemTile,
} from "@/components/settings/SettingsItemTile"

type CountryRow = {
  id: number
  country_name: string
  country_prefix?: string | null
  status?: string
}

type CountriesResponse = {
  items: CountryRow[]
  total: number
  page: number
  per_page: number
}

type StatusFilter = "all" | "enabled" | "disabled"
type SettingsTab = "country" | "stage" | "type"

type TabCounts = {
  total: number
  enabled: number
  disabled: number
  loading: boolean
}

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "country", label: "Country" },
  { id: "stage", label: "Stage" },
  { id: "type", label: "Management Type" },
]

const TAB_SUBTITLES: Record<SettingsTab, string> = {
  country: "Control which countries appear in filters and forms",
  stage: "Control which stages appear in filters and forms",
  type: "Control which management types appear in filters and forms",
}

declare global {
  interface Window {
    reloadNsLookups?: () => Promise<void>
  }
}

function isEnabled(row: CountryRow) {
  return String(row.status || "active").toLowerCase() !== "inactive"
}

async function refreshLookups() {
  if (typeof window.reloadNsLookups === "function") {
    await window.reloadNsLookups()
  }
}

async function fetchAllCountries(): Promise<CountryRow[]> {
  const listCountries = window.NsApi?.listCountries as
    | ((filters?: Record<string, string | number>) => Promise<CountriesResponse>)
    | undefined
  if (!listCountries) return []
  const perPage = 200
  let page = 1
  let items: CountryRow[] = []
  let total = Infinity

  while (items.length < total) {
    const data = await listCountries({
      per_page: perPage,
      page,
    })
    const batch = data.items || []
    items = items.concat(batch)
    total = typeof data.total === "number" ? data.total : items.length
    if (!batch.length) break
    page += 1
  }

  return items.sort((a, b) =>
    String(a.country_name || "").localeCompare(String(b.country_name || "")),
  )
}

export function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("country")
  const [countries, setCountries] = useState<CountryRow[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<Set<number>>(() => new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editRow, setEditRow] = useState<CountryRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CountryRow | null>(null)
  const [listCounts, setListCounts] = useState<TabCounts>({
    total: 0,
    enabled: 0,
    disabled: 0,
    loading: true,
  })

  const load = useCallback(async () => {
    if (!window.NsApi?.listCountries) return
    setLoading(true)
    setError(null)
    try {
      setCountries(await fetchAllCountries())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load countries")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onListCountsChange = useCallback((counts: TabCounts) => {
    setListCounts(counts)
  }, [])

  const enabledCount = useMemo(
    () => countries.filter(isEnabled).length,
    [countries],
  )
  const disabledCount = countries.length - enabledCount

  const heroCounts = useMemo(() => {
    if (activeTab === "country") {
      return {
        enabled: enabledCount,
        disabled: disabledCount,
        show: !loading && countries.length > 0,
      }
    }
    return {
      enabled: listCounts.enabled,
      disabled: listCounts.disabled,
      show: !listCounts.loading && listCounts.total > 0,
    }
  }, [
    activeTab,
    enabledCount,
    disabledCount,
    loading,
    countries.length,
    listCounts,
  ])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return countries.filter((c) => {
      const enabled = isEnabled(c)
      if (statusFilter === "enabled" && !enabled) return false
      if (statusFilter === "disabled" && enabled) return false
      if (!q) return true
      const name = String(c.country_name || "").toLowerCase()
      const prefix = String(c.country_prefix || "").toLowerCase()
      return name.includes(q) || prefix.includes(q)
    })
  }, [countries, search, statusFilter])

  const groups = useMemo(() => {
    const map = new Map<string, CountryRow[]>()
    for (const row of filtered) {
      const letter = (row.country_name?.[0] || "#").toUpperCase()
      const key = /[A-Z]/.test(letter) ? letter : "#"
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [filtered])

  function nameExists(value: string, exceptId?: number) {
    return countries.some(
      (c) =>
        c.id !== exceptId &&
        String(c.country_name || "").toLowerCase() === value.toLowerCase(),
    )
  }

  async function handleAddCountry(name: string, prefix: string) {
    const createCountry = window.NsApi?.createCountry as
      | ((country_name: string, country_prefix?: string) => Promise<unknown>)
      | undefined
    if (!createCountry || adding) return
    if (nameExists(name)) {
      setFormError(`“${name}” already exists`)
      return
    }

    setAdding(true)
    setFormError(null)
    try {
      await createCountry(name, prefix || undefined)
      setAddOpen(false)
      setStatusFilter("all")
      setSearch("")
      setCountries(await fetchAllCountries())
      await refreshLookups()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add country")
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(row: CountryRow, name: string, prefix: string) {
    const updateCountry = window.NsApi?.updateCountry as
      | ((
          id: number,
          data: { country_name: string; country_prefix?: string },
        ) => Promise<unknown>)
      | undefined
    if (!updateCountry || savingIds.has(row.id)) return

    if (
      row.country_name === name &&
      String(row.country_prefix || "") === prefix
    ) {
      setEditRow(null)
      return
    }
    if (nameExists(name, row.id)) {
      setFormError(`“${name}” already exists`)
      return
    }

    setSavingIds((prev) => new Set(prev).add(row.id))
    setFormError(null)
    try {
      await updateCountry(row.id, {
        country_name: name,
        country_prefix: prefix || undefined,
      })
      setEditRow(null)
      setCountries(await fetchAllCountries())
      await refreshLookups()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update country",
      )
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    }
  }

  async function confirmDelete() {
    const row = pendingDelete
    if (!row) return
    const deleteCountry = window.NsApi?.deleteCountry as
      | ((id: number) => Promise<unknown>)
      | undefined
    const updateCountry = window.NsApi?.updateCountry as
      | ((id: number, data: { status: string }) => Promise<unknown>)
      | undefined
    if (savingIds.has(row.id)) return

    setSavingIds((prev) => new Set(prev).add(row.id))
    setError(null)
    try {
      if (deleteCountry) {
        await deleteCountry(row.id)
      } else if (updateCountry) {
        await updateCountry(row.id, { status: "inactive" })
      } else {
        throw new Error("Delete is not available")
      }
      setPendingDelete(null)
      setCountries(await fetchAllCountries())
      await refreshLookups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete country")
      setPendingDelete(null)
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    }
  }

  async function toggleCountry(row: CountryRow) {
    const updateCountry = window.NsApi?.updateCountry as
      | ((id: number, data: { status: string }) => Promise<unknown>)
      | undefined
    if (!updateCountry || savingIds.has(row.id)) return
    const nextStatus = isEnabled(row) ? "inactive" : "active"
    setSavingIds((prev) => new Set(prev).add(row.id))
    setError(null)
    try {
      await updateCountry(row.id, { status: nextStatus })
      setCountries((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, status: nextStatus } : c)),
      )
      await refreshLookups()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update country")
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    }
  }

  function openAdd() {
    setFormError(null)
    setAddOpen(true)
  }

  return (
    <div className="panel" id="panel-settings">
      {addOpen && (
        <SettingsFormModal
          mode="add"
          entityLabel="Country"
          titleId="settings-add-country"
          nameLabel="Country name"
          namePlaceholder="e.g. Singapore"
          secondaryLabel="Country code (optional)"
          secondaryPlaceholder="e.g. SG"
          saving={adding}
          error={formError}
          onCancel={() => {
            setAddOpen(false)
            setFormError(null)
          }}
          onSubmit={({ name, secondary }) =>
            void handleAddCountry(name, secondary)
          }
        />
      )}

      {editRow && (
        <SettingsFormModal
          mode="edit"
          entityLabel="Country"
          titleId="settings-edit-country"
          nameLabel="Country name"
          namePlaceholder="e.g. Singapore"
          initialName={editRow.country_name}
          secondaryLabel="Country code (optional)"
          secondaryPlaceholder="e.g. SG"
          initialSecondary={editRow.country_prefix || ""}
          saving={savingIds.has(editRow.id)}
          error={formError}
          onCancel={() => {
            setEditRow(null)
            setFormError(null)
          }}
          onSubmit={({ name, secondary }) =>
            void handleSaveEdit(editRow, name, secondary)
          }
        />
      )}

      {pendingDelete && (
        <SettingsConfirmModal
          title="Delete Country?"
          titleId="settings-delete-title-country"
          message={
            <>
              You’re about to remove{" "}
              <strong>“{pendingDelete.country_name}”</strong> from country
              lists. It will no longer appear in filters and forms.
            </>
          }
          confirming={savingIds.has(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      <div className="page-hero settings-hero">
        <div>
          <h2 className="greeting">Settings</h2>
          <p className="greeting-sub">{TAB_SUBTITLES[activeTab]}</p>
        </div>
        {heroCounts.show && (
          <div className="settings-hero-meta" aria-live="polite">
            <span>
              <strong>{heroCounts.enabled}</strong> enabled
            </span>
            <span className="settings-hero-dot" aria-hidden="true" />
            <span>
              <strong>{heroCounts.disabled}</strong> disabled
            </span>
          </div>
        )}
      </div>

      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Settings sections"
      >
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`settings-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            className={`settings-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id !== "country") {
                setListCounts({
                  total: 0,
                  enabled: 0,
                  disabled: 0,
                  loading: true,
                })
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="settings-tab-panel"
        role="tabpanel"
        id={`settings-panel-${activeTab}`}
        aria-labelledby={`settings-tab-${activeTab}`}
      >
        {activeTab === "country" && (
          <>
            <div className="settings-toolbar">
              <div
                className="settings-filters"
                role="tablist"
                aria-label="Country status"
              >
                {(
                  [
                    ["all", "All", countries.length],
                    ["enabled", "Enabled", enabledCount],
                    ["disabled", "Disabled", disabledCount],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === key}
                    className={`settings-filter${statusFilter === key ? " active" : ""}`}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                    <span className="settings-filter-count">{count}</span>
                  </button>
                ))}
              </div>

              <div className="settings-toolbar-end">
                <div className="search-field settings-search">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or code…"
                    aria-label="Search countries"
                  />
                </div>

                <button
                  type="button"
                  className="settings-add-cta"
                  onClick={openAdd}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden="true"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Country
                </button>
              </div>
            </div>

            {error && <div className="settings-error">{error}</div>}

            <div className="settings-scroll">
              {loading && (
                <div
                  className="settings-grid settings-grid-skeleton"
                  aria-hidden="true"
                >
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="settings-country-tile skeleton" />
                  ))}
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="settings-empty">
                  <div className="settings-empty-title">No countries match</div>
                  <p>
                    {countries.length === 0
                      ? "Create your first country to get started."
                      : "Try a different search or status filter."}
                  </p>
                  {countries.length === 0 && (
                    <button
                      type="button"
                      className="settings-add-cta"
                      onClick={openAdd}
                    >
                      New Country
                    </button>
                  )}
                </div>
              )}

              {!loading &&
                groups.map(([letter, rows]) => (
                  <section key={letter} className="settings-letter-group">
                    <div className="settings-letter-label">{letter}</div>
                    <div className="settings-grid">
                      {rows.map((row) => {
                        const enabled = isEnabled(row)
                        return (
                          <SettingsItemTile
                            key={row.id}
                            name={row.country_name}
                            subtitle={
                              row.country_prefix
                                ? row.country_prefix
                                : enabled
                                  ? "Available in forms"
                                  : "Hidden from forms"
                            }
                            enabled={enabled}
                            busy={savingIds.has(row.id)}
                            onEdit={() => {
                              setFormError(null)
                              setEditRow(row)
                            }}
                            onRequestDelete={() => {
                              setError(null)
                              setPendingDelete(row)
                            }}
                            onToggle={() => void toggleCountry(row)}
                          />
                        )
                      })}
                    </div>
                  </section>
                ))}
            </div>
          </>
        )}

        {activeTab === "stage" && (
          <ManageListPanel kind="stage" onCountsChange={onListCountsChange} />
        )}

        {activeTab === "type" && (
          <ManageListPanel kind="type" onCountsChange={onListCountsChange} />
        )}
      </div>
    </div>
  )
}
