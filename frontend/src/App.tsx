import { useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppProvider } from './context/AppContext'
import { Layout } from './components/Layout'
import { Empty } from './components/ui'
import { Welcome } from './pages/Welcome'
import { Dashboard } from './pages/Dashboard'
import { Orders } from './pages/Orders'
import { OrderFormPage } from './pages/OrderForm'
import { OrderDetail } from './pages/OrderDetail'
import { Deliveries } from './pages/Deliveries'
import { DeliveryDetail } from './pages/DeliveryDetail'
import { Trucks } from './pages/Trucks'
import { Drivers } from './pages/Drivers'
import { ReferenceData } from './pages/ReferenceData'
import { Help } from './pages/Help'
import { FactoryFormPage } from './pages/FactoryForm'
import { Contracts } from './pages/Contracts'
import { ContractFormPage } from './pages/ContractForm'
import { ContractDetail } from './pages/ContractDetail'
import { QualityWorkspace } from './pages/operations/QualityWorkspace'
import { QualityHistory } from './pages/operations/QualityHistory'
import { QualityReport } from './pages/operations/QualityReport'
import { PurchasingWorkspace } from './pages/operations/PurchasingWorkspace'
import { InventoryWorkspace } from './pages/operations/InventoryWorkspace'
import { StockMovementWorkspace } from './pages/operations/StockMovementWorkspace'
import { AdjustmentsWorkspace } from './pages/operations/AdjustmentsWorkspace'
import { ZoneWorkspace } from './pages/operations/ZoneWorkspace'
import { ComplaintsWorkspace, ReturnsWorkspace } from './pages/operations/ComplaintsWorkspace'
import { SellerWorkspace } from './pages/operations/SellerWorkspace'
import { useApp } from './context/AppContext'
import type { Role } from './types'

function RoleRoute({ allowed, children }: { allowed: Role[]; children: ReactNode }) {
  const { workspace } = useApp()
  return workspace && allowed.includes(workspace.role) ? children : <Navigate to="/" replace />
}

function InventoryByWarehouseRole() {
  const { workspace } = useApp()
  return workspace && ['warehouse', 'warehouse_manager'].includes(workspace.role)
    ? <ZoneWorkspace />
    : <InventoryWorkspace />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppProvider>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route
              path="orders"
              element={
                <RoleRoute allowed={['sales']}>
                  <Orders />
                </RoleRoute>
              }
            />
            <Route
              path="orders/new"
              element={
                <RoleRoute allowed={['sales']}>
                  <OrderFormPage />
                </RoleRoute>
              }
            />
            <Route
              path="orders/:id/edit"
              element={
                <RoleRoute allowed={['sales']}>
                  <OrderFormPage />
                </RoleRoute>
              }
            />
            <Route
              path="orders/:id"
              element={
                <RoleRoute allowed={['sales']}>
                  <OrderDetail />
                </RoleRoute>
              }
            />
            <Route
              path="contracts"
              element={
                <RoleRoute allowed={['sales']}>
                  <Contracts />
                </RoleRoute>
              }
            />
            <Route
              path="contracts/new"
              element={
                <RoleRoute allowed={['sales']}>
                  <ContractFormPage />
                </RoleRoute>
              }
            />
            <Route
              path="contracts/:id/edit"
              element={
                <RoleRoute allowed={['sales']}>
                  <ContractFormPage />
                </RoleRoute>
              }
            />
            <Route
              path="contracts/:id"
              element={
                <RoleRoute allowed={['sales']}>
                  <ContractDetail />
                </RoleRoute>
              }
            />
            <Route
              path="deliveries"
              element={
                <RoleRoute allowed={['sales', 'transport', 'driver']}>
                  <Deliveries />
                </RoleRoute>
              }
            />
            <Route
              path="deliveries/:id"
              element={
                <RoleRoute allowed={['sales', 'transport', 'driver']}>
                  <DeliveryDetail />
                </RoleRoute>
              }
            />
            <Route
              path="trucks"
              element={
                <RoleRoute allowed={['transport']}>
                  <Trucks />
                </RoleRoute>
              }
            />
            <Route
              path="drivers"
              element={
                <RoleRoute allowed={['transport']}>
                  <Drivers />
                </RoleRoute>
              }
            />
            <Route
              path="factories"
              element={
                <RoleRoute allowed={['sales']}>
                  <ReferenceData kind="factories" />
                </RoleRoute>
              }
            />
            <Route
              path="factories/new"
              element={
                <RoleRoute allowed={['sales']}>
                  <FactoryFormPage />
                </RoleRoute>
              }
            />
            <Route
              path="factories/:id/edit"
              element={
                <RoleRoute allowed={['sales']}>
                  <FactoryFormPage />
                </RoleRoute>
              }
            />
            <Route
              path="materials"
              element={
                <RoleRoute allowed={['sales']}>
                  <ReferenceData key="materials" kind="materials" />
                </RoleRoute>
              }
            />
            <Route
              path="quality"
              element={
                <RoleRoute allowed={['quality']}>
                  <QualityWorkspace />
                </RoleRoute>
              }
            />
            <Route
              path="quality/history"
              element={
                <RoleRoute allowed={['quality']}>
                  <QualityWorkspace initialTab="history" />
                </RoleRoute>
              }
            />
            <Route
              path="quality/report"
              element={
                <RoleRoute allowed={['quality']}>
                  <QualityReport />
                </RoleRoute>
              }
            />
            <Route
              path="purchases"
              element={
                <RoleRoute allowed={['purchasing']}>
                  <PurchasingWorkspace />
                </RoleRoute>
              }
            />
            <Route
              path="sellers"
              element={
                <RoleRoute allowed={['purchasing', 'manager']}>
                  <SellerWorkspace />
                </RoleRoute>
              }
            />
            <Route
              path="sellers/new"
              element={
                <RoleRoute allowed={['purchasing']}>
                  <SellerWorkspace mode="create" />
                </RoleRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <RoleRoute allowed={['warehouse', 'warehouse_manager']}>
                  <InventoryByWarehouseRole />
                </RoleRoute>
              }
            />
            <Route
              path="material-search"
              element={
                <RoleRoute allowed={['warehouse', 'warehouse_manager']}>
                  <InventoryWorkspace materialSearch />
                </RoleRoute>
              }
            />
            <Route
              path="receipts"
              element={
                <RoleRoute allowed={['warehouse']}>
                  <StockMovementWorkspace view="receipts" />
                </RoleRoute>
              }
            />
            <Route
              path="issues"
              element={
                <RoleRoute allowed={['warehouse']}>
                  <StockMovementWorkspace view="issues" />
                </RoleRoute>
              }
            />
            <Route
              path="stock-history"
              element={
                <RoleRoute allowed={['warehouse', 'warehouse_manager']}>
                  <StockMovementWorkspace view="history" />
                </RoleRoute>
              }
            />
            <Route
              path="adjustments"
              element={
                <RoleRoute allowed={['warehouse', 'warehouse_manager']}>
                  <AdjustmentsWorkspace />
                </RoleRoute>
              }
            />
            <Route
              path="zones"
              element={
                <RoleRoute allowed={['warehouse_manager']}>
                  <ZoneWorkspace />
                </RoleRoute>
              }
            />
            <Route
              path="complaints"
              element={
                <RoleRoute allowed={['customer_service']}>
                  <ComplaintsWorkspace />
                </RoleRoute>
              }
            />
            <Route
              path="returns"
              element={
                <RoleRoute allowed={['warehouse', 'customer_service']}>
                  <ReturnsWorkspace />
                </RoleRoute>
              }
            />
            <Route path="help" element={<Help />} />
            <Route
              path="*"
              element={
                <Empty
                  title="ไม่พบหน้าที่ต้องการ"
                  message="ลิงก์นี้อาจไม่ถูกต้องหรือถูกย้ายแล้ว"
                  action={
                    <Link className="button primary" to="/">
                      กลับหน้าหลัก
                    </Link>
                  }
                />
              }
            />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
