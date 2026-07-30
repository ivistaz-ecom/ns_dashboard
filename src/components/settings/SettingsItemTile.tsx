"use client"

import type { ReactNode } from "react"

type SettingsConfirmModalProps = {
  title: string
  titleId: string
  message: ReactNode
  confirmLabel?: string
  confirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function SettingsConfirmModal({
  title,
  titleId,
  message,
  confirmLabel = "Delete",
  confirming = false,
  onCancel,
  onConfirm,
}: SettingsConfirmModalProps) {
  return (
    <div
      className="overlay open settings-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming) onCancel()
      }}
    >
      <div className="modal settings-confirm-modal">
        <div className="settings-confirm-icon" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>
        <h3 id={titleId}>{title}</h3>
        <p className="settings-confirm-text">{message}</p>
        <div className="mbtns">
          <button
            type="button"
            className="bcancel"
            onClick={onCancel}
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bdanger settings-confirm-delete"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

type SettingsItemTileProps = {
  name: string
  subtitle: string
  enabled: boolean
  busy?: boolean
  onEdit: () => void
  onRequestDelete: () => void
  onToggle: () => void
}

export function SettingsItemTile({
  name,
  subtitle,
  enabled,
  busy = false,
  onEdit,
  onRequestDelete,
  onToggle,
}: SettingsItemTileProps) {
  const initial = (name[0] || "?").toUpperCase()

  return (
    <div
      className={`settings-country-tile${enabled ? "" : " is-disabled"}${busy ? " is-busy" : ""}`}
    >
      <div className="settings-country-main">
        <span
          className={`settings-country-avatar${enabled ? " on" : ""}`}
          aria-hidden="true"
        >
          {initial}
        </span>
        <div className="settings-country-text">
          <span className="settings-country-name">{name}</span>
          <span className="settings-country-code">{subtitle}</span>
        </div>
      </div>

      <div className="settings-tile-aside">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={onToggle}
            aria-label={`${enabled ? "Disable" : "Enable"} ${name}`}
          />
          <span className="settings-toggle-track" aria-hidden="true">
            <span className="settings-toggle-thumb" />
          </span>
        </label>

        <span className="settings-tile-divider" aria-hidden="true" />

        <div className="settings-tile-actions">
          <button
            type="button"
            className="settings-icon-btn"
            onClick={onEdit}
            disabled={busy}
            title="Edit"
            aria-label={`Edit ${name}`}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            className="settings-icon-btn is-danger"
            onClick={onRequestDelete}
            disabled={busy}
            title="Delete"
            aria-label={`Delete ${name}`}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
