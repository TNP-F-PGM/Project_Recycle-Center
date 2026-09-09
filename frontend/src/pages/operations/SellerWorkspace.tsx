import { useMemo, useState, type FormEvent } from 'react'
import {
  BadgeCheck,
  ChevronRight,
  FileCheck2,
  Search,
  ShieldCheck,
  UserPlus,
  UserX,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Empty,
  ErrorBox,
  Loading,
  Metric,
  PageIntro,
  RefreshButton,
  Status,
} from '../../components/ui'
import { roles, useApp } from '../../context/AppContext'
import { useApiList } from '../../hooks/useApiList'
import { api, errorText } from '../../services/api'
import type { Seller } from '../../types'
import { dateLabel, number } from '../../utils/format'

export function SellerWorkspace({ mode = 'list' }: { mode?: 'list' | 'create' }) {
  const { workspace, notify } = useApp()
  const sellers = useApiList<Seller>('/sellers')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sellerType, setSellerType] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th')
    return sellers.data.filter((row) => {
      const matchesText =
        !needle ||
        [row.seller_code, row.name, row.national_id, row.phone].some((value) =>
          String(value || '')
            .toLocaleLowerCase('th')
            .includes(needle),
        )
      return matchesText && (status === 'all' || row.account_status === status)
    })
  }, [query, sellers.data, status])

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    const nationalID = String(form.get('nationalID') || '').trim()
    setBusy(true)
    setError('')
    try {
      const duplicate = await api<{ exists: boolean }>(
        '/sellers/check-national-id?national_id=' + encodeURIComponent(nationalID),
      )
      if (duplicate.exists) throw new Error('เลขประจำตัวนี้ลงทะเบียนเป็นผู้ขายแล้ว')
      const result = await api<{ seller: Seller }>('/sellers', 'POST', {
        national_id: nationalID,
        name: form.get('name'),
        phone: form.get('phone'),
        email: form.get('email'),
        seller_type: form.get('sellerType'),
        address: form.get('address'),
        purchasing_staff_id: workspace!.employeeId,
        identity_documents: String(form.get('documents') || '')
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean),
      })
      target.reset()
      setSellerType('')
      await sellers.refresh()
      notify(`ลงทะเบียนสำเร็จ รหัสผู้ขาย ${result.seller.seller_code}`)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  if (sellers.loading) return <Loading />
  if (mode === 'create')
    return (
      <div className="purchasing-page">
        <PageIntro
          eyebrow={roles.purchasing.english}
          title="ลงทะเบียนผู้ขายรายใหม่"
          description="ตรวจข้อมูลซ้ำก่อนออกเลขผู้ขายสำหรับกระบวนการประเมินและรับซื้อ"
        >
          <Link className="button secondary" to="/sellers">
            <Search size={16} /> กลับไปค้นหาผู้ขาย
          </Link>
        </PageIntro>
        <ErrorBox message={error || sellers.error} />
        <div className="workflow-strip" aria-label="ขั้นตอนลงทะเบียนผู้ขาย">
          <div className="active">
            <span>1</span>
            <div>
              <strong>ข้อมูลผู้ขาย</strong>
              <small>ข้อมูลติดต่อและตัวตน</small>
            </div>
          </div>
          <ChevronRight size={16} />
          <div>
            <span>2</span>
            <div>
              <strong>ตรวจสอบข้อมูลซ้ำ</strong>
              <small>ตรวจเลขประจำตัวอัตโนมัติ</small>
            </div>
          </div>
          <ChevronRight size={16} />
          <div>
            <span>3</span>
            <div>
              <strong>ออกรหัสผู้ขาย</strong>
              <small>พร้อมใช้ในงานรับซื้อ</small>
            </div>
          </div>
        </div>
        <div className="seller-registration-layout">
          <section className="panel seller-form-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <UserPlus size={18} /> ข้อมูลสำหรับลงทะเบียน
                </h2>
                <p>กรอกข้อมูลตามเอกสารของผู้ขาย ช่องที่มี * จำเป็นต้องกรอก</p>
              </div>
            </div>
            <form className="seller-registration-form" onSubmit={register}>
              <fieldset>
                <legend>ประเภทและข้อมูลระบุตัวตน</legend>
                <div className="form-grid">
                  <label className="field">
                    ประเภทผู้ขาย *
                    <select
                      name="sellerType"
                      required
                      value={sellerType}
                      onChange={(event) => setSellerType(event.target.value)}
                    >
                      <option value="" disabled>
                        เลือกประเภทผู้ขาย
                      </option>
                      <option value="บุคคล">บุคคล</option>
                      <option value="นิติบุคคล">นิติบุคคล</option>
                    </select>
                  </label>
                  <label className="field">
                    {sellerType === 'นิติบุคคล' ? 'เลขประจำตัวผู้เสียภาษี' : 'เลขบัตรประชาชน'} (13
                    หลัก) *
                    <input
                      name="nationalID"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{13}"
                      maxLength={13}
                      placeholder="กรอกตัวเลข 13 หลัก"
                    />
                  </label>
                  <label className="field span-2">
                    {sellerType === 'นิติบุคคล' ? 'ชื่อบริษัท / ผู้ติดต่อ' : 'ชื่อ–นามสกุล'} *
                    <input
                      name="name"
                      required
                      maxLength={150}
                      placeholder={
                        sellerType === 'นิติบุคคล'
                          ? 'ชื่อบริษัทหรือชื่อผู้ติดต่อ'
                          : 'ชื่อและนามสกุลผู้ขาย'
                      }
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>ข้อมูลติดต่อ</legend>
                <div className="form-grid">
                  <label className="field">
                    เบอร์โทรศัพท์ *<input name="phone" required placeholder="08X-XXX-XXXX" />
                  </label>
                  <label className="field">
                    อีเมล *
                    <input name="email" type="email" required placeholder="name@example.com" />
                  </label>
                  <label className="field span-2">
                    ที่อยู่ *
                    <textarea
                      name="address"
                      required
                      rows={3}
                      placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด"
                    />
                  </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>เอกสารประกอบ</legend>
                <label className="field document-field">
                  ชื่อไฟล์หรือลิงก์เอกสาร
                  <textarea
                    name="documents"
                    rows={3}
                    placeholder="บรรทัดละ 1 รายการ เช่น สำเนาบัตรประชาชน.pdf"
                  />
                  <small>
                    เพิ่มได้หลายรายการโดยขึ้นบรรทัดใหม่ เอกสารจริงสามารถเชื่อมระบบอัปโหลดภายหลัง
                  </small>
                </label>
              </fieldset>
              <div className="seller-form-actions">
                <div>
                  <ShieldCheck size={17} />
                  <span>
                    <strong>ระบบตรวจเลขประจำตัวซ้ำก่อนบันทึก</strong>
                    <small>บุคคลภายนอกจะไม่มีบัญชีเข้าสู่ระบบ</small>
                  </span>
                </div>
                <div>
                  <button
                    type="reset"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setSellerType('')}
                  >
                    ล้างค่า
                  </button>
                  <button className="button primary" disabled={busy}>
                    <UserPlus size={16} /> {busy ? 'กำลังตรวจสอบ…' : 'ตรวจสอบและลงทะเบียน'}
                  </button>
                </div>
              </div>
            </form>
          </section>
          <aside className="registration-aside">
            <section className="panel">
              <span className="aside-icon">
                <FileCheck2 size={22} />
              </span>
              <h3>ข้อมูลที่ควรเตรียม</h3>
              <ul>
                <li>บัตรประชาชนหรือหนังสือรับรองบริษัท</li>
                <li>เบอร์โทรและอีเมลที่ติดต่อได้</li>
                <li>ที่อยู่สำหรับออกเอกสารรับซื้อ</li>
              </ul>
            </section>
            <section className="safe-note">
              <ShieldCheck size={22} />
              <h3>ข้อมูลคู่ค้าภายนอก</h3>
              <p>
                ข้อมูลนี้ใช้ระบุตัวผู้ขายและอ้างอิงธุรกรรมภายในเท่านั้น
                ผู้ขายไม่สามารถเข้าสู่ระบบหลังบ้านได้
              </p>
            </section>
          </aside>
        </div>
      </div>
    )

  return (
    <div className="purchasing-page">
      <PageIntro
        eyebrow={workspace?.role === 'manager' ? roles.manager.english : roles.purchasing.english}
        title={workspace?.role === 'manager' ? 'ตรวจสอบผู้ขาย' : 'ค้นหาและตรวจสอบผู้ขาย'}
        description="ค้นหาจากรหัส ชื่อ เลขประจำตัว หรือเบอร์โทรศัพท์"
      >
        <RefreshButton onClick={() => void sellers.refresh()} busy={sellers.refreshing} />
        {workspace?.role === 'purchasing' && (
          <Link className="button primary" to="/sellers/new">
            <UserPlus size={16} /> ลงทะเบียนผู้ขาย
          </Link>
        )}
      </PageIntro>
      <ErrorBox message={error || sellers.error} />
      <div className="seller-metrics metrics three">
        <Metric
          label="ผู้ขายทั้งหมด"
          value={number(sellers.data.length)}
          detail="ข้อมูลที่ลงทะเบียนแล้ว"
          icon={UsersRound}
        />
        <Metric
          label="พร้อมทำรายการ"
          value={number(sellers.data.filter((row) => row.account_status === 'active').length)}
          detail="สถานะใช้งานปกติ"
          icon={BadgeCheck}
          tone="blue"
        />
        <Metric
          label="ระงับบัญชี"
          value={number(sellers.data.filter((row) => row.account_status === 'suspended').length)}
          detail="ยังสร้างรายการไม่ได้"
          icon={UserX}
          tone="amber"
        />
      </div>
      <section className="panel seller-search-panel">
        <div className="seller-search-controls">
          <label className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหารหัสผู้ขาย ชื่อ เลขประจำตัว หรือเบอร์โทร"
              aria-label="ค้นหาผู้ขาย"
            />
          </label>
          <label className="field compact-field">
            สถานะ
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">ทุกสถานะ</option>
              <option value="active">ใช้งานปกติ</option>
              <option value="suspended">ระงับบัญชี</option>
            </select>
          </label>
        </div>
        <div className="panel-heading seller-result-heading">
          <div>
            <h2>
              <UsersRound size={18} /> รายชื่อผู้ขาย
            </h2>
            <p>
              พบ {visible.length} จาก {sellers.data.length} รายการ
            </p>
          </div>
          {(query || status !== 'all') && (
            <button
              className="button secondary compact"
              onClick={() => {
                setQuery('')
                setStatus('all')
              }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
        {!visible.length ? (
          <Empty title="ไม่พบผู้ขาย" message="ลองเปลี่ยนคำค้นหา หรือลงทะเบียนผู้ขายรายใหม่" />
        ) : (
          <div className="table-scroll">
            <table className="seller-table">
              <thead>
                <tr>
                  <th>ผู้ขาย</th>
                  <th>เลขประจำตัว</th>
                  <th>ข้อมูลติดต่อ</th>
                  <th>วันที่ลงทะเบียน</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.seller_code}>
                    <td>
                      <div className="seller-identity">
                        <span>{(row.name || 'ผ').slice(0, 1)}</span>
                        <div>
                          <strong>{row.name || 'ไม่ระบุชื่อ'}</strong>
                          <small>
                            {row.seller_code} · {row.seller_type}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="mono-cell">{row.national_id}</td>
                    <td>
                      <strong className="cell-secondary">{row.phone || '—'}</strong>
                      <small className="block-text">{row.email || 'ไม่ระบุอีเมล'}</small>
                    </td>
                    <td>{dateLabel(row.registration_date)}</td>
                    <td>
                      <Status
                        value={row.account_status}
                        label={row.account_status === 'active' ? 'ใช้งานปกติ' : 'ระงับบัญชี'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
