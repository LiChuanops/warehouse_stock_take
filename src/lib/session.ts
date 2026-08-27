import { sessionsStore } from './db'
import { formatDate, formatTime, newId } from './format'
import type { Batch, CountEntry, Product, RoomConfig, RoomId, RoomSession, SheetRow } from './types'
import { ctnSku, pktSku } from './products'

export function emptySession(roomId: RoomId): RoomSession {
  return { roomId, entries: [], operator: '', updatedAt: Date.now() }
}

export async function loadSession(roomId: RoomId): Promise<RoomSession> {
  return (await sessionsStore.get(roomId)) ?? emptySession(roomId)
}

export async function persistSession(session: RoomSession): Promise<void> {
  await sessionsStore.put({ ...session, updatedAt: Date.now() })
}

export async function clearSession(roomId: RoomId): Promise<void> {
  await sessionsStore.put(emptySession(roomId))
}

export async function loadAllSessions(): Promise<RoomSession[]> {
  return sessionsStore.getAll()
}

export function makeEntry(product: Product, ctnQty: number, pktQty: number): CountEntry {
  return {
    id: newId(),
    barcode: product.barcode,
    name: product.name,
    packaging: product.packaging,
    ctnItemCode: ctnSku(product)?.itemCode ?? '',
    pktItemCode: pktSku(product)?.itemCode ?? '',
    ctnQty,
    pktQty,
    countedAt: new Date().toISOString(),
  }
}

/**
 * 把一份盘点整理成要送出去的批次。
 * rows 的栏位顺序 = Google Sheet 的 A 到 I 栏,每日点货报告照这个顺序读,不可以改。
 */
export function buildBatch(room: RoomConfig, session: RoomSession): Batch {
  const rows: SheetRow[] = session.entries.map((e) => {
    const d = new Date(e.countedAt)
    return {
      sheetName: room.sheetName,
      date: formatDate(d),
      time: formatTime(d),
      ctnItemCode: e.ctnItemCode,
      name: e.name,
      packaging: e.packaging,
      boxQuantity: e.ctnQty,
      pktItemCode: e.pktItemCode,
      pieceQuantity: e.pktQty,
      counter: session.operator,
    }
  })

  return {
    batchId: newId(),
    roomId: room.id,
    roomName: room.name,
    sheetName: room.sheetName,
    operator: session.operator,
    rows,
    entryCount: rows.length,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    status: 'pending',
  }
}

/**
 * 把一笔已存的记录还原成 Product 的样子,给「修改数量」的弹层用。
 * 这样记录页不必再去载入整份产品清单。
 */
export function entryToProduct(e: CountEntry): Product {
  const skus: Product['skus'] = []
  if (e.ctnItemCode) skus.push({ type: 'CTN', name: e.name, packaging: e.packaging, itemCode: e.ctnItemCode })
  if (e.pktItemCode) skus.push({ type: 'PKT', name: e.name, packaging: e.packaging, itemCode: e.pktItemCode })
  if (skus.length === 0) skus.push({ type: 'CTN', name: e.name, packaging: e.packaging, itemCode: '' })
  return {
    barcode: e.barcode,
    itemCode: e.ctnItemCode || e.pktItemCode,
    name: e.name,
    packaging: e.packaging,
    skus,
    sortOrder: 0,
  }
}
