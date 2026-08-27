import type { RoomConfig } from './types'

/**
 * Supabase anon key —— 这把钥匙是「设计上就公开」的,前端一定看得到。
 * 它的权限完全由资料库的 RLS 决定,目前只能读 app_product_list_items
 * 和呼叫 get_stock_take_staff 这支 RPC。
 *
 * ⚠️ 绝对不要把 service_role key 放进这个 repo。那把钥匙无视 RLS,
 *    等于整个资料库的万能钥匙,只能待在 Apps Script 服务端。
 */
export const SUPABASE_URL = 'https://jbpvqlvlokvqpkulisxi.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpicHZxbHZsb2t2cXBrdWxpc3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNTE3NzYsImV4cCI6MjA3NTYyNzc3Nn0.cwCoHFCy3K_HdTIIk_jJUCgMXIdub2HbnxqTETBKans'

/** Apps Script 的 /exec 网址。换新部署版本时改这里。 */
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyJckzalJVidtiiih_aBZc_Ec-KW92eJgke5xRgIGte7hMUzvVKx4MhzSXwxzvS-28/exec'

/**
 * 四个冷房。
 * sheetName 必须跟 Google Sheet 的分页名称一字不差 —— 每日点货报告是照这个名字读的。
 * listKey 对应 Supabase 的 app_product_list_items.list_key。
 */
export const ROOMS: RoomConfig[] = [
  { id: 'cr1', name: 'CR1', label: '一号冷房', labelEn: 'Coldroom 1', sheetName: 'CR1', listKey: 'cr1-stock-take', icon: 'icons/cr1.png', accent: '#0ea5e9' },
  { id: 'cr2', name: 'CR2', label: '二号冷房', labelEn: 'Coldroom 2', sheetName: 'CR2', listKey: 'cr2-stock-take', icon: 'icons/cr2.png', accent: '#22c55e' },
  { id: 'cr3a', name: 'CR3A', label: '三A冷房', labelEn: 'Coldroom 3A', sheetName: 'CR3A', listKey: 'cr3a-stock-take', icon: 'icons/cr3a.png', accent: '#a855f7' },
  { id: 'b15', name: 'B15', label: '15座仓库', labelEn: 'Block 15', sheetName: 'B15', listKey: 'b15-stock-take', icon: 'icons/b15.png', accent: '#f59e0b' },
]

export function getRoom(id: string | undefined): RoomConfig | undefined {
  return ROOMS.find((r) => r.id === id)
}

/**
 * 送不出去时的重试间隔(毫秒)。最后一档会一直沿用。
 *
 * 第一步不能太短:客户端放弃之后,Apps Script 那边其实还在跑、还握着锁。
 * 马上重试只会卡在锁上,等于自己堵自己。
 */
export const RETRY_BACKOFF_MS = [10_000, 30_000, 60_000, 180_000, 600_000]

/**
 * 单次提交的逾时。
 *
 * Apps Script 冷启动实测要 12 秒(而且那还只是一支什么都不做的 doGet),
 * 热了之后大约 1.5 秒。加上开试算表、写入、再打一次 Supabase,
 * 冷的时候超过 30 秒很正常 —— 所以给到 90 秒。
 *
 * 等久一点不影响使用者:保存是本机操作,早就回「已保存」了,
 * 这个逾时只关系到背景同步。
 */
export const REQUEST_TIMEOUT_MS = 90_000

/** 背景同步的巡逻间隔。 */
export const SYNC_POLL_MS = 20_000

/** 产品清单快取多久之后视为「旧」(仍可用,只是提示可以更新)。 */
export const PRODUCTS_STALE_MS = 24 * 60 * 60 * 1000

/** 盘点人员名单快取时效。 */
export const STAFF_TTL_MS = 12 * 60 * 60 * 1000

/** 依语言取地点的说明文字。 */
export function roomLabel(room: RoomConfig, lang: 'zh' | 'en'): string {
  return lang === 'en' ? room.labelEn : room.label
}
