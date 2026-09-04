import type { Driver } from '../types'

export const driverStatuses = { active: 'ทำงานอยู่', suspended: 'พักงาน', resigned: 'ลาออก' }
export function validDriverLicense(
  d: Driver,
  today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()),
) {
  return !!d.license_number && !!d.license_expiry && d.license_expiry >= today
}
export function canAssignDriver(d: Driver, requestId: string) {
  return (
    d.status === 'active' &&
    validDriverLicense(d) &&
    (!d.active_request_id || d.active_request_id === requestId)
  )
}
