import { translate, type Lang } from './i18n'

const pad = (n: number) => n.toString().padStart(2, '0')

/** DD/MM/YYYY —— Google Sheet 那边一直是这个格式,别改。 */
export function formatDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** HH:mm:ss 24 小时制,用本机时间(新加坡)。 */
export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${formatTime(d)}`
}

/** 「3 分钟前」这种相对时间,同步状态用。 */
export function relativeTime(ts: number, lang: Lang, now = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const s = Math.floor(diff / 1000)
  if (s < 10) return translate(lang, 'justNow')
  if (s < 60) return translate(lang, 'secAgo', { n: s })
  const m = Math.floor(s / 60)
  if (m < 60) return translate(lang, 'minAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return translate(lang, 'hourAgo', { n: h })
  return translate(lang, 'dayAgo', { n: Math.floor(h / 24) })
}

/** 倒数到下次重试。 */
export function countdown(ts: number, lang: Lang, now = Date.now()): string {
  const s = Math.ceil(Math.max(0, ts - now) / 1000)
  if (s <= 0) return translate(lang, 'retrySoon')
  if (s < 60) return translate(lang, 'retryInSec', { n: s })
  return translate(lang, 'retryInMin', { n: Math.ceil(s / 60) })
}

export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // 极旧的 WebView 后备方案
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
