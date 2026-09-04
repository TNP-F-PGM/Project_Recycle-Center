import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api, errorText } from '../services/api'
import type { AppData, Employee, Role, Workspace } from '../types'

const empty: AppData = {
  factories: [],
  materials: [],
  trucks: [],
  orders: [],
  deliveries: [],
  sales: [],
  supervisors: [],
  drivers: [],
}
export const roles: Record<Role, { title: string; english: string }> = {
  transport: { title: 'หัวหน้าการขนส่ง', english: 'TRANSPORT MANAGER' },
  sales: { title: 'พนักงานขาย', english: 'SALES OFFICER' },
  driver: { title: 'พนักงานขับรถ', english: 'DRIVER' },
}
export function employeesFor(data: AppData, role: Role) {
  return role === 'transport'
    ? data.supervisors
    : role === 'sales'
      ? data.sales
      : data.drivers.filter((d) => d.status === 'active')
}
function readWorkspace(): Workspace | null {
  try {
    const v = JSON.parse(localStorage.getItem('recyclehub.workspace') || 'null')
    return v &&
      ['transport', 'sales', 'driver'].includes(v.role) &&
      typeof v.employeeId === 'string'
      ? v
      : null
  } catch {
    return null
  }
}
interface AppState {
  data: AppData
  loading: boolean
  refreshing: boolean
  error: string
  workspace: Workspace | null
  employee: Employee | undefined
  refresh: () => Promise<void>
  setWorkspace: (value: Workspace | null) => void
  notify: (message: string) => void
  toast: string
}
const Context = createContext<AppState | null>(null)
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(empty)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [workspace, updateWorkspace] = useState<Workspace | null>(readWorkspace)
  const [toast, setToast] = useState('')
  const requestNumber = useRef(0)
  const refresh = useCallback(async () => {
    const id = ++requestNumber.current
    setRefreshing(true)
    try {
      const [factories, materials, trucks, orders, deliveries, sales, supervisors, drivers] =
        await Promise.all([
          api<AppData['factories']>('/factories'),
          api<AppData['materials']>('/materials'),
          api<AppData['trucks']>('/trucks'),
          api<AppData['orders']>('/purchase-orders'),
          api<AppData['deliveries']>('/delivery-requests'),
          api<AppData['sales']>('/sales-staff'),
          api<AppData['supervisors']>('/transport-supervisors'),
          api<AppData['drivers']>('/drivers'),
        ])
      if (id !== requestNumber.current) return
      setData({ factories, materials, trucks, orders, deliveries, sales, supervisors, drivers })
      setError('')
    } catch (e) {
      if (id === requestNumber.current) setError(errorText(e))
    } finally {
      if (id === requestNumber.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 5000)
    return () => clearTimeout(timer)
  }, [toast])
  function setWorkspace(value: Workspace | null) {
    updateWorkspace(value)
    try {
      value
        ? localStorage.setItem('recyclehub.workspace', JSON.stringify(value))
        : localStorage.removeItem('recyclehub.workspace')
    } catch {
      /* The current session still works when storage is disabled. */
    }
  }
  const employee = workspace
    ? employeesFor(data, workspace.role).find((e) => e.employee_id === workspace.employeeId)
    : undefined
  return (
    <Context.Provider
      value={{
        data,
        loading,
        refreshing,
        error,
        workspace,
        employee,
        refresh,
        setWorkspace,
        notify: setToast,
        toast,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useApp() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('AppProvider is required')
  return ctx
}
