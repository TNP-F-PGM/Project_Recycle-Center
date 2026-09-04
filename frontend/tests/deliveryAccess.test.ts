import { describe, it, expect } from 'vitest'
import { deliveryAccess } from '../src/utils/deliveryAccess'

describe('delivery actions by role and assignment', () => {
  it('drivers report problems; supervisors resolve and cancel; held jobs cannot finish', () => {
    const driver = { role: 'driver' as const, employeeId: 'D1' }
    expect(deliveryAccess(driver, 'in_transit', 'D1', 'S1')).toMatchObject({
      report: true,
      cancel: false,
      resolve: false,
    })
    expect(deliveryAccess(driver, 'on_hold', 'D1', 'S1')).toMatchObject({
      report: false,
      complete: false,
      depart: false,
    })
    expect(
      deliveryAccess({ role: 'transport', employeeId: 'T1' }, 'on_hold', 'D1', 'S1'),
    ).toMatchObject({ resolve: true, cancel: true, complete: false })
    expect(
      deliveryAccess({ role: 'sales', employeeId: 'S1' }, 'on_hold', 'D1', 'S1'),
    ).toMatchObject({ view: true, resolve: false, cancel: false })
  })
  it.each(['assigned', 'in_transit'])(
    'transport and sales cannot report progress while %s',
    (status) => {
      for (const workspace of [
        { role: 'transport' as const, employeeId: 'T1' },
        { role: 'sales' as const, employeeId: 'S1' },
      ]) {
        const access = deliveryAccess(workspace, status, 'D1', 'S1')
        expect(access.view).toBe(true)
        expect(access.depart).toBe(false)
        expect(access.complete).toBe(false)
      }
    },
  )
  it('only the assigned driver can depart and then complete', () => {
    const driver = { role: 'driver' as const, employeeId: 'D1' }
    expect(deliveryAccess(driver, 'assigned', 'D1', 'S1')).toMatchObject({
      depart: true,
      complete: false,
      assign: false,
    })
    expect(deliveryAccess(driver, 'in_transit', 'D1', 'S1')).toMatchObject({
      depart: false,
      complete: true,
    })
    expect(deliveryAccess(driver, 'delivered', 'D1', 'S1')).toMatchObject({
      depart: false,
      complete: false,
    })
    expect(deliveryAccess(driver, 'in_transit', 'D2', 'S1')).toMatchObject({
      view: false,
      complete: false,
    })
  })
  it('sales can track only their orders; transport retains assignment', () => {
    expect(
      deliveryAccess({ role: 'sales', employeeId: 'S2' }, 'pending', undefined, 'S1').view,
    ).toBe(false)
    expect(
      deliveryAccess({ role: 'transport', employeeId: 'T1' }, 'pending', undefined, 'S1').assign,
    ).toBe(true)
    expect(deliveryAccess(null, 'in_transit', 'D1', 'S1').view).toBe(false)
  })
})
