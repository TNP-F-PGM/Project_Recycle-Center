import type { Workspace } from '../types'

export function deliveryAccess(
  workspace: Workspace | null,
  status: string,
  driverId?: string,
  salesStaffId?: string,
) {
  const transport = workspace?.role === 'transport'
  const sales = workspace?.role === 'sales' && workspace.employeeId === salesStaffId
  const driver = workspace?.role === 'driver' && workspace.employeeId === driverId
  return {
    view: transport || sales || driver,
    edit: (transport || sales) && status === 'pending',
    cancel: transport && ['pending', 'assigned', 'on_hold'].includes(status),
    assign: transport && ['pending', 'assigned'].includes(status),
    depart: driver && status === 'assigned',
    complete: driver && status === 'in_transit',
    report: driver && ['assigned', 'in_transit'].includes(status),
    resolve: transport && status === 'on_hold',
  }
}
