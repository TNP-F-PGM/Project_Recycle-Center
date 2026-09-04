import { describe, it, expect } from 'vitest'
import { canAssignDriver, validDriverLicense } from '../src/utils/drivers'
import type { Driver } from '../src/types'
const driver: Driver = {
  employee_id: 'D1',
  user_id: 'U1',
  name: 'Driver',
  position: 'Driver',
  phone: '0812345678',
  email: 'driver@example.test',
  hire_date: '2020-01-01',
  status: 'active',
  license_number: 'L1',
  license_expiry: '2099-01-01',
  active_request_id: null,
  eligible: true,
}
describe('driver availability', () => {
  it('requires a complete license valid through the current date', () => {
    expect(validDriverLicense({ ...driver, license_expiry: '2026-09-04' }, '2026-09-04')).toBe(true)
    expect(validDriverLicense({ ...driver, license_expiry: '2026-09-03' }, '2026-09-04')).toBe(
      false,
    )
    expect(validDriverLicense({ ...driver, license_number: null })).toBe(false)
  })
  it('excludes inactive staff and drivers assigned elsewhere, but permits current assignment recovery', () => {
    expect(canAssignDriver(driver, 'R1')).toBe(true)
    expect(canAssignDriver({ ...driver, status: 'resigned' }, 'R1')).toBe(false)
    expect(canAssignDriver({ ...driver, status: 'suspended' }, 'R1')).toBe(false)
    expect(canAssignDriver({ ...driver, active_request_id: 'R2' }, 'R1')).toBe(false)
    expect(canAssignDriver({ ...driver, active_request_id: 'R1' }, 'R1')).toBe(true)
  })
})
