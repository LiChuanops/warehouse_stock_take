import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Confirm } from '../components/Confirm'
import { OperatorPicker } from '../components/OperatorPicker'
import { QuantitySheet } from '../components/QuantitySheet'
import { SyncBar } from '../components/SyncBar'
import { useToast } from '../components/Toast'
import { getRoom } from '../lib/config'
import { formatTime } from '../lib/format'
import { useLang } from '../lib/i18n'
import { buildBatch, emptySession, entryToProduct } from '../lib/session'
import { getCachedStaff, refreshStaff, staffIsStale } from '../lib/staff'
import { syncEngine } from '../lib/sync'
import { useRoomSession } from '../lib/useRoomSession'
import type { CountEntry } from '../lib/types'

export function RecordsPage() {
  const { roomId } = useParams()
  const room = getRoom(roomId)
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useLang()

  const { session, update, setSession } = useRoomSession(room?.id)
  const [staff, setStaff] = useState<string[]>([])
  const [staffError, setStaffError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CountEntry | null>(null)
  const [deleting, setDeleting] = useState<CountEntry | null>(null)
  const [saving, setSaving] = useState(false)
  // 手套点两下也只会送一次:状态更新有延迟,所以用 ref 当真正的锁
  const saveLock = useRef(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const cached = await getCachedStaff()
      if (alive && cached) setStaff(cached.names)
      if (!navigator.onLine) {
        if (alive && !cached) setStaffError('OFFLINE_NO_CACHE')
        return
      }
      if (cached && !staffIsStale(cached)) return
      try {
        const fresh = await refreshStaff()
        if (alive) {
          setStaff(fresh.names)
          setStaffError(null)
        }
      } catch (err) {
        if (alive && !cached) setStaffError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!room) return <Navigate to="/" replace />

  const entries = session?.entries ?? []
  const operator = session?.operator ?? ''
  const totalCtn = entries.reduce((s, e) => s + e.ctnQty, 0)
  const totalPkt = entries.reduce((s, e) => s + e.pktQty, 0)

  const save = async () => {
    if (!session || saveLock.current) return
    if (!operator) {
      toast.error(t('needOperator'))
      return
    }
    if (entries.length === 0) {
      toast.error(t('nothingToSave'))
      return
    }

    saveLock.current = true
    setSaving(true)
    try {
      const batch = buildBatch(room, session)
      // 先进本机队列。这一步成功就等于保存成功,不必等 Google 那边。
      await syncEngine.enqueue(batch)
      // 保留盘点人员,下一轮不用再选一次
      setSession({ ...emptySession(room.id), operator })
      toast.success(t('savedN', { n: batch.entryCount }))
      navigate(`/room/${room.id}`)
    } catch (err) {
      toast.error(t('saveFailed', { msg: err instanceof Error ? err.message : String(err) }))
    } finally {
      saveLock.current = false
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <SyncBar />

      <header className="flex items-center gap-2 bg-slate-900 px-3 py-3 text-white">
        <Link
          to={`/room/${room.id}`}
          aria-label={t('back')}
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl leading-none active:bg-white/10"
        >
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-bold">{t('recordsTitle')}</div>
          <div className="text-[13px] text-slate-300">
            {t('recordsMeta', {
              room: room.name,
              n: entries.length,
              c: totalCtn,
              p: totalPkt,
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-3 pb-40">
        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[15px] text-slate-500">{t('recordsEmpty')}</p>
            <Link
              to={`/room/${room.id}`}
              className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-3 text-[15px] font-semibold text-white"
            >
              {t('goCount')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="list-item rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] leading-snug font-semibold text-slate-900">
                      {e.name}
                    </div>
                    <div className="mt-0.5 text-[13px] text-slate-500">
                      {e.packaging}
                      <span className="ml-2 font-mono text-slate-400">
                        {formatTime(new Date(e.countedAt))}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2 text-[15px] font-bold tabular-nums">
                      {e.ctnQty > 0 ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-800">
                          {t('ctnUnit', { n: e.ctnQty })}
                        </span>
                      ) : null}
                      {e.pktQty > 0 ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-800">
                          {t('pktUnit', { n: e.pktQty })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      onClick={() => setEditing(e)}
                      className="min-h-[44px] w-16 rounded-lg bg-slate-100 text-[15px] font-semibold text-slate-700 active:bg-slate-200"
                    >
                      {t('editShort')}
                    </button>
                    <button
                      onClick={() => setDeleting(e)}
                      className="min-h-[44px] w-16 rounded-lg border border-rose-200 text-[15px] font-semibold text-rose-600 active:bg-rose-50"
                    >
                      {t('deleteShort')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="sticky bottom-0 space-y-3 border-t border-slate-200 bg-white px-3 py-3 pb-safe">
        {staffError ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
            {staffError === 'OFFLINE_NO_CACHE' ? t('staffOfflineNoCache') : staffError}
          </p>
        ) : null}
        <OperatorPicker
          value={operator}
          options={staff}
          onChange={(name) => update((s) => ({ ...s, operator: name }))}
        />
        <button
          onClick={save}
          disabled={saving || entries.length === 0 || !operator}
          className="min-h-[56px] w-full rounded-xl bg-emerald-600 text-[17px] font-bold text-white active:bg-emerald-700 disabled:bg-slate-300"
        >
          {saving ? t('saving') : t('saveN', { n: entries.length })}
        </button>
        <p className="text-center text-[12px] leading-relaxed text-slate-500">{t('saveHint')}</p>
      </div>

      {editing ? (
        <QuantitySheet
          product={entryToProduct(editing)}
          existing={editing}
          onConfirm={(ctnQty, pktQty) => {
            update((s) => ({
              ...s,
              entries: s.entries.map((x) => (x.id === editing.id ? { ...x, ctnQty, pktQty } : x)),
            }))
            setEditing(null)
            toast.success(t('updated'))
          }}
          onDelete={() => {
            update((s) => ({ ...s, entries: s.entries.filter((x) => x.id !== editing.id) }))
            setEditing(null)
            toast.info(t('deleted'))
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <Confirm
        open={deleting !== null}
        danger
        title={t('confirmDeleteEntryTitle')}
        body={deleting?.name}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting
          if (target) {
            update((s) => ({ ...s, entries: s.entries.filter((x) => x.id !== target.id) }))
            toast.info(t('deleted'))
          }
          setDeleting(null)
        }}
      />
    </div>
  )
}
