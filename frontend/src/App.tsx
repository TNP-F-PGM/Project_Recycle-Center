import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
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
            <Route path="orders" element={<Orders />} />
            <Route path="orders/new" element={<OrderFormPage />} />
            <Route path="orders/:id/edit" element={<OrderFormPage />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="deliveries/:id" element={<DeliveryDetail />} />
            <Route path="trucks" element={<Trucks />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="factories" element={<ReferenceData kind="factories" />} />
            <Route path="factories/new" element={<FactoryFormPage />} />
            <Route path="factories/:id/edit" element={<FactoryFormPage />} />
            <Route path="materials" element={<ReferenceData key="materials" kind="materials" />} />
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
