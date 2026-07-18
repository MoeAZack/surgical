// Offline outbox: when the network is unavailable, new cases and complications
// are queued here and replayed automatically once the connection returns. This
// replaces the old Google-Sheets-era manual "drafts" sync.

import { apiFetch, jsonBody } from "./api";

export type OutboxKind = "operation" | "complication";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  payload: any;
  createdAt: string;
}

const KEY = "surgical_outbox";

function emitChange() {
  window.dispatchEvent(new CustomEvent("surgical_outbox_changed"));
}

export function getOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: OutboxItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  emitChange();
}

export function outboxSize(): number {
  return getOutbox().length;
}

export function enqueue(kind: OutboxKind, payload: any): OutboxItem {
  const items = getOutbox();
  const item: OutboxItem = {
    id: "ob_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    kind,
    payload,
    createdAt: new Date().toISOString()
  };
  items.push(item);
  save(items);
  return item;
}

export function removeItem(id: string): void {
  save(getOutbox().filter((i) => i.id !== id));
}

/** Replay queued items in order. Stops on the first network failure (stays
 *  queued); drops items the server rejects with a 4xx so a bad record can't
 *  block the queue forever. Returns the freshest db snapshot seen. */
export async function flushOutbox(): Promise<{ synced: number; dropped: number; remaining: number; db: any | null }> {
  let synced = 0;
  let dropped = 0;
  let db: any | null = null;

  // Snapshot ids up front; re-read the queue each loop in case it changed.
  const ids = getOutbox().map((i) => i.id);
  for (const id of ids) {
    const item = getOutbox().find((i) => i.id === id);
    if (!item) continue;
    const path = item.kind === "operation" ? "/api/operations" : "/api/complications";
    try {
      const res = await apiFetch(path, { method: "POST", ...jsonBody(item.payload) });
      if (res.ok) {
        db = await res.json();
        removeItem(item.id);
        synced++;
      } else if (res.status >= 400 && res.status < 500) {
        // Permanent client error (e.g. validation) — drop so it can't wedge the queue.
        removeItem(item.id);
        dropped++;
      } else {
        break; // transient server error — retry later
      }
    } catch {
      break; // offline again — keep the rest queued
    }
  }

  return { synced, dropped, remaining: outboxSize(), db };
}
