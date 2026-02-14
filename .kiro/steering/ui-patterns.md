---
inclusion: fileMatch
fileMatchPattern: "**/*.tsx"
---
# UI Patterns & Design System

## Layout
```
┌─────────────────────────────────────────┐
│ Header (Navigation + Auth)              │
├─────────────────────────────────────────┤
│ PageBanner (Titel + Subtitle + Actions) │
├─────────────────────────────────────────┤
│ Content (max-w-4xl mx-auto px-4)        │
└─────────────────────────────────────────┘
```

## Buttons
```tsx
// Primär
<button className="btn-primary flex items-center gap-2">
  <Plus size={20} /> Erstellen
</button>

// Sekundär
<button className="btn-secondary">Optionen</button>

// Icon-Only
<button className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600">
  <Edit size={16} />
</button>

// Danger
<button className="p-2 rounded-lg bg-dark-800 hover:bg-red-600">
  <Trash2 size={16} />
</button>
```

## Modal
```tsx
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div className="bg-dark-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-dark-700">
    {/* Header */}
    <div className="p-6 border-b border-dark-700 flex items-center justify-between">
      <h2 className="text-2xl font-bold">Titel</h2>
      <button onClick={onClose}><X size={24} /></button>
    </div>
    {/* Content */}
    <div className="p-6 overflow-y-auto max-h-[60vh]">{children}</div>
    {/* Footer */}
    <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
      <button className="btn-secondary">Abbrechen</button>
      <button className="btn-primary">Speichern</button>
    </div>
  </div>
</div>
```

## Card
```tsx
<div className="card relative hover:border-primary-500/50">
  {isAdmin && (
    <div className="absolute top-4 right-4 flex gap-2">
      <button className="p-2 rounded-lg bg-dark-800 hover:bg-primary-600">
        <Edit size={16} />
      </button>
    </div>
  )}
  <h3 className="text-xl font-bold mb-2">{title}</h3>
  <p className="text-dark-300">{description}</p>
</div>
```

## Form Input
```tsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-dark-300">
    Label <span className="text-red-500">*</span>
  </label>
  <input
    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:border-primary-500"
  />
</div>
```

## Loading
```tsx
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
```

## Farben
| Verwendung | Klasse |
|------------|--------|
| Hintergrund | `bg-dark-900`, `bg-dark-800` |
| Text | `text-white`, `text-dark-300`, `text-dark-400` |
| Primär | `primary-500`, `primary-600` |
| Fehler | `red-500`, `red-600` |
| Erfolg | `green-500` |

## Externe Weiterleitungen (OAuth, Zahlungsanbieter)
Bei Weiterleitungen zu externen Diensten (OAuth, Mollie, YouTube, Twitch, etc.) IMMER einen neuen Tab öffnen:

```tsx
// RICHTIG: Neuer Tab
window.open(externalUrl, '_blank', 'noopener,noreferrer')

// FALSCH: Gleicher Tab (verliert Kontext)
window.location.href = externalUrl
```

**Warum?**
- User verliert nicht den aktuellen Kontext/Formular
- Callback-Seite kann via `localStorage` Events kommunizieren
- Bessere UX bei OAuth-Flows (Mollie Connect, YouTube, Twitch, TikTok, etc.)

## Info-Tooltips für Funktionserklärungen
Bei komplexen Funktionen oder Einstellungen IMMER ein Info-Icon (ⓘ) mit Hover-Tooltip hinzufügen:

```tsx
import { InfoTooltip } from '@components/ui/InfoTooltip'

// Neben Labels verwenden
<label className="flex items-center gap-2">
  Exklusiv für Mitglieder
  <InfoTooltip text="Nur zahlende Mitglieder können diesen Inhalt sehen." />
</label>

// Positionen: top (default), bottom, left, right
<InfoTooltip text="Erklärung..." position="right" />

// Größe anpassen
<InfoTooltip text="Erklärung..." size={16} />
```

**Wann verwenden?**
- Bei Toggle-Switches (Exklusiv, Veröffentlicht, etc.)
- Bei Dropdown-Optionen die nicht selbsterklärend sind
- Bei technischen Einstellungen (RTMP, Stream-Key, etc.)
- Bei Preisangaben und Gebühren
- Bei Plattform-spezifischen Limits (TikTok Dauer, etc.)
