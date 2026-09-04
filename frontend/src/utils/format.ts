export const statusLabels: Record<string, string> = {
  pending: 'รอมอบหมาย',
  assigned: 'มอบหมายแล้ว',
  in_transit: 'กำลังขนส่ง',
  on_hold: 'หยุดชั่วคราว / รอแก้ไข',
  delivered: 'จัดส่งสำเร็จ',
  cancelled: 'ยกเลิกแล้ว',
  created: 'สร้างแล้ว',
  completed: 'เสร็จสิ้น',
  available: 'พร้อมใช้งาน',
  maintenance: 'ซ่อมบำรุง',
  inactive: 'ไม่พร้อมใช้งาน',
  active: 'ใช้งานอยู่',
}
export const number = (value: number) =>
  new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(value)
export const dateLabel = (value: string) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const shortId = (value: string) =>
  value.length > 20 ? `${value.slice(0, 11)}…${value.slice(-4)}` : value
export const activeDelivery = (status: string) =>
  ['assigned', 'in_transit', 'on_hold'].includes(status)

export function csvCell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text.trimStart())) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function downloadCSV(name: string, rows: unknown[][]) {
  const blob = new Blob(['\uFEFF', rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
