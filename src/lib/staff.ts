import { STAFF_TTL_MS } from './config'
import { staffStore } from './db'
import { pgRpc } from './api'
import type { CachedStaff } from './types'

/** profiles 表对 anon 是锁死的,名单只能走这支 SECURITY DEFINER RPC。 */
export async function fetchStaff(): Promise<string[]> {
  let data: { user_name: string | null }[] | null
  try {
    data = await pgRpc<{ user_name: string | null }[] | null>('get_stock_take_staff')
  } catch (err) {
    throw new Error(`读取人员名单失败 / Failed to load operator list: ${err instanceof Error ? err.message : String(err)}`)
  }
  const names = data?.map((u) => String(u.user_name ?? '').trim()).filter(Boolean)
  if (!names || names.length === 0) throw new Error('人员名单是空的 / Operator list is empty')
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

export async function getCachedStaff(): Promise<CachedStaff | undefined> {
  return staffStore.get('staff')
}

export async function refreshStaff(): Promise<CachedStaff> {
  const names = await fetchStaff()
  const cached: CachedStaff = { id: 'staff', names, fetchedAt: Date.now() }
  await staffStore.put(cached)
  return cached
}

export function staffIsStale(cached: CachedStaff | undefined): boolean {
  return !cached || Date.now() - cached.fetchedAt > STAFF_TTL_MS
}
