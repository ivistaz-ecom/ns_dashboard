"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { SettingsFormModal } from "@/components/settings/SettingsFormModal"
import {
  SettingsConfirmModal,
  SettingsItemTile,
} from "@/components/settings/SettingsItemTile"

type LookupRow = {
  id: number
  status?: string
  [key: string]: unknown
}

export type ListKind = "type" | "stage"
type StatusFilter = "all" | "enabled" | "disabled"

type ListConfig = {
  kind: ListKind
  label: string
  nameField: string
  listKey: "listTypes" | "listStages"
  createKey: "createType" | "createStage"
  updateKey: "updateType" | "updateStage"
  deleteKey: "deleteType" | "deleteStage"
  searchPlaceholder: string
  emptyTitle: string
  namePlaceholder: string
}

const LISTS: Record<ListKind, ListConfig> = {
  type: {
    kind: "type",
    label: "Management Type",
    nameField: "type_name",
    listKey: "listTypes",
    createKey: "createType",
    updateKey: "updateType",
    deleteKey: "deleteType",
    searchPlaceholder: "Search management types…",
    emptyTitle: "No management types match",
    namePlaceholder: "e.g. Asset Manager",
  },
  stage: {
    kind: "stage",
    label: "Stage",
    nameField: "status_name",
    listKey: "listStages",
    createKey: "createStage",
    updateKey: "updateStage",
    deleteKey: "deleteStage",
    searchPlaceholder: "Search stages…",
    emptyTitle: "No stages match",
    namePlaceholder: "e.g. Email Outreach",
  },
}

declare global {
  interface Window {
    reloadNsLookups?: () => Promise<void>
  }
}

async function refreshLookups() {
  if (typeof window.reloadNsLookups === "function") {
    await window.reloadNsLookups()
  }
}

function isEnabled(row: LookupRow) {
  return String(row.status || "active").toLowerCase() !== "inactive"
}

function rowName(row: LookupRow, nameField: string) {
  return String(row[nameField] ?? "")
}

export function ManageListPanel({
  kind,
  onCountsChange,
}: {
  kind: ListKind
  onCountsChange?: (counts: {
    total: number
    enabled: number
    disabled: number
    loading: boolean
  }) => void
}) {
  const cfg = LISTS[kind]
  const [rows, setRows] = useState<LookupRow[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<Set<number>>(() => new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editRow, setEditRow] = useState<LookupRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LookupRow | null>(null)

  const load = useCallback(async () => {
    const listFn = window.NsApi?.[cfg.listKey] as
      | (() => Promise<{ items?: LookupRow[] } | LookupRow[]>)
      | undefined
    if (!listFn) return
    setLoading(true)
    setError(null)
    try {
      const data = await listFn()
      const items = Array.isArray(data) ? data : data.items || []
      setRows(
        items.sort((a, b) =>
          rowName(a, cfg.nameField).localeCompare(rowName(b, cfg.nameField)),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [cfg.listKey, cfg.nameField])

  useEffect(() => {
    void load()
  }, [load])

  const enabledCount = useMemo(() => rows.filter(isEnabled).length, [rows])
  const disabledCount = rows.length - enabledCount

  useEffect(() => {
    onCountsChange?.({
      total: rows.length,
      enabled: enabledCount,
      disabled: disabledCount,
      loading,
    })
  }, [rows.length, enabledCount, disabledCount, loading, onCountsChange])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      const enabled = isEnabled(row)
      if (statusFilter === "enabled" && !enabled) return false
      if (statusFilter === "disabled" && enabled) return false
      if (!q) return true
      return rowName(row, cfg.nameField).toLowerCase().includes(q)
    })
  }, [rows, search, statusFilter, cfg.nameField])

  const groups = useMemo(() => {
    const map = new Map<string, LookupRow[]>()
    for (const row of filtered) {
      const name = rowName(row, cfg.nameField)
      const letter = (name[0] || "#").toUpperCase()
      const key = /[A-Z]/.test(letter) ? letter : "#"
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [filtered, cfg.nameField])

  function nameExists(value: string, exceptId?: number) {
    return rows.some(
      (r) =>
        r.id !== exceptId &&
        rowName(r, cfg.nameField).toLowerCase() === value.toLowerCase(),
    )
  }

  async function handleAdd(value: string) {
    const createFn = window.NsApi?.[cfg.createKey] as
      | ((name: string) => Promise<unknown>)
      | undefined
    if (!createFn || adding) return
    if (nameExists(value)) {
      setFormError(`“${value}” already exists`)
      return
    }

    setAdding(true)
    setFormError(null)
    try {
      await createFn(value)
      setAddOpen(false)
      setStatusFilter("all")
      setSearch("")
      await load()
      await refreshLookups()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : `Failed to add ${cfg.label.toLowerCase()}`,
      )
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(row: LookupRow, value: string) {
    const updateFn = window.NsApi?.[cfg.updateKey] as
      | ((id: number, data: Record<string, string>) => Promise<unknown>)
      | undefined
    if (!updateFn || savingIds.has(row.id)) return

    if (rowName(row, cfg.nameField) === value) {
      setEditRow(null)
      return
    }
    if (nameExists(value, row.id)) {
      setFormError(`“${value}” already exists`)
      return
    }

    setSavingIds((prev) => new Set(prev).add(row.id))
    setFormError(null)
    try {
      await updateFn(row.id, { [cfg.nameField]: value })
      setEditRow(null)
      await load()
      await refreshLookups()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : `Failed to update ${cfg.label.toLowerCase()}`,
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
    const deleteFn = window.NsApi?.[cfg.deleteKey] as
      | ((id: number) => Promise<unknown>)
      | undefined
    const updateFn = window.NsApi?.[cfg.updateKey] as
      | ((id: number, data: { status: string }) => Promise<unknown>)
      | undefined
    if (savingIds.has(row.id)) return

    setSavingIds((prev) => new Set(prev).add(row.id))
    setError(null)
    try {
      if (deleteFn) {
        await deleteFn(row.id)
      } else if (updateFn) {
        await updateFn(row.id, { status: "inactive" })
      } else {
        throw new Error("Delete is not available")
      }
      setPendingDelete(null)
      await load()
      await refreshLookups()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to delete ${cfg.label.toLowerCase()}`,
      )
      setPendingDelete(null)
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    }
  }

  async function toggleRow(row: LookupRow) {
    const updateFn = window.NsApi?.[cfg.updateKey] as
      | ((id: number, data: { status: string }) => Promise<unknown>)
      | undefined
    if (!updateFn || savingIds.has(row.id)) return
    const nextStatus = isEnabled(row) ? "inactive" : "active"
    setSavingIds((prev) => new Set(prev).add(row.id))
    setError(null)
    try {
      await updateFn(row.id, { status: nextStatus })
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)),
      )
      await refreshLookups()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to update ${cfg.label.toLowerCase()}`,
      )
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    }
  }

  const pendingName = pendingDelete ? rowName(pendingDelete, cfg.nameField) : ""

  return (
    <>
      {addOpen && (
        <SettingsFormModal
          mode="add"
          entityLabel={cfg.label}
          titleId={`settings-add-${cfg.kind}`}
          nameLabel={`${cfg.label} name`}
          namePlaceholder={cfg.namePlaceholder}
          saving={adding}
          error={formError}
          onCancel={() => {
            setAddOpen(false)
            setFormError(null)
          }}
          onSubmit={({ name }) => void handleAdd(name)}
        />
      )}

      {editRow && (
        <SettingsFormModal
          mode="edit"
          entityLabel={cfg.label}
          titleId={`settings-edit-${cfg.kind}`}
          nameLabel={`${cfg.label} name`}
          namePlaceholder={cfg.namePlaceholder}
          initialName={rowName(editRow, cfg.nameField)}
          saving={savingIds.has(editRow.id)}
          error={formError}
          onCancel={() => {
            setEditRow(null)
            setFormError(null)
          }}
          onSubmit={({ name }) => void handleSaveEdit(editRow, name)}
        />
      )}

      {pendingDelete && (
        <SettingsConfirmModal
          title={`Delete ${cfg.label}?`}
          titleId={`settings-delete-title-${cfg.kind}`}
          message={
            <>
              You’re about to remove <strong>“{pendingName}”</strong> from{" "}
              {cfg.label.toLowerCase()} lists. It will no longer appear in
              filters and forms.
            </>
          }
          confirming={savingIds.has(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      <div className="settings-toolbar">
        <div
          className="settings-filters"
          role="tablist"
          aria-label={`${cfg.label} status`}
        >
          {(
            [
              ["all", "All", rows.length],
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
              placeholder={cfg.searchPlaceholder}
              aria-label={`Search ${cfg.label.toLowerCase()}s`}
            />
          </div>

          <button
            type="button"
            className="settings-add-cta"
            onClick={() => {
              setFormError(null)
              setAddOpen(true)
            }}
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
            New {cfg.label}
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
            <div className="settings-empty-title">{cfg.emptyTitle}</div>
            <p>
              {rows.length === 0
                ? `Create your first ${cfg.label.toLowerCase()} to get started.`
                : "Try a different search or status filter."}
            </p>
            {rows.length === 0 && (
              <button
                type="button"
                className="settings-add-cta"
                onClick={() => {
                  setFormError(null)
                  setAddOpen(true)
                }}
              >
                New {cfg.label}
              </button>
            )}
          </div>
        )}

        {!loading &&
          groups.map(([letter, groupRows]) => (
            <section key={letter} className="settings-letter-group">
              <div className="settings-letter-label">{letter}</div>
              <div className="settings-grid">
                {groupRows.map((row) => {
                  const enabled = isEnabled(row)
                  return (
                    <SettingsItemTile
                      key={row.id}
                      name={rowName(row, cfg.nameField)}
                      subtitle={
                        enabled ? "Available in forms" : "Hidden from forms"
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
                      onToggle={() => void toggleRow(row)}
                    />
                  )
                })}
              </div>
            </section>
          ))}
      </div>
    </>
  )
}
