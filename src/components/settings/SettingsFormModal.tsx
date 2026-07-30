"use client"

import { useEffect, useRef, useState } from "react"

type SettingsFormModalProps = {
  mode: "add" | "edit"
  entityLabel: string
  titleId: string
  nameLabel: string
  namePlaceholder: string
  initialName?: string
  secondaryLabel?: string
  secondaryPlaceholder?: string
  initialSecondary?: string
  saving?: boolean
  error?: string | null
  onCancel: () => void
  onSubmit: (values: { name: string; secondary: string }) => void
}

export function SettingsFormModal({
  mode,
  entityLabel,
  titleId,
  nameLabel,
  namePlaceholder,
  initialName = "",
  secondaryLabel,
  secondaryPlaceholder,
  initialSecondary = "",
  saving = false,
  error,
  onCancel,
  onSubmit,
}: SettingsFormModalProps) {
  const [name, setName] = useState(initialName)
  const [secondary, setSecondary] = useState(initialSecondary)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel, saving])

  const canSubmit = name.trim().length > 0 && !saving

  return (
    <div
      className="overlay open settings-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
    >
      <form
        className="modal settings-form-modal"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) onSubmit({ name: name.trim(), secondary: secondary.trim() })
        }}
      >
        <div className="modal-header settings-form-header">
          <div className="settings-form-heading">
            <span
              className={`settings-form-icon${mode === "edit" ? " is-edit" : ""}`}
              aria-hidden="true"
            >
              {mode === "add" ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              )}
            </span>
            <div>
              <div className="modal-title" id={titleId}>
                {mode === "add" ? `Add ${entityLabel}` : `Edit ${entityLabel}`}
              </div>
              <p className="settings-form-sub">
                {mode === "add"
                  ? `New entries are enabled and appear in filters and forms right away.`
                  : `Renaming updates every filter and form that uses this ${entityLabel.toLowerCase()}.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && <div className="settings-form-error">{error}</div>}

        <div className="form-row">
          <label htmlFor={`${titleId}-name`}>{nameLabel}</label>
          <input
            id={`${titleId}-name`}
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
            disabled={saving}
            autoComplete="off"
          />
        </div>

        {secondaryLabel && (
          <div className="form-row">
            <label htmlFor={`${titleId}-secondary`}>{secondaryLabel}</label>
            <input
              id={`${titleId}-secondary`}
              type="text"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              placeholder={secondaryPlaceholder}
              disabled={saving}
              autoComplete="off"
            />
          </div>
        )}

        <div className="mbtns">
          <button
            type="button"
            className="bcancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="bsave" disabled={!canSubmit}>
            {saving
              ? mode === "add"
                ? "Adding…"
                : "Saving…"
              : mode === "add"
                ? "Add"
                : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
