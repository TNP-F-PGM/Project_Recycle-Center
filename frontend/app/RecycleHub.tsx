"use client";

import { FormEvent, useState } from "react";

type Role = "supervisor" | "sales" | "driver";
type View = "home" | "work" | "messages" | "knowledge";
type TruckFilter = "ทั้งหมด" | "ออนไลน์" | "รองาน" | "วิ่งงาน" | "ออฟไลน์";
type DeliveryFilter = "ทั้งหมด" | "รอมอบหมาย" | "กำลังขนส่ง" | "เสร็จสิ้น" | "ขอยกเลิก";
type DriverJobFilter = "ทั้งหมด" | "รอกดรับงาน" | "กำลังดำเนินการ" | "เสร็จสิ้น" | "ปฏิเสธ";
type DriverJobStatus = Exclude<DriverJobFilter, "ทั้งหมด">;
type SalesOrderFilter = "ทั้งหมด" | "รออนุมัติ" | "อนุมัติแล้ว" | "ปฏิเสธ";
type SalesOrderStatus = Exclude<SalesOrderFilter, "ทั้งหมด">;
type Notice = { message: string; tone: "success" | "danger" };
type Modal =
  | { type: "delivery"; id: string }
  | { type: "truck"; id: string }
  | { type: "order"; id: string }
  | { type: "driver-job"; id: string }
  | null;

const roleLabels: Record<Role, string> = {
  supervisor: "หัวหน้าการขนส่ง",
  sales: "พนักงานขาย",
  driver: "พนักงานขับรถ",
};

const menuLabels: Record<Role, string> = {
  supervisor: "คำขอรับ-ส่งวัสดุ",
  sales: "คำขอซื้อ",
  driver: "งานที่ได้รับ",
};

const deliveryRequests = [
  { id: "M1", status: "รอมอบหมาย", tone: "yellow", material: "ขวดพลาสติก", weight: "800 กก.", customer: "บริษัท อีโคแพ็ค จำกัด", pickup: "วันนี้ 09:30", vehicle: null },
  { id: "M2", status: "รอมอบหมาย", tone: "yellow", material: "กระดาษลัง", weight: "650 กก.", customer: "บริษัท กรีนโลก จำกัด", pickup: "วันนี้ 11:00", vehicle: null },
  { id: "M3", status: "กำลังขนส่ง", tone: "blue", material: "กระดาษขาว-ดำ", weight: "1,200 กก.", customer: "บริษัท สมบูรณ์ จำกัด", pickup: "วันนี้ 08:15", vehicle: "C02" },
  { id: "M4", status: "กำลังขนส่ง", tone: "blue", material: "แก้ว", weight: "900 กก.", customer: "บริษัท แก้วดี จำกัด", pickup: "วันนี้ 10:30", vehicle: "C05" },
  { id: "M5", status: "เสร็จสิ้น", tone: "green", material: "กระป๋องอะลูมิเนียม", weight: "500 กก.", customer: "ร้านรีไซเคิลรุ่งเรือง", pickup: "เมื่อวาน 15:40", vehicle: "C08" },
  { id: "M6", status: "ขอยกเลิก", tone: "red", material: "ขวดแก้ว", weight: "700 กก.", customer: "หจก. ทรัพย์รีไซเคิล", pickup: "วันนี้ 13:30", vehicle: "C19" },
];

const trucks = [
  { id: "C01", status: "ออนไลน์", job: "-", tone: "green", plate: "กจ 881", driver: "นายสมยศ สีจันทร์", capacity: "1,200 กก.", phone: "0845214565" },
  { id: "C02", status: "วิ่งงาน", job: "M3", tone: "blue", plate: "บน 342", driver: "นายพิเชษฐ์ คำดี", capacity: "1,500 กก.", phone: "0812345612" },
  { id: "C03", status: "รองาน", job: "-", tone: "yellow", plate: "บน 214", driver: "นายยงยุทธ พลนันท์", capacity: "1,000 กก.", phone: "0892145630" },
  { id: "C04", status: "รองาน", job: "-", tone: "yellow", plate: "กท 476", driver: "นายธนกร ใจมั่น", capacity: "1,200 กก.", phone: "0864762104" },
  { id: "C05", status: "วิ่งงาน", job: "M4", tone: "blue", plate: "บม 905", driver: "นายชาญชัย มีสุข", capacity: "1,800 กก.", phone: "0829054315" },
  { id: "C06", status: "ออฟไลน์", job: "-", tone: "gray", plate: "กย 126", driver: "นายศุภชัย นาคดี", capacity: "1,000 กก.", phone: "0851269046" },
  { id: "C07", status: "ออฟไลน์", job: "-", tone: "gray", plate: "บน 731", driver: "นายประสิทธิ์ แก้วงาม", capacity: "1,300 กก.", phone: "0837315207" },
  { id: "C08", status: "ออนไลน์", job: "-", tone: "green", plate: "กท 512", driver: "นายสมชาย แสงดี", capacity: "1,500 กก.", phone: "0885124308" },
  { id: "C09", status: "ออนไลน์", job: "-", tone: "green", plate: "บจ 409", driver: "นายอนันต์ ใจตรง", capacity: "1,200 กก.", phone: "0814096709" },
  { id: "C10", status: "ออนไลน์", job: "-", tone: "green", plate: "กม 725", driver: "นายประเสริฐ มีสุข", capacity: "1,000 กก.", phone: "0877253410" },
  { id: "C11", status: "ออนไลน์", job: "-", tone: "green", plate: "บน 936", driver: "นายกิตติ ศรีงาม", capacity: "1,800 กก.", phone: "0849362511" },
  { id: "C12", status: "ออนไลน์", job: "-", tone: "green", plate: "กย 118", driver: "นายวีระ ชัยมงคล", capacity: "1,300 กก.", phone: "0891187612" },
  { id: "C13", status: "รองาน", job: "-", tone: "yellow", plate: "บพ 640", driver: "นายสันติ พูนผล", capacity: "1,000 กก.", phone: "0866405313" },
  { id: "C14", status: "รองาน", job: "-", tone: "yellow", plate: "กข 284", driver: "นายณัฐพล สุขใจ", capacity: "1,500 กก.", phone: "0822846714" },
  { id: "C15", status: "รองาน", job: "-", tone: "yellow", plate: "บย 357", driver: "นายอาคม ทองดี", capacity: "1,200 กก.", phone: "0853572415" },
  { id: "C16", status: "รองาน", job: "-", tone: "yellow", plate: "กน 602", driver: "นายสุรชัย แสนงาม", capacity: "1,800 กก.", phone: "0886024516" },
  { id: "C17", status: "รองาน", job: "-", tone: "yellow", plate: "บก 819", driver: "นายมนตรี วงศ์ดี", capacity: "1,300 กก.", phone: "0818197317" },
  { id: "C18", status: "รองาน", job: "-", tone: "yellow", plate: "กษ 443", driver: "นายเอกชัย บุญมี", capacity: "1,000 กก.", phone: "0874436218" },
  { id: "C19", status: "วิ่งงาน", job: "M6", tone: "blue", plate: "บล 570", driver: "นายวรพล คงมั่น", capacity: "1,500 กก.", phone: "0835708419" },
  { id: "C20", status: "ออฟไลน์", job: "-", tone: "gray", plate: "กอ 991", driver: "นายพิชัย ธรรมดี", capacity: "1,200 กก.", phone: "0849913520" },
];

const driverCodeFor = (truckId: string) => `D${truckId.slice(1)}`;

const purchaseOrders = [
  { id: "M1", material: "ขวดพลาสติก", supplier: "บริษัทอิเล็กทรอนิกส์", requested: 800, stock: 450, status: "รออนุมัติ" },
  { id: "M2", material: "กระดาษลัง", supplier: "บริษัทแพ็คดี", requested: 300, stock: 620, status: "รออนุมัติ" },
  { id: "M3", material: "ขาว-ดำ", supplier: "บริษัทสมบูรณ์", requested: 250, stock: 540, status: "อนุมัติแล้ว" },
  { id: "M4", material: "แก้ว", supplier: "บริษัทแก้วดี", requested: 400, stock: 700, status: "ปฏิเสธ" },
];

const driverJobs = [
  { id: "M1", company: "บริษัท แก้วมณี จำกัด", status: "รอกดรับงาน" },
  { id: "M2", company: "บริษัท กรีนโลก จำกัด", status: "เสร็จสิ้น" },
];

export function RecycleHub() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginID, setLoginID] = useState("");
  const [role, setRole] = useState<Role>("supervisor");
  const [view, setView] = useState<View>("home");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [approvedOrders, setApprovedOrders] = useState<string[]>([]);
  const [rejectedOrders, setRejectedOrders] = useState<string[]>([]);
  const [acceptedJobs, setAcceptedJobs] = useState<string[]>([]);
  const [completedJobs, setCompletedJobs] = useState<string[]>([]);

  const orderStatusFor = (id: string): SalesOrderStatus => {
    if (rejectedOrders.includes(id)) return "ปฏิเสธ";
    if (approvedOrders.includes(id)) return "อนุมัติแล้ว";
    const initialStatus = purchaseOrders.find((order) => order.id === id)?.status;
    return initialStatus === "อนุมัติแล้ว" || initialStatus === "ปฏิเสธ" ? initialStatus : "รออนุมัติ";
  };

  const driverJobStatusFor = (id: string): DriverJobStatus => {
    if (completedJobs.includes(id)) return "เสร็จสิ้น";
    if (acceptedJobs.includes(id)) return "กำลังดำเนินการ";
    const initialStatus = driverJobs.find((job) => job.id === id)?.status;
    return initialStatus === "กำลังดำเนินการ" || initialStatus === "เสร็จสิ้น" || initialStatus === "ปฏิเสธ" ? initialStatus : "รอกดรับงาน";
  };

  const login = (event: FormEvent) => {
    event.preventDefault();
    const normalized = loginID.trim().toUpperCase();
    if (normalized.startsWith("D")) setRole("driver");
    else if (normalized.startsWith("S")) setRole("sales");
    else setRole("supervisor");
    setView("home");
    setLoggedIn(true);
  };

  const logout = () => {
    setLoggedIn(false);
    setLoginID("");
    setModal(null);
    setNotice(null);
  };

  const showNotice = (message: string, tone: Notice["tone"] = "success") => {
    setModal(null);
    setNotice({ message, tone });
    window.setTimeout(() => setNotice(null), 2200);
  };

  if (!loggedIn) {
    return <LoginScreen id={loginID} onIDChange={setLoginID} onSubmit={login} />;
  }

  return (
    <div className="prototype-shell">
      <main className="prototype-main">
        <Brand />
        {view === "home" && <HomeView role={role} onView={setView} />}
        {view === "messages" && <MessagesView role={role} />}
        {view === "knowledge" && <KnowledgeView />}
        {view === "work" && role === "supervisor" && (
          <SupervisorDashboard onRequest={(id) => { setSelectedTruck(null); setModal({ type: "delivery", id }); }} onTruck={(id) => setModal({ type: "truck", id })} />
        )}
        {view === "work" && role === "sales" && (
          <SalesDashboard approvedOrders={approvedOrders} rejectedOrders={rejectedOrders} onOrder={(id) => setModal({ type: "order", id })} />
        )}
        {view === "work" && role === "driver" && (
          <DriverDashboard acceptedJobs={acceptedJobs} completedJobs={completedJobs} onJob={(id) => setModal({ type: "driver-job", id })} />
        )}
      </main>

      <Sidebar role={role} view={view} onView={setView} onLogout={logout} />

      {modal?.type === "delivery" && (
        <DeliveryModal
          id={modal.id}
          selectedTruck={selectedTruck}
          onTruck={setSelectedTruck}
          onClose={() => setModal(null)}
          onConfirm={() => showNotice(
            modal.id === "M6" ? "อนุมัติคำขอยกเลิกสำเร็จ" : "มอบหมายการจัดส่งสำเร็จ",
            modal.id === "M6" ? "danger" : "success",
          )}
        />
      )}
      {modal?.type === "truck" && <TruckModal id={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === "order" && (
        <OrderModal
          id={modal.id}
          status={orderStatusFor(modal.id)}
          onClose={() => setModal(null)}
          onCancel={() => {
            setApprovedOrders((current) => current.filter((id) => id !== modal.id));
            setRejectedOrders((current) => current.includes(modal.id) ? current : [...current, modal.id]);
            showNotice("ยกเลิกคำสั่งซื้อสำเร็จ", "danger");
          }}
          onConfirm={() => {
            setRejectedOrders((current) => current.filter((id) => id !== modal.id));
            setApprovedOrders((current) => current.includes(modal.id) ? current : [...current, modal.id]);
            showNotice("ยืนยันคำสั่งซื้อสำเร็จ");
          }}
        />
      )}
      {modal?.type === "driver-job" && (
        <DriverJobModal
          id={modal.id}
          status={driverJobStatusFor(modal.id)}
          onClose={() => setModal(null)}
          onAccept={() => {
            setAcceptedJobs((current) => [...current, modal.id]);
            showNotice("รับงานแล้ว");
          }}
          onCancel={() => showNotice("ส่งคำขอยกเลิกแล้ว", "danger")}
          onComplete={() => {
            setAcceptedJobs((current) => current.filter((id) => id !== modal.id));
            setCompletedJobs((current) => current.includes(modal.id) ? current : [...current, modal.id]);
            showNotice("ส่งสำเร็จ");
          }}
        />
      )}
      {notice && <div className={`prototype-notice ${notice.tone}`} role="status">{notice.message}</div>}
    </div>
  );
}

function LoginScreen({ id, onIDChange, onSubmit }: { id: string; onIDChange: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <div className="login-screen">
      <Brand />
      <span className="bubble bubble-one" />
      <span className="bubble bubble-two" />
      <span className="bubble bubble-three" />
      <span className="bubble bubble-four" />
      <form className="login-form" onSubmit={onSubmit}>
        <div className="login-avatar"><img src="/icons/person.png" alt="" /></div>
        <label htmlFor="login-id">ID</label>
        <input id="login-id" value={id} onChange={(event) => onIDChange(event.target.value)} placeholder="T01 / S01 / D11" />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" defaultValue="1234" />
        <button type="submit">Login</button>
        <small>T01 หัวหน้าขนส่ง · S01 ฝ่ายขาย · D11 พนักงานขับรถ</small>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <div className="prototype-brand">
      <img className="prototype-logo" src="/icons/Logo.png" alt="" />
      <div><strong>RecycleHub</strong><small>คุณได้เงินเราได้ขยะ</small></div>
    </div>
  );
}

function Sidebar({ role, view, onView, onLogout }: { role: Role; view: View; onView: (view: View) => void; onLogout: () => void }) {
  return (
    <aside className="prototype-sidebar">
      <div className="prototype-profile">
        <span className="profile-outline"><img src="/icons/person.png" alt="" /></span>
        <div><strong>{roleLabels[role]}</strong><small>{role === "driver" ? "D11" : role === "sales" ? "S01" : "T01"}</small></div>
      </div>
      <nav className="prototype-nav" aria-label="เมนูหลัก">
        <MenuButton active={view === "home"} icon="/icons/home.png" label="หน้าแรก" onClick={() => onView("home")} />
        <MenuButton active={view === "work"} icon={role === "sales" ? "/icons/Listatsell.png" : "/icons/list.png"} label={menuLabels[role]} onClick={() => onView("work")} />
        <MenuButton active={view === "messages"} icon="/icons/messenger.png" label="ข้อความ" onClick={() => onView("messages")} />
        <MenuButton active={view === "knowledge"} icon="/icons/Knowledge.png" label="ความรู้รีไซเคิล" onClick={() => onView("knowledge")} />
        <MenuButton active={false} icon="/icons/logout.png" label="Logout" onClick={onLogout} />
      </nav>
    </aside>
  );
}

function MenuButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return <button className={active ? "prototype-menu active" : "prototype-menu"} onClick={onClick}><span><img src={icon} alt="" /></span>{label}</button>;
}

function SupervisorDashboard({ onRequest, onTruck }: { onRequest: (id: string) => void; onTruck: (id: string) => void }) {
  const [truckFilter, setTruckFilter] = useState<TruckFilter>("ทั้งหมด");
  const [requestFilter, setRequestFilter] = useState<DeliveryFilter>("ทั้งหมด");
  const truckFilters: { label: TruckFilter; count: number }[] = [
    { label: "ทั้งหมด", count: trucks.length },
    { label: "ออนไลน์", count: trucks.filter((truck) => truck.status !== "ออฟไลน์").length },
    { label: "รองาน", count: trucks.filter((truck) => truck.status === "รองาน").length },
    { label: "วิ่งงาน", count: trucks.filter((truck) => truck.status === "วิ่งงาน").length },
    { label: "ออฟไลน์", count: trucks.filter((truck) => truck.status === "ออฟไลน์").length },
  ];
  const readyTruckCount = trucks.filter((truck) => truck.status === "รองาน").length;
  const runningTruckCount = trucks.filter((truck) => truck.status === "วิ่งงาน").length;
  const visibleTrucks = truckFilter === "ทั้งหมด"
    ? trucks
    : truckFilter === "ออนไลน์"
      ? trucks.filter((truck) => truck.status !== "ออฟไลน์")
      : trucks.filter((truck) => truck.status === truckFilter);
  const visibleRequests = requestFilter === "ทั้งหมด"
    ? deliveryRequests
    : deliveryRequests.filter((request) => request.status === requestFilter);

  return (
    <section className="dashboard-space" aria-label="คำขอรับ-ส่งวัสดุ">
      <DashboardIntro eyebrow="TRANSPORT OVERVIEW" title="ภาพรวมการขนส่ง" description="ติดตามคำขอ สถานะรถ และงานขนส่งทั้งหมดจากจุดเดียว" />
      <div className="summary-grid three">
        <SummaryCard title="คำขอจัดส่ง" value={String(deliveryRequests.length)} note="รายการ" color="light-green" icon="/icons/listgreen.png" />
        <SummaryCard title="รถที่พร้อมรับงาน" value={String(readyTruckCount)} note="คัน" color="light-blue" icon="/icons/carblue.png" />
        <SummaryCard title="กำลังดำเนินการขนส่ง" value={String(runningTruckCount)} note="คัน" color="light-yellow" icon="/icons/clockyellow.png" />
      </div>
      <div className="supervisor-columns">
        <section className="outline-panel truck-panel">
          <h2>สถานะรถทั้งหมด</h2>
          <div className="pill-tabs" aria-label="กรองรถตามสถานะ">
            {truckFilters.map((filter) => (
              <button
                type="button"
                className={truckFilter === filter.label ? "active" : ""}
                aria-pressed={truckFilter === filter.label}
                key={filter.label}
                onClick={() => setTruckFilter(filter.label)}
              >
                {filter.label} {filter.count}
              </button>
            ))}
          </div>
          <div className="truck-table-head" aria-hidden="true">
            <span />
            <span>รหัสรถ</span>
            <span>สถานะ</span>
            <span>งาน</span>
            <span>พนักงานขับรถ</span>
            <span />
          </div>
          <div className="truck-list">
            {visibleTrucks.map((truck) => (
              <div className="truck-row" key={truck.id}>
                <span className="truck-picture"><img src={`/icons/car${truck.tone}.png`} alt="" /></span>
                <strong>{truck.id}</strong>
                <span className={`state-pill ${truck.tone}`}>{truck.status}</span>
                <span className="job-pill">{truck.job}</span>
                <span className="driver-cell"><b>{driverCodeFor(truck.id)}</b><small>{truck.driver}</small></span>
                <button onClick={() => onTruck(truck.id)}>ดูรายละเอียด</button>
              </div>
            ))}
            {visibleTrucks.length === 0 && <p className="empty-truck-list">ไม่พบรถในสถานะนี้</p>}
          </div>
        </section>
        <section className="outline-panel request-panel">
          <div className="panel-title-row">
            <h2>คำขอจัดส่ง</h2>
            <div className="request-panel-actions">
              <span>{visibleRequests.length} รายการ</span>
              <select
                className="request-filter"
                aria-label="กรองคำขอจัดส่งตามสถานะ"
                value={requestFilter}
                onChange={(event) => setRequestFilter(event.target.value as DeliveryFilter)}
              >
                <option value="ทั้งหมด">ทั้งหมด</option>
                <option value="รอมอบหมาย">รอมอบหมาย</option>
                <option value="กำลังขนส่ง">กำลังขนส่ง</option>
                <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                <option value="ขอยกเลิก">ขอยกเลิก</option>
              </select>
            </div>
          </div>
          {visibleRequests.map((request) => (
            <button className="request-row" key={request.id} onClick={() => onRequest(request.id)}>
              <span className="request-row-content">
                <span className="request-row-heading"><strong>{request.id}</strong><span className={`state-pill ${request.tone}`}>{request.status}</span></span>
                <span className="request-material">{request.material}<b>•</b>{request.weight}</span>
                <small>{request.customer}</small>
              </span>
              <span className="request-row-meta">
                <small>{request.pickup}</small>
                <b>{request.vehicle ? `รถ ${request.vehicle}` : "ยังไม่เลือกรถ"}</b>
                <em>ดูรายละเอียด <span>→</span></em>
              </span>
            </button>
          ))}
          {visibleRequests.length === 0 && <p className="empty-request-list">ไม่พบคำขอในสถานะนี้</p>}
        </section>
      </div>
    </section>
  );
}

function SalesDashboard({ approvedOrders, rejectedOrders, onOrder }: { approvedOrders: string[]; rejectedOrders: string[]; onOrder: (id: string) => void }) {
  const [orderFilter, setOrderFilter] = useState<SalesOrderFilter>("ทั้งหมด");
  const ordersWithStatus = purchaseOrders.map((order) => ({
    ...order,
    currentStatus: rejectedOrders.includes(order.id)
      ? "ปฏิเสธ"
      : approvedOrders.includes(order.id)
        ? "อนุมัติแล้ว"
        : order.status,
  }));
  const visibleOrders = orderFilter === "ทั้งหมด"
    ? ordersWithStatus
    : ordersWithStatus.filter((order) => order.currentStatus === orderFilter);

  return (
    <section className="dashboard-space" aria-label="คำขอซื้อ">
      <DashboardIntro eyebrow="PURCHASE MANAGEMENT" title="จัดการคำขอสั่งซื้อ" description="ตรวจสอบ อนุมัติ และติดตามสถานะคำสั่งซื้อวัสดุรีไซเคิล" />
      <div className="summary-grid four">
        <SummaryCard title="ทั้งหมด" value="16" note="รายการ" color="orange" icon="/icons/listyellow.png" />
        <SummaryCard title="รออนุมัติ" value={String(Math.max(0, 5 - approvedOrders.length - rejectedOrders.length))} note="รายการ" color="light-blue" icon="/icons/clockblue.png" />
        <SummaryCard title="อนุมัติแล้ว" value={String(8 + approvedOrders.length)} note="รายการ" color="light-green" icon="/icons/truegreen.png" />
        <SummaryCard title="ปฏิเสธ" value={String(3 + rejectedOrders.length)} note="รายการ" color="pink" icon="/icons/false.png" />
      </div>
      <section className="green-board">
        <div className="board-title">
          <h2>คำขอสั่งซื้อ</h2>
          <select className="sales-filter" aria-label="กรองคำขอซื้อตามสถานะ" value={orderFilter} onChange={(event) => setOrderFilter(event.target.value as SalesOrderFilter)}>
            <option value="ทั้งหมด">ทั้งหมด</option>
            <option value="รออนุมัติ">รออนุมัติ</option>
            <option value="อนุมัติแล้ว">อนุมัติแล้ว</option>
            <option value="ปฏิเสธ">ปฏิเสธ</option>
          </select>
        </div>
        {visibleOrders.map((order) => (
          <button className="purchase-row" key={order.id} onClick={() => onOrder(order.id)}>
            <span className="paper-icon"><img src="/icons/paperlist.png" alt="" /></span><strong>{order.id}</strong><span>{order.material}</span><span>{order.supplier}</span><em>{order.currentStatus === "รออนุมัติ" ? "ดูเพิ่มเติม" : order.currentStatus}</em>
          </button>
        ))}
        {visibleOrders.length === 0 && <p className="empty-sales-orders">ไม่พบคำขอซื้อในสถานะนี้</p>}
      </section>
    </section>
  );
}

function DriverDashboard({ acceptedJobs, completedJobs, onJob }: { acceptedJobs: string[]; completedJobs: string[]; onJob: (id: string) => void }) {
  const [jobFilter, setJobFilter] = useState<DriverJobFilter>("ทั้งหมด");
  const jobsWithStatus = driverJobs.map((job) => ({
    ...job,
    currentStatus: completedJobs.includes(job.id) ? "เสร็จสิ้น" : acceptedJobs.includes(job.id) ? "กำลังดำเนินการ" : job.status,
  }));
  const pendingCount = jobsWithStatus.filter((job) => job.currentStatus === "รอกดรับงาน").length;
  const completedCount = jobsWithStatus.filter((job) => job.currentStatus === "เสร็จสิ้น").length;
  const rejectedCount = jobsWithStatus.filter((job) => job.currentStatus === "ปฏิเสธ").length;
  const visibleJobs = jobFilter === "ทั้งหมด"
    ? jobsWithStatus
    : jobsWithStatus.filter((job) => job.currentStatus === jobFilter);

  return (
    <section className="dashboard-space" aria-label="งานที่ได้รับมอบหมาย">
      <DashboardIntro eyebrow="MY DELIVERY TASKS" title="งานขนส่งของคุณ" description="ดูงานที่ได้รับมอบหมาย รับงาน และรายงานผลการจัดส่ง" />
      <div className="summary-grid four">
        <SummaryCard title="ทั้งหมด" value="2" note="รายการ" color="orange" icon="/icons/listyellow.png" />
        <SummaryCard title="รอกดรับงาน" value={String(pendingCount)} note="รายการ" color="light-blue" icon="/icons/clockblue.png" />
        <SummaryCard title="เสร็จสิ้น" value={String(completedCount)} note="รายการ" color="light-green" icon="/icons/truegreen.png" />
        <SummaryCard title="ปฏิเสธ" value={String(rejectedCount)} note="รายการ" color="pink" icon="/icons/false.png" />
      </div>
      <section className="green-board driver-board">
        <div className="board-title">
          <h2>งานที่ได้รับมอบหมาย</h2>
          <select className="job-filter" aria-label="กรองงานตามสถานะ" value={jobFilter} onChange={(event) => setJobFilter(event.target.value as DriverJobFilter)}>
            <option value="ทั้งหมด">ทั้งหมด</option>
            <option value="รอกดรับงาน">รอกดรับงาน</option>
            <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
            <option value="เสร็จสิ้น">เสร็จสิ้น</option>
            <option value="ปฏิเสธ">ปฏิเสธ</option>
          </select>
        </div>
        {visibleJobs.map((job) => (
          <button className="driver-job-row" key={job.id} onClick={() => onJob(job.id)}>
            <span className="paper-icon"><img src="/icons/paperlist.png" alt="" /></span>
            <span><strong>งาน #{job.id} — {job.company}</strong><small>สถานะ: {job.currentStatus}</small></span>
            <em>ดูเพิ่มเติม</em>
          </button>
        ))}
        {visibleJobs.length === 0 && <p className="empty-driver-jobs">ไม่พบงานในสถานะนี้</p>}
      </section>
    </section>
  );
}

function SummaryCard({ title, value, note, color, icon }: { title: string; value: string; note: string; color: string; icon: string }) {
  return <article className={`prototype-summary ${color}`}><div><h2>{title}</h2><strong>{value}</strong><span>{note}</span></div><b>{icon && <img src={icon} alt="" />}</b></article>;
}

function DashboardIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="dashboard-intro"><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div><span><i /> ระบบพร้อมใช้งาน</span></header>;
}

function HomeView({ role, onView }: { role: Role; onView: (view: View) => void }) {
  const stats = {
    supervisor: [
      { title: "คำขอรอมอบหมาย", value: "2", note: "รายการ", icon: "/icons/listgreen.png", tone: "mint", target: "work" as View },
      { title: "รถพร้อมรับงาน", value: "8", note: "คัน", icon: "/icons/carblue.png", tone: "blue", target: "work" as View },
      { title: "ข้อความใหม่", value: "3", note: "ข้อความ", icon: "/icons/messenger.png", tone: "yellow", target: "messages" as View },
    ],
    sales: [
      { title: "รออนุมัติ", value: "5", note: "รายการ", icon: "/icons/clockblue.png", tone: "blue", target: "work" as View },
      { title: "อนุมัติแล้ว", value: "8", note: "รายการ", icon: "/icons/truegreen.png", tone: "mint", target: "work" as View },
      { title: "ข้อความใหม่", value: "2", note: "ข้อความ", icon: "/icons/messenger.png", tone: "yellow", target: "messages" as View },
    ],
    driver: [
      { title: "งานรอรับ", value: "1", note: "รายการ", icon: "/icons/clockblue.png", tone: "blue", target: "work" as View },
      { title: "งานเสร็จสิ้น", value: "1", note: "รายการ", icon: "/icons/truegreen.png", tone: "mint", target: "work" as View },
      { title: "ข้อความใหม่", value: "1", note: "ข้อความ", icon: "/icons/messenger.png", tone: "yellow", target: "messages" as View },
    ],
  }[role];

  return (
    <section className="simple-view home-view">
      <div className="home-hero">
        <img src="/icons/backgroud.png" alt="โลกและถังรีไซเคิล" />
        <div className="home-copy"><h1><span>เปลี่ยนขยะ</span><span>ให้เป็นรายได้</span></h1><p>เพื่อโลกที่ดีกว่า</p></div>
      </div>
      <section className="home-overview">
        <div className="home-overview-title">
          <div><small>ยินดีต้อนรับ</small><h2>{roleLabels[role]}</h2></div>
          <span>ภาพรวมวันนี้</span>
        </div>
        <div className="home-stat-grid">
          {stats.map((stat) => (
            <button className={`home-stat-card ${stat.tone}`} key={stat.title} onClick={() => onView(stat.target)}>
              <img src={stat.icon} alt="" />
              <span><strong>{stat.title}</strong><b>{stat.value} <small>{stat.note}</small></b></span>
              <em>เปิดดู →</em>
            </button>
          ))}
        </div>
        <button className="home-tip" onClick={() => onView("knowledge")}>
          <img src="/icons/recycleatknowledge.png" alt="" />
          <span><small>เคล็ดลับรีไซเคิลวันนี้</small><strong>แยกวัสดุก่อนทิ้ง ช่วยเพิ่มโอกาสนำกลับมาใช้ใหม่</strong></span>
          <em>อ่านเพิ่มเติม →</em>
        </button>
      </section>
    </section>
  );
}

function KnowledgeView() {
  const materials = [
    { id: "plastic", name: "ขวดพลาสติก", icon: "/icons/bottle.png", tone: "green", preparation: "เทของเหลวออก ล้างให้สะอาด และบีบขวดเพื่อลดพื้นที่", avoid: "ขวดที่ยังมีเศษอาหาร น้ำมัน หรือสารเคมีตกค้าง", result: "แยกฝาและฉลากออกก่อนรวบรวม จะช่วยให้คัดแยกได้รวดเร็วขึ้น" },
    { id: "paper", name: "กระดาษ", icon: "/icons/paper.png", tone: "blue", preparation: "แยกตามชนิด พับให้เรียบ และมัดรวมกันให้เป็นระเบียบ", avoid: "กระดาษเปียก กระดาษมัน หรือกระดาษที่เปื้อนอาหาร", result: "เก็บในที่แห้งเพื่อรักษาคุณภาพและน้ำหนักของกระดาษ" },
    { id: "glass", name: "ขวดแก้ว", icon: "/icons/glass.png", tone: "yellow", preparation: "ล้างภายใน แยกสี และใส่ภาชนะที่แข็งแรงเพื่อป้องกันแตก", avoid: "แก้วแตกที่ไม่ได้ห่อ กระจกเงา และหลอดไฟ", result: "แยกขวดแก้วใส เขียว และชา ช่วยลดเวลาในขั้นตอนคัดแยก" },
    { id: "metal", name: "โลหะ", icon: "/icons/metal.png", tone: "orange", preparation: "ล้างกระป๋องให้สะอาด ผึ่งให้แห้ง และบีบให้มีขนาดเล็กลง", avoid: "กระป๋องสารเคมี ภาชนะอัดแรงดัน หรือของมีคมที่เปิดอยู่", result: "รวบรวมอะลูมิเนียมและเหล็กแยกกันเพื่อความสะดวกในการรับซื้อ" },
  ];
  const [activeMaterialId, setActiveMaterialId] = useState(materials[0].id);
  const activeMaterial = materials.find((material) => material.id === activeMaterialId) ?? materials[0];

  return (
    <section className="simple-view knowledge-view">
      <div className="knowledge-hero">
        <div className="knowledge-hero-copy">
          <span className="knowledge-kicker">RECYCLE SMART · เรียนรู้ก่อนแยก</span>
          <div className="knowledge-hero-title"><img className="knowledge-recycle" src="/icons/recycleatknowledge.png" alt="" /><h1>แยกให้ถูก<br /><span>เพิ่มมูลค่าให้ขยะ</span></h1></div>
          <p>เปลี่ยนของที่ไม่ใช้แล้วให้กลับมามีคุณค่า ด้วยวิธีคัดแยกที่ทำตามได้จริงในทุกวัน</p>
          <div className="knowledge-hero-stats"><span><b>4</b> วัสดุยอดนิยม</span><span><b>3</b> ขั้นตอนหลัก</span></div>
        </div>
        <div className="knowledge-hero-image"><img src="/icons/pictureatknowledge.png" alt="แนวคิดสิ่งแวดล้อมที่ยั่งยืน" /><span>เริ่มจากการแยกให้ถูกประเภท</span></div>
      </div>
      <section className="knowledge-panel knowledge-learning">
        <div className="knowledge-title-row">
          <div><small>เริ่มต้นได้ตั้งแต่วันนี้</small><h2>3 ขั้นตอน ใช้ทรัพยากรให้คุ้มค่า</h2></div>
          <p>เรียงลำดับจากการลดขยะตั้งแต่ต้นทาง ก่อนนำของที่เหลือกลับเข้าสู่กระบวนการรีไซเคิล</p>
        </div>
        <div className="three-r">
          <article><b>01</b><div><span>Reduce</span><small>ลดการใช้</small><p>เลือกซื้อเท่าที่จำเป็น และลดบรรจุภัณฑ์แบบใช้ครั้งเดียว</p></div></article>
          <article><b>02</b><div><span>Reuse</span><small>ใช้ซ้ำ</small><p>นำถุง กล่อง และภาชนะที่ยังดี กลับมาใช้งานอีกครั้ง</p></div></article>
          <article><b>03</b><div><span>Recycle</span><small>นำกลับมาใช้ใหม่</small><p>ล้าง แยก และรวบรวมวัสดุให้พร้อมสำหรับการรับซื้อ</p></div></article>
        </div>
      </section>
      <section className="material-guide-section">
        <div className="knowledge-title-row">
          <div><small>คู่มือคัดแยกแบบง่าย</small><h2>เลือกวัสดุที่ต้องการรู้</h2></div>
          <p>กดเลือกประเภทวัสดุเพื่อดูวิธีเตรียมก่อนนำมาส่งหรือขาย</p>
        </div>
        <div className="material-guide-layout">
          <div className="material-selector" role="tablist" aria-label="ประเภทวัสดุรีไซเคิล">
            {materials.map((material) => <button type="button" role="tab" aria-selected={activeMaterial.id === material.id} className={activeMaterial.id === material.id ? `active ${material.tone}` : material.tone} key={material.id} onClick={() => setActiveMaterialId(material.id)}><img src={material.icon} alt="" /><span><strong>{material.name}</strong><small>ดูวิธีคัดแยก</small></span><b>›</b></button>)}
          </div>
          <article className={`material-detail ${activeMaterial.tone}`}>
            <div className="material-detail-head"><span><img src={activeMaterial.icon} alt="" /></span><div><small>วิธีเตรียมวัสดุ</small><h3>{activeMaterial.name}</h3></div></div>
            <div className="material-advice"><span className="advice good"><b>✓ ควรทำ</b><p>{activeMaterial.preparation}</p></span><span className="advice avoid"><b>! ควรหลีกเลี่ยง</b><p>{activeMaterial.avoid}</p></span></div>
            <div className="material-result"><b>เคล็ดลับก่อนส่ง</b><p>{activeMaterial.result}</p></div>
          </article>
        </div>
      </section>
      <aside className="knowledge-fact"><span>💡</span><div><small>รู้หรือไม่?</small><strong>วัสดุที่สะอาด แห้ง และแยกประเภทเรียบร้อย ช่วยให้ตรวจรับได้เร็วขึ้น</strong></div><em>แยกก่อนทิ้งทุกครั้ง</em></aside>
    </section>
  );
}

function MessagesView({ role }: { role: Role }) {
  const contacts = role === "supervisor"
    ? ["พนักงานรับซื้อ", "พนักงานขับรถ : D11", "พนักงานขับรถ : D12"]
    : role === "sales"
      ? ["คู่ค้า : M1 บริษัทอิเล็กทรอนิกส์", "หัวหน้าการขนส่ง"]
      : ["หัวหน้าการขนส่ง"];
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const contactPreviews = [
    { text: "คุณ: รับทราบ เดี๋ยวตรวจสอบให้ครับ", time: "1 นาที", unread: 0 },
    { text: "รถ C05 มีปัญหา ไม่สามารถไปส่งได้", time: "3 นาที", unread: 2 },
    { text: "ถึงจุดรับวัสดุแล้วครับ", time: "8 นาที", unread: 1 },
  ];

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    const message = draftMessage.trim();
    if (!message) return;
    setSentMessages((current) => [...current, message]);
    setDraftMessage("");
  };

  return (
    <section className="simple-view message-view">
      <div className="message-title-row">
        <div><small>ข้อความภายในระบบ</small><h1>{selectedContact ? "ข้อความ" : "กล่องข้อความของคุณ"}</h1></div>
        <span>{selectedContact ? "กำลังสนทนา" : `${contacts.length} รายการ`}</span>
      </div>
      <div className={selectedContact ? "message-box conversation" : "message-box"}>
        {!selectedContact ? (
          <div className="inbox-list">
            {contacts.map((contact, index) => (
              <button key={contact} onClick={() => setSelectedContact(contact)}>
                <span className="profile-outline"><img src="/icons/person.png" alt="" /></span>
                <span className="inbox-copy"><strong>{contact}</strong><small>{contactPreviews[index]?.text ?? "มีข้อความใหม่"}</small></span>
                <span className="inbox-meta"><time>{contactPreviews[index]?.time ?? "เมื่อสักครู่"}</time>{Boolean(contactPreviews[index]?.unread) && <b>{contactPreviews[index].unread}</b>}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <header className="chat-contact-bar">
              <button className="back-to-inbox" aria-label="กลับไปกล่องข้อความ" onClick={() => setSelectedContact(null)}>←</button>
              <div className="contact"><span className="profile-outline"><img src="/icons/person.png" alt="" /></span><div><strong>{selectedContact}</strong><small><i /> ออนไลน์</small></div></div>
            </header>
            <div className="chat-timeline" aria-live="polite">
              <div className="chat-date-divider"><span>วันนี้</span></div>
              <article className="chat-message incoming"><p>มีปัญหารถเสีย ไปส่งไม่ได้ครับ</p><time>00:43</time></article>
              <article className="chat-message outgoing"><p>รับทราบครับ ตอนนี้รถอยู่บริเวณไหน</p><time>00:44</time></article>
              <article className="chat-message incoming"><p>อยู่ใกล้จุดรับวัสดุ M1 ครับ คาดว่าต้องใช้เวลาซ่อมประมาณหนึ่งชั่วโมง</p><time>00:45</time></article>
              <article className="chat-message outgoing"><p>เดี๋ยวจะมอบหมายให้รถอีกคันไปส่งแทนครับ</p><time>00:46 · อ่านแล้ว</time></article>
              {sentMessages.map((message, index) => <article className="chat-message outgoing" key={`${message}-${index}`}><p>{message}</p><time>เมื่อสักครู่ · ส่งแล้ว</time></article>)}
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              <input aria-label="พิมพ์ข้อความ" value={draftMessage} placeholder="พิมพ์ข้อความ..." onChange={(event) => setDraftMessage(event.target.value)} />
              <button type="submit" disabled={!draftMessage.trim()}><span>ส่งข้อความ</span><b>➤</b></button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function DeliveryModal({ id, selectedTruck, onTruck, onClose, onConfirm }: { id: string; selectedTruck: string | null; onTruck: (id: string | null) => void; onClose: () => void; onConfirm: () => void }) {
  const request = deliveryRequests.find((item) => item.id === id) ?? deliveryRequests[0];
  const isPending = request.tone === "yellow";
  const isInTransit = request.tone === "blue";
  const isCompleted = request.tone === "green";
  const cancelled = request.tone === "red";
  const [truckSearch, setTruckSearch] = useState("");
  const availableTrucks = trucks.filter((truck) => truck.status === "รองาน");
  const normalizedSearch = truckSearch.trim().toLowerCase();
  const visibleAvailableTrucks = availableTrucks.filter((truck) =>
    `${truck.id} ${truck.plate} ${truck.driver}`.toLowerCase().includes(normalizedSearch),
  );
  return (
    <ModalFrame onClose={onClose} className="delivery-modal">
      <h2>รายละเอียดคำขอ : {id} <span className={`tag ${isPending ? "purple" : request.tone}`}>{request.status}</span></h2>
      <div className="delivery-modal-content">
      <div className="request-details"><p><b>วัสดุ</b> {request.material} ({request.weight})</p><p><b>ลูกค้า</b> {request.customer}</p><p><b>ที่อยู่</b> บ้านโป่ง 337/15 จ.ร้อยเอ็ด อ.เสลภูมิ ต.ภูเงิน</p><p><b>เวลานัดรับ</b> {request.pickup}</p><p><b>เบอร์โทร</b> 0811551689</p>{cancelled && <><p><b>รถที่รับงาน</b> {request.vehicle}</p><label>เหตุผลที่ขอยกเลิก</label><div className="reason-box">ลูกค้ายกเลิกกลางคัน</div></>}</div>
      {isPending && (
        <section className="truck-selection-block">
          <div className="truck-picker-header">
            <div><b>เลือกรถที่พร้อมรับงาน</b><small>{availableTrucks.length} คันพร้อมรับงาน</small></div>
            <input aria-label="ค้นหารถ" value={truckSearch} placeholder="ค้นหารหัสรถ ทะเบียน หรือคนขับ" onChange={(event) => setTruckSearch(event.target.value)} />
          </div>
          <div className="truck-picker" role="listbox" aria-label="รถที่พร้อมรับงาน">
            {visibleAvailableTrucks.map((truck) => {
              const isSelected = selectedTruck === truck.id;
              return (
                <button className={isSelected ? "selected" : ""} type="button" role="option" aria-selected={isSelected} key={truck.id} onClick={() => onTruck(isSelected ? null : truck.id)}>
                  <span><img src="/icons/cargreen.png" alt="" /></span>
                  <span><strong>{truck.id} · {truck.plate}</strong><small>{driverCodeFor(truck.id)} · {truck.driver} · {truck.capacity} · ออนไลน์</small></span>
                  <span className="truck-choice-state">{isSelected ? "✓ เลือกแล้ว" : "เลือก"}</span>
                </button>
              );
            })}
            {visibleAvailableTrucks.length === 0 && <p className="empty-truck-search">ไม่พบรถที่ค้นหา</p>}
          </div>
        </section>
      )}
      {isInTransit && (
        <div className="delivery-status-state in-progress">
          <span>→</span>
          <div>
            <b>คำขอนี้กำลังดำเนินการขนส่ง</b>
            <small>รายการได้รับการมอบหมายรถแล้ว จึงไม่สามารถเลือกรถหรือมอบหมายซ้ำได้</small>
          </div>
        </div>
      )}
      {isCompleted && (
        <div className="delivery-status-state completed">
          <span>✓</span>
          <div>
            <b>การขนส่งรายการนี้เสร็จสิ้นแล้ว</b>
            <small>รายการปิดงานเรียบร้อยแล้ว จึงไม่สามารถแก้ไขหรือมอบหมายรถซ้ำได้</small>
          </div>
        </div>
      )}
      </div>
      <div className="modal-buttons">
        {isPending && <button className={selectedTruck ? "green-button" : "gray-button"} disabled={!selectedTruck} onClick={onConfirm}>ยืนยันมอบหมาย</button>}
        {cancelled && <button className="red-button" onClick={onConfirm}>อนุมัติคำขอยกเลิก</button>}
        <button className="gray-button" onClick={onClose}>ปิด</button>
      </div>
    </ModalFrame>
  );
}

function TruckModal({ id, onClose }: { id: string; onClose: () => void }) {
  const truck = trucks.find((item) => item.id === id) ?? trucks[0];
  return <ModalFrame onClose={onClose} compact><h2>รหัสรถ {truck.id}</h2><div className="truck-details"><p>ทะเบียนรถ : {truck.plate}</p><p>สถานะ : {truck.status}</p><p>รหัสพนักงานขับรถ : {driverCodeFor(truck.id)}</p><p>พนักงานขับรถ : {truck.driver}</p><p>ความจุ : {truck.capacity}</p><p>เบอร์โทรศัพท์ : {truck.phone}</p></div></ModalFrame>;
}

function OrderModal({ id, status, onClose, onCancel, onConfirm }: { id: string; status: SalesOrderStatus; onClose: () => void; onCancel: () => void; onConfirm: () => void }) {
  const order = purchaseOrders.find((item) => item.id === id) ?? purchaseOrders[0];
  const enough = order.stock >= order.requested;
  const isPending = status === "รออนุมัติ";
  const isApproved = status === "อนุมัติแล้ว";
  return (
    <ModalFrame onClose={onClose}>
      <h2>คำสั่งซื้อ : {order.id} <span className={isApproved ? "tag green" : status === "ปฏิเสธ" ? "tag red" : "tag purple"}>{status}</span></h2>
      <div className="order-fields"><label>คู่ค้า<input readOnly value={order.supplier} /></label><label>รายการวัสดุ<input readOnly value={order.material} /></label><label>จำนวนที่ต้องการ (กก.)<input readOnly value={order.requested} /></label><label>คงเหลือในคลัง<div className="stock-box">{order.stock} กก.</div></label></div>
      {isPending && !enough && <div className="stock-warning">วัสดุไม่เพียงพอ ขาดอีก {order.requested - order.stock} กก.</div>}
      {!isPending && <div className={isApproved ? "order-final-state approved" : "order-final-state rejected"}><span>{isApproved ? "✓" : "×"}</span><div><b>{isApproved ? "คำสั่งซื้อนี้ได้รับการอนุมัติแล้ว" : "คำสั่งซื้อนี้ถูกปฏิเสธแล้ว"}</b><small>สถานะสิ้นสุดแล้ว ไม่สามารถอนุมัติหรือยกเลิกรายการซ้ำได้</small></div></div>}
      <div className="modal-buttons">{isPending ? <><button className="red-button" onClick={onCancel}>ยกเลิกคำสั่งซื้อ</button><button className="green-button" disabled={!enough} onClick={onConfirm}>ยืนยันคำสั่งซื้อ</button></> : <button className="gray-button" onClick={onClose}>ปิด</button>}</div>
    </ModalFrame>
  );
}

function DriverJobModal({ id, status, onClose, onAccept, onCancel, onComplete }: { id: string; status: DriverJobStatus; onClose: () => void; onAccept: () => void; onCancel: (reason: string) => void; onComplete: () => void }) {
  const [requestingCancel, setRequestingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const reasonIsValid = cancelReason.trim().length > 0;
  const isPending = status === "รอกดรับงาน";
  const isInProgress = status === "กำลังดำเนินการ";
  const isCompleted = status === "เสร็จสิ้น";
  const isRejected = status === "ปฏิเสธ";
  const statusTagClass = isInProgress ? "blue" : isCompleted ? "green" : isRejected ? "red" : "purple";

  return (
    <ModalFrame onClose={onClose}>
      <h2>รายละเอียดคำขอ : {id} <span className={`tag ${statusTagClass}`}>{status}</span></h2>
      <div className="request-details"><p><b>วัสดุ</b> ขวดพลาสติก, กระดาษ ขาว-ดำ</p><p><b>ชื่อ</b> นายพานิช ผลส่ง</p><p><b>ที่อยู่</b> บ้านโป่ง 337/15 จ.ร้อยเอ็ด อ.เสลภูมิ ต.ภูเงิน</p><p><b>เบอร์โทร</b> 0811551689</p></div>
      {isCompleted && <div className="delivery-status-state completed"><span>✓</span><div><b>งานขนส่งนี้เสร็จสิ้นแล้ว</b><small>รายการปิดงานเรียบร้อยแล้ว ไม่สามารถรับงานหรือขอยกเลิกซ้ำได้</small></div></div>}
      {isRejected && <div className="order-final-state rejected"><span>×</span><div><b>งานขนส่งนี้ถูกปฏิเสธแล้ว</b><small>สถานะสิ้นสุดแล้ว ไม่สามารถรับงานหรือขอยกเลิกซ้ำได้</small></div></div>}
      {requestingCancel && (
        <div className="cancel-reason-form">
          <label htmlFor={`cancel-reason-${id}`}>เหตุผลที่ขอยกเลิก <span>*</span></label>
          <textarea
            id={`cancel-reason-${id}`}
            value={cancelReason}
            maxLength={250}
            autoFocus
            placeholder="ระบุสาเหตุ เช่น รถขัดข้อง หรือไม่สามารถเดินทางได้"
            onChange={(event) => setCancelReason(event.target.value)}
          />
          <small>{cancelReason.length}/250 ตัวอักษร</small>
        </div>
      )}
      <div className="modal-buttons">
        {requestingCancel ? (
          <>
            <button className="gray-button" onClick={() => { setRequestingCancel(false); setCancelReason(""); }}>ย้อนกลับ</button>
            <button className="red-button" disabled={!reasonIsValid} onClick={() => onCancel(cancelReason.trim())}>ยืนยันคำขอยกเลิก</button>
          </>
        ) : isPending || isInProgress ? (
          <>
            {isInProgress ? <button className="green-button" onClick={onComplete}>ยืนยันส่งสำเร็จ</button> : <button className="green-button" onClick={onAccept}>รับงาน</button>}
            <button className="red-button" onClick={() => setRequestingCancel(true)}>ขอยกเลิก</button>
          </>
        ) : <button className="gray-button" onClick={onClose}>ปิด</button>}
      </div>
    </ModalFrame>
  );
}

function ModalFrame({ children, onClose, compact = false, className = "" }: { children: React.ReactNode; onClose: () => void; compact?: boolean; className?: string }) {
  const modalClassName = ["prototype-modal", compact ? "compact" : "", className].filter(Boolean).join(" ");
  return <div className="prototype-modal-layer" role="presentation" onMouseDown={onClose}><section className={modalClassName} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-x" aria-label="ปิดหน้าต่าง" onClick={onClose}>×</button>{children}</section></div>;
}
