export type RoomId = 'cr1' | 'cr2' | 'cr3a' | 'b15'

export interface RoomConfig {
  id: RoomId
  /** 显示用短代号,也是 Google Sheet 分页名 */
  name: string
  label: string
  labelEn: string
  sheetName: string
  listKey: string
  icon: string
  accent: string
}

export type SkuType = 'CTN' | 'PKT'

export interface Sku {
  type: SkuType
  name: string
  packaging: string
  itemCode: string
}

export interface Product {
  barcode: string
  itemCode: string
  name: string
  packaging: string
  skus: Sku[]
  sortOrder: number
}

/** 一笔已盘点的记录,存在本机。 */
export interface CountEntry {
  id: string
  barcode: string
  name: string
  packaging: string
  ctnItemCode: string
  pktItemCode: string
  ctnQty: number
  pktQty: number
  /** ISO 字串,排序与显示用 */
  countedAt: string
}

/** 某个房「进行中」的盘点。每次改动都立刻写进 IndexedDB。 */
export interface RoomSession {
  roomId: RoomId
  entries: CountEntry[]
  operator: string
  updatedAt: number
}

/**
 * 送去 Apps Script 的一列。栏位顺序 = Google Sheet 的 A 到 I 栏,
 * 每日点货报告照这个顺序读,不可以改。
 */
export interface SheetRow {
  sheetName: string
  date: string
  time: string
  ctnItemCode: string
  name: string
  packaging: string
  boxQuantity: number
  pktItemCode: string
  pieceQuantity: number
  counter: string
}

export type BatchStatus = 'pending' | 'syncing' | 'failed' | 'done'

/** 出货队列里的一批。batchId 是幂等键 —— 同一个 batchId 送几次,后端只写一次。 */
export interface Batch {
  batchId: string
  roomId: RoomId
  roomName: string
  sheetName: string
  operator: string
  rows: SheetRow[]
  entryCount: number
  createdAt: number
  syncedAt?: number
  attempts: number
  nextAttemptAt: number
  lastError?: string
  status: BatchStatus
}

export interface CachedProducts {
  listKey: string
  items: Product[]
  fetchedAt: number
}

export interface CachedStaff {
  id: 'staff'
  names: string[]
  fetchedAt: number
}
