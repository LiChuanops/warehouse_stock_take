import { PRODUCTS_STALE_MS } from './config'
import { productsStore } from './db'
import { pgSelect } from './api'
import type { CachedProducts, Product, Sku, SkuType } from './types'

interface RawRow {
  barcode: string | null
  item_code: string | null
  name: string | null
  packing_size: string | null
  sort_order: number | null
  skus: unknown
}

function normaliseSkus(raw: unknown, fallback: { name: string; packaging: string; itemCode: string }): Sku[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const out: Sku[] = []
    for (const s of raw as Record<string, unknown>[]) {
      const type = String(s.type ?? '').toUpperCase()
      if (type !== 'CTN' && type !== 'PKT') continue
      out.push({
        type: type as SkuType,
        name: String(s.name ?? fallback.name),
        packaging: String(s.packaging ?? fallback.packaging),
        itemCode: String(s.itemCode ?? s.item_code ?? fallback.itemCode),
      })
    }
    if (out.length > 0) return out
  }
  // 资料库没填 skus 的清单(cr3 / cr3t / cr5c 那类),当作单一箱装处理
  return [{ type: 'CTN', ...fallback }]
}

export async function fetchProducts(listKey: string): Promise<Product[]> {
  let data: RawRow[]
  try {
    data = await pgSelect<RawRow[]>('app_product_list_items', {
      select: 'barcode,item_code,name,packing_size,sort_order,skus',
      list_key: `eq.${listKey}`,
      order: 'sort_order',
    })
  } catch (err) {
    throw new Error(`读取产品清单失败 / Failed to load product list: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!data || data.length === 0) throw new Error('产品清单是空的,请先在资料库里建立 / Product list is empty — create it in the database first')

  return data.map((r, i) => {
    const barcode = String(r.barcode ?? r.item_code ?? '').trim()
    const itemCode = String(r.item_code ?? r.barcode ?? '').trim()
    const name = String(r.name ?? '(未命名)').trim()
    const packaging = String(r.packing_size ?? '').trim()
    return {
      barcode,
      itemCode,
      name,
      packaging,
      skus: normaliseSkus(r.skus, { name, packaging, itemCode }),
      sortOrder: r.sort_order ?? i,
    }
  })
}

export async function getCachedProducts(listKey: string): Promise<CachedProducts | undefined> {
  return productsStore.get(listKey)
}

export async function refreshProducts(listKey: string): Promise<CachedProducts> {
  const items = await fetchProducts(listKey)
  const cached: CachedProducts = { listKey, items, fetchedAt: Date.now() }
  await productsStore.put(cached)
  return cached
}

export function isStale(cached: CachedProducts | undefined): boolean {
  return !cached || Date.now() - cached.fetchedAt > PRODUCTS_STALE_MS
}

export function ctnSku(p: Product): Sku | undefined {
  return p.skus.find((s) => s.type === 'CTN')
}

export function pktSku(p: Product): Sku | undefined {
  return p.skus.find((s) => s.type === 'PKT')
}
