import { useEffect, useRef, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Inbox,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { statusLabels } from '../utils/format'

export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value}`}>
      <i />
      {statusLabels[value] || value}
    </span>
  )
}
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  if (!message) return null
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={19} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          ลองอีกครั้ง
        </button>
      )}
    </div>
  )
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" size={26} />
      <p>กำลังโหลดข้อมูล…</p>
    </div>
  )
}
export function Empty({
  title = 'ยังไม่มีรายการ',
  message = 'รายการใหม่จะแสดงที่นี่',
  action,
}: {
  title?: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={27} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  )
}
export function PageIntro({
  eyebrow,
  title,
  description,
  children,
  back,
}: {
  eyebrow?: string
  title: string
  description?: string
  children?: ReactNode
  back?: string
}) {
  return (
    <div className="page-intro">
      <div>
        {back && (
          <Link className="back-link" to={back}>
            <ArrowLeft size={15} />
            ย้อนกลับ
          </Link>
        )}
        {eyebrow && (
          <div className="eyebrow">
            <i />
            {eyebrow}
          </div>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="intro-actions">{children}</div>
    </div>
  )
}
export function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button className="button secondary" onClick={onClick} disabled={busy}>
      <RefreshCw size={15} className={busy ? 'spin' : ''} />
      รีเฟรชข้อมูล
    </button>
  )
}
export function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'green',
}: {
  label: string
  value: ReactNode
  detail: string
  icon: LucideIcon
  tone?: string
}) {
  return (
    <div className="metric">
      <span className={`metric-icon ${tone}`}>
        <Icon size={21} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  )
}
export function SearchBox({
  value,
  onChange,
  placeholder = 'ค้นหารหัสงานหรือโรงงาน',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="search-field">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" aria-label="ล้างการค้นหา" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
    </label>
  )
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" disabled={busy} onClick={onClose} aria-label="ปิดหน้าต่าง">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function Stepper({ status }: { status: string }) {
  if (status === 'on_hold')
    return <div className="incident-banner">หยุดการขนส่งชั่วคราว — รอหัวหน้าขนส่งแก้ไขปัญหา</div>
  const steps = ['pending', 'assigned', 'in_transit', 'delivered']
  const index = steps.indexOf(status)
  if (status === 'cancelled')
    return (
      <div className="cancelled-note">
        <X size={18} />
        คำขอนี้ถูกยกเลิกแล้ว
      </div>
    )
  return (
    <ol className="stepper">
      {steps.map((step, i) => (
        <li key={step} className={i <= index ? 'done' : ''}>
          <span>{i < index ? <Check size={14} /> : i + 1}</span>
          <small>{statusLabels[step]}</small>
        </li>
      ))}
    </ol>
  )
}
export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="info">
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}
