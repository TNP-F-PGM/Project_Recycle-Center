# RecycleHub UI Design Guide

เอกสารนี้เป็นแนวทางกลางสำหรับพัฒนาหน้าเว็บ RecycleHub ให้หน้าที่เพิ่มใหม่มีหน้าตาและพฤติกรรมสอดคล้องกับระบบเดิม ก่อนเริ่มทำหน้าใหม่ให้อ่านไฟล์นี้และตรวจคอมโพเนนต์ที่มีอยู่ก่อนเสมอ

## 1. ภาพรวมของงานออกแบบ

RecycleHub เป็นระบบบริหารงานขาย คำขอซื้อ สัญญา โรงงาน และการขนส่งวัสดุรีไซเคิล ลักษณะของ UI ควรให้ความรู้สึกเป็นระบบงานภายในองค์กรที่สะอาด สุภาพ และใช้งานง่าย

หลักการสำคัญ:

- ใช้โทนเขียวธรรมชาติ พื้นหลังสว่าง และพื้นที่ว่างพอเหมาะ
- แสดงข้อมูลสำคัญก่อนรายละเอียดเสริม
- ใช้ข้อความภาษาไทยที่ตรงไปตรงมา โดยมีคำอังกฤษสั้น ๆ ใน eyebrow ของหัวหน้าเพจ
- การทำงานที่มีผลต่อข้อมูลต้องมีสถานะกำลังบันทึก ข้อความผิดพลาด และผลลัพธ์ที่ชัดเจน
- ซ่อนปุ่มที่ผู้ใช้ไม่มีสิทธิ์ใช้ และตรวจสิทธิ์ซ้ำที่ backend
- รองรับจอคอมพิวเตอร์ แท็บเล็ต และโทรศัพท์
- ใช้รูปแบบเดิมจากระบบก่อนสร้าง CSS หรือคอมโพเนนต์ใหม่

## 2. เทคโนโลยี UI

- React 19 + TypeScript
- React Router
- CSS กลางใน `frontend/src/styles.css`
- ไอคอนจาก `lucide-react`
- ฟอนต์ `Inter` สำหรับตัวเลข/อังกฤษ และ `Noto Sans Thai` สำหรับภาษาไทย
- แผนที่ใช้ Leaflet และ OpenStreetMap
- API เรียกผ่าน helper ใน `frontend/src/services/api.ts`

ไม่เพิ่ม UI framework ใหม่ เช่น Bootstrap, Tailwind หรือ Material UI โดยไม่ตกลงกับทีมก่อน เพราะจะทำให้หน้าตาและขนาดคอมโพเนนต์ไม่ตรงกับระบบเดิม

## 3. แหล่งอ้างอิงหลักในโค้ด

| สิ่งที่ต้องการดู | ไฟล์ |
|---|---|
| Routes ของระบบ | `frontend/src/App.tsx` |
| Sidebar, Topbar และเมนูตาม Role | `frontend/src/components/Layout.tsx` |
| คอมโพเนนต์ UI กลาง | `frontend/src/components/ui.tsx` |
| สี ขนาด และ Responsive | `frontend/src/styles.css` |
| Types ของข้อมูล | `frontend/src/types.ts` |
| การเรียก API และแปล Error | `frontend/src/services/api.ts` |
| Context และข้อมูลร่วม | `frontend/src/context/AppContext.tsx` |
| รูปแบบหน้ารายการ | `frontend/src/pages/Orders.tsx` หรือ `Contracts.tsx` |
| รูปแบบหน้าฟอร์ม | `frontend/src/pages/OrderForm.tsx` หรือ `ContractForm.tsx` |
| รูปแบบหน้ารายละเอียด | `frontend/src/pages/OrderDetail.tsx` หรือ `ContractDetail.tsx` |
| โลโก้ | `frontend/public/icons/Logo.png` |

## 4. Brand และสี

ใช้ตัวแปรที่มีอยู่ใน `:root` ก่อนเขียนค่าสีใหม่

| Token | ค่า | การใช้งาน |
|---|---:|---|
| `--green` | `#397a27` | สีหลัก ปุ่มหลัก และจุดเน้น |
| `--green-dark` | `#234821` | สีเขียวเข้ม |
| `--lime` | `#c8ec80` | เมนูที่กำลังเลือกใน Sidebar |
| `--muted` | `#84908a` | ข้อความรอง |
| `--border` | `#e9eeeb` | เส้นขอบ Card, Input และ Table |
| `--surface` | `#ffffff` | พื้นผิว Card และ Modal |
| `--shadow` | `0 4px 16px #203c2d05` | เงา Card แบบเบา |

สีพื้นหลังหน้าเว็บคือ `#f5f8f6` และสีข้อความหลักคือ `#233530`

- Primary button ใช้ Gradient `#336c25` ไป `#467a26` และ hover เป็น `#2d6424`
- Link หรือ action text ใช้ `#378566` และ hover เป็น `#245a43`
- Danger solid ใช้ `#bc4039`
- Focus outline ใช้ `#5b9d32`
- Input ที่ focus ใช้เส้นขอบ `#77a368`

Sidebar ใช้ Gradient เดิม:

```css
background: linear-gradient(
  164deg,
  #467736 0%,
  #315d2c 33%,
  #1b2e1b 85%,
  #19291b 100%
);
```

สีตามความหมาย:

| ความหมาย | สีข้อความ | สีพื้นหลัง |
|---|---:|---:|
| สำเร็จ / ใช้งานอยู่ | `#5c9a7a` | `#eaf6ee` |
| รอดำเนินการ / คำเตือน | `#aa8732` | `#fff5dc` |
| ข้อมูล / รอลงนาม | `#668fa5` | `#eaf3f9` |
| ผิดพลาด / ยกเลิก | `#c7857b` | `#fceeea` |
| สถานะทั่วไป / ร่าง | `#7a897f` | `#f0f3f1` |

อย่าใช้สีแดงกับการทำงานทั่วไป สีแดงสงวนไว้สำหรับข้อผิดพลาด การลบ และการยกเลิก

## 5. Typography

```css
font-family: 'Inter', 'Noto Sans Thai', sans-serif;
```

ขนาดที่ใช้อยู่:

| ตำแหน่ง | ขนาดโดยประมาณ |
|---|---:|
| หัวข้อหลักของหน้า `h1` | 29px; จอเล็ก 25px |
| หัวข้อ Card `h2` | 14–16px |
| หัวข้อย่อย `h3` | 15px |
| ข้อความทั่วไป | 12–13px |
| Label และข้อความรอง | 10–11px |
| Eyebrow ภาษาอังกฤษ | 9px ตัวพิมพ์ใหญ่ |

ภาษาไทยควรมี `line-height` ประมาณ `1.7–1.9` เพื่อให้อ่านง่าย หลีกเลี่ยงข้อความภาษาอังกฤษตัวพิมพ์ใหญ่ยาว ๆ

## 6. Layout หลัก

โครงหน้าภายในระบบต้องอยู่ใต้ `<Layout />` เสมอ เพื่อให้ได้ Sidebar, Topbar, Toast และ Footer ชุดเดียวกัน

- Sidebar กว้าง 244px และลดเป็น 218px เมื่อจอไม่เกิน 1180px
- Topbar สูง 82px และเป็น sticky
- เนื้อหาหลักกว้างไม่เกิน 1600px
- เนื้อหาหลักใช้ padding ประมาณ 36px 42px
- Card ใช้ `.panel` ซึ่งมีพื้นหลังขาว ขอบบาง มุม 11px และเงาเบา
- ระยะห่างระหว่าง Card ใช้ประมาณ 20–24px

โครงหน้ามาตรฐาน:

```tsx
<>
  <PageIntro
    eyebrow="MODULE NAME"
    title="ชื่อหน้าภาษาไทย"
    description="บอกผู้ใช้ว่าหน้านี้ใช้ทำอะไร"
  >
    <RefreshButton onClick={reload} busy={loading} />
    <Link className="button primary" to="/items/new">
      <Plus size={17} />
      เพิ่มรายการ
    </Link>
  </PageIntro>

  <section className="panel">
    {/* เนื้อหาหน้า */}
  </section>
</>
```

## 7. คอมโพเนนต์กลางที่ต้องใช้ซ้ำ

นำเข้าจาก `frontend/src/components/ui.tsx`

| Component | ใช้เมื่อ |
|---|---|
| `PageIntro` | หัวหน้าทุกหน้า รวมชื่อ คำอธิบาย ปุ่ม และลิงก์ย้อนกลับ |
| `Status` | แสดงสถานะจากค่า backend |
| `ErrorBox` | แสดงข้อความผิดพลาด และปุ่มลองอีกครั้งถ้ามี |
| `Loading` | ระหว่างโหลดข้อมูล |
| `Empty` | ไม่มีข้อมูลหรือค้นหาไม่พบ |
| `RefreshButton` | โหลดข้อมูลหน้าใหม่ |
| `Metric` | ตัวเลขสรุปด้านบน Dashboard หรือหน้ารายการ |
| `SearchBox` | ค้นหาในหน้ารายการ |
| `Modal` | ยืนยันหรือกรอกข้อมูลสั้น ๆ โดยไม่เปลี่ยนหน้า |
| `Stepper` | แสดงขั้นตอนของ Workflow |
| `Info` | แสดง Label/Value ในหน้ารายละเอียดและ Summary |

หากหลายหน้าต้องใช้ UI แบบเดียวกัน ให้เพิ่มเป็น shared component แทนการคัดลอก JSX และ CSS ไปทุกหน้า

## 8. ปุ่มและการกระทำ

ใช้คลาสดังนี้:

| รูปแบบ | Class | ตัวอย่างการใช้ |
|---|---|---|
| ปุ่มหลัก | `button primary` | สร้าง, บันทึก, ยืนยัน |
| ปุ่มรอง | `button secondary` | รีเฟรช, แก้ไข, ยกเลิก |
| ปุ่มพื้นเขียวอ่อน | `button soft` | ดูรายละเอียด, เพิ่มรายการย่อย |
| ปุ่มขนาดเล็ก | เพิ่ม `small` | ปุ่มในแถว Table |
| ปุ่มเต็มความกว้าง | เพิ่ม `full` | ปุ่มใน Sidebar ของฟอร์ม |
| การกระทำอันตราย | `danger` หรือ `danger-outline` | ลบหรือยกเลิกเท่านั้น |
| ปุ่มไอคอน | `icon-button` | ปิด Modal, ลบแถว, เปิดเมนู |
| ลิงก์ข้อความ | `text-link` | เปิดรายละเอียดหรือหน้าเกี่ยวข้อง |

กฎของปุ่ม:

- หนึ่งส่วนควรมี Primary action เด่นเพียงหนึ่งปุ่ม
- ปุ่มที่กำลังทำงานต้อง `disabled` และเปลี่ยนข้อความ เช่น `กำลังบันทึก…`
- ปุ่มที่ไม่มีสิทธิ์ใช้ควรซ่อน ไม่ควรแสดงแล้วปล่อยให้กดเจอ Error
- ปุ่มที่ส่ง `<form>` ต้องมี type ที่ถูกต้อง ปุ่มอื่นในฟอร์มต้องใช้ `type="button"`
- การลบหรือยกเลิกข้อมูลสำคัญต้องมีหน้าต่างยืนยัน

## 9. หน้ารายการ

ใช้ลำดับต่อไปนี้:

1. `PageIntro`
2. Metrics ถ้ามีตัวเลขที่ช่วยตัดสินใจ
3. `.section-label`
4. `.panel`
5. `.table-toolbar` ที่มี Search, Filter และ Export
6. Table หรือ `Empty`
7. `.table-footer` สำหรับจำนวนรายการและ Pagination

รูปแบบแถวหลัก:

```tsx
<Link className="row-identity" to={`/items/${item.id}`}>
  <span className="row-avatar">
    <Package size={17} />
  </span>
  <span>
    <strong>{item.name}</strong>
    <small>{item.id}</small>
  </span>
</Link>
```

ข้อควรระวัง:

- Table ต้องอยู่ใน `.table-scroll` เพื่อไม่ให้หน้าจอเล็กแตก
- หัวตารางใช้คำสั้นและชัดเจน
- ตัวเลขและเงินใช้ `className="numeric"`
- วันที่ใช้ `dateLabel()` ตัวเลขใช้ `number()` และรหัสยาวใช้ `shortId()`
- เมื่อ Search/Filter แล้วไม่พบ ให้บอกว่าไม่ตรงกับตัวกรอง แยกจากกรณียังไม่มีข้อมูลเลย

## 10. หน้าฟอร์ม

หน้าฟอร์มขนาดใหญ่ใช้ `.form-layout` แบ่งเป็นเนื้อหาหลักและ Summary ด้านขวา

```tsx
<form onSubmit={submit}>
  <fieldset className="form-fieldset" disabled={busy}>
    <div className="form-layout">
      <div className="form-sections">
        <section className="panel form-panel">
          <h2>ข้อมูลหลัก</h2>
          <div className="form-grid">
            {/* fields */}
          </div>
        </section>
      </div>

      <aside className="panel order-summary">
        {/* สรุปและปุ่มบันทึก */}
      </aside>
    </div>
  </fieldset>
</form>
```

กฎของฟอร์ม:

- Label อยู่เหนือ Input เสมอ
- ช่องบังคับใช้ `<span className="required">*</span>`
- ใช้ `<label className="field">`
- สองคอลัมน์ใช้ `.form-grid`; ช่องเต็มแถวเพิ่ม `.span-2`
- แบ่งข้อมูลเป็น Card ตามหัวข้อ ไม่รวมทุกอย่างไว้ใน Card เดียว
- Summary ด้านขวาแสดงสิ่งที่ผู้ใช้กำลังจะบันทึก
- ตรวจข้อมูลฝั่ง frontend เพื่อช่วยผู้ใช้ และตรวจซ้ำที่ backend เพื่อความถูกต้อง
- Error จาก API แสดงด้วย `ErrorBox` ใกล้ปุ่มบันทึก
- หลังบันทึกสำเร็จใช้ `notify()` แล้วนำไปหน้ารายละเอียด
- จำนวน ราคา และส่วนลดต้องกำหนด `min`, `max` และ `step` ให้ตรงชนิดข้อมูลจริง
- ไม่ใช้ placeholder แทน Label

## 11. หน้ารายละเอียด

ใช้ `.detail-grid` แบ่งเนื้อหาหลักกับข้อมูลประกอบด้านขวา

- ด้านบนใช้ `PageIntro` พร้อม `Status` และปุ่มแก้ไขเมื่อมีสิทธิ์
- แสดงรหัสรายการด้วย `.record-id`
- Workflow ที่มีหลายสถานะควรแสดง Stepper
- ข้อมูล Label/Value ใช้ `<dl className="info-grid">` และ `Info`
- รายการย่อยจำนวนหลายรายการใช้ Table
- การกระทำถัดไปวางใน Card ด้านขวาและอธิบายผลก่อนปุ่ม
- ประวัติหรือเหตุการณ์ย้อนหลังวางหลังข้อมูลหลัก

## 12. Modal, Feedback และสถานะหน้า

Modal ใช้สำหรับงานที่สั้นและเกี่ยวข้องกับหน้าปัจจุบัน เช่น ยืนยัน ยกเลิก รายงานปัญหา หรือกรอกเหตุผล ไม่ควรยัดฟอร์มขนาดใหญ่หลายส่วนไว้ใน Modal

ทุกหน้าที่โหลด API ต้องรองรับอย่างน้อย:

```tsx
if (record.loading) return <Loading />
if (!record.data) return <ErrorBox message={record.error} retry={record.reload} />
```

หลัง Mutation:

- สำเร็จ: ใช้ Toast ผ่าน `notify('ข้อความสำเร็จ')`
- ผิดพลาด: ใช้ `errorText(error)` แล้วแสดง `ErrorBox`
- ระหว่างทำงาน: ปิดการกดซ้ำด้วย `busy`
- ไม่มีข้อมูล: ใช้ `Empty` พร้อมคำแนะนำว่าผู้ใช้ควรทำอะไรต่อ

## 13. Status

ข้อความสถานะอยู่ใน `frontend/src/utils/format.ts` และแสดงผ่าน `<Status value={status} />`

สถานะที่มีอยู่ เช่น:

- `pending` — รอมอบหมาย
- `assigned` — มอบหมายแล้ว
- `in_transit` — กำลังขนส่ง
- `on_hold` — หยุดชั่วคราว / รอแก้ไข
- `delivered` — จัดส่งสำเร็จ
- `draft` — ร่างสัญญา
- `pending_approval` — รออนุมัติ
- `pending_signature` — รอลงนาม
- `active` — ใช้งานอยู่
- `expired` — หมดอายุ
- `cancelled` — ยกเลิกแล้ว
- `rejected` — ไม่อนุมัติ

เมื่อ backend เพิ่มสถานะใหม่ ต้องเพิ่มทั้งข้อความใน `statusLabels` และสี `.status-<value>` หากความหมายไม่ตรงกับสีที่มีอยู่

## 14. Navigation และ Role

เมนูต้องเพิ่มใน `frontend/src/components/Layout.tsx` เฉพาะ Role ที่ใช้งานจริง และเพิ่ม Route ใน `frontend/src/App.tsx`

Role ปัจจุบัน:

| Role | เมนูหลัก |
|---|---|
| `sales` — พนักงานขาย | ภาพรวม, คำขอซื้อ, สัญญาซื้อขาย, ติดตามการขนส่ง, รายการวัสดุ, โรงงาน |
| `transport` — หัวหน้าการขนส่ง | ภาพรวม, คำขอรับ–ส่งวัสดุ, รถขนส่ง, พนักงานขับรถ |
| `driver` — พนักงานขับรถ | งานของฉัน, ประวัติการขนส่ง |

ทุก Role มีเมนูศูนย์ช่วยเหลือร่วมกัน

Role ที่วางแผนเพิ่มภายหลัง:

- `manager` — ผู้จัดการสำหรับอนุมัติโรงงาน สัญญา หรือรายการที่กำหนด

ระบบเลือก Workspace ปัจจุบันเป็นโหมด Demo ที่เก็บค่าใน `localStorage` ยังไม่ใช่ระบบ Login จริง เมื่อเพิ่ม Authentication ต้องรับ Role จาก Session/Token ที่ backend ตรวจสอบแล้ว ห้ามเชื่อ Role ที่ frontend ส่งมาเอง

ตัวอย่างป้องกันหน้า:

```tsx
const { workspace } = useApp()
if (workspace?.role !== 'sales') return <Navigate to="/" replace />
```

การซ่อน UI ไม่ใช่ระบบรักษาความปลอดภัย Backend ต้องตรวจสิทธิ์ทุก API ด้วย

## 15. Icons และ Assets

- ใช้ไอคอนจาก `lucide-react` เป็นหลัก
- ไอคอนในข้อความและปุ่มทั่วไปใช้ขนาด 15–18px
- ไอคอนหัวข้อ Card ใช้ประมาณ 18–20px
- ไอคอน Metric ใช้ประมาณ 21px
- ใช้ไอคอนที่สื่อความหมายตรงกันทั้งระบบ เช่น `Truck`, `Factory`, `Package`, `ClipboardList`, `ScrollText`
- ไม่ใช้ Emoji แทนไอคอนในหน้าระบบ
- โลโก้หลักอยู่ที่ `frontend/public/icons/Logo.png` และเรียกผ่าน `<Brand />`
- รูปเฉพาะระบบเพิ่มเติมให้เก็บใต้ `frontend/public/icons/` หรือ `frontend/public/images/` ตามชนิดไฟล์
- ไม่เก็บภาพไว้กระจายในโฟลเดอร์ `pages`

## 16. Responsive และ Accessibility

Breakpoint หลักของระบบ:

| ความกว้าง | พฤติกรรมหลัก |
|---:|---|
| มากกว่า 1500px | เพิ่มพื้นที่ว่างสำหรับจอใหญ่ |
| ไม่เกิน 1180px | Sidebar และช่องว่างแคบลง |
| ไม่เกิน 980px | Form/Detail เปลี่ยนเป็นหนึ่งคอลัมน์ |
| ไม่เกิน 760px | Sidebar เปลี่ยนเป็นเมนูเปิด–ปิด |
| ไม่เกิน 720px | แถววัสดุในสัญญาและการเปรียบเทียบสัญญาเรียงหนึ่งคอลัมน์ |
| ไม่เกิน 600px | แผนที่และปุ่มนำทางเรียงสำหรับมือถือ |
| ไม่เกิน 480px | ลด Padding และจัดฟอร์ม/ปุ่มสำหรับมือถือ |

ทุกหน้าที่เพิ่มต้องตรวจอย่างน้อยที่ความกว้างประมาณ 1440px, 768px และ 390px

Accessibility ขั้นพื้นฐาน:

- Input ทุกช่องต้องมี Label
- ปุ่มไอคอนต้องมี `aria-label`
- Modal ต้องมีชื่อที่เชื่อมกับ `aria-labelledby`
- สีไม่ควรเป็นสัญญาณเพียงอย่างเดียว ต้องมีข้อความหรือไอคอนร่วมด้วย
- ลำดับ Tab ต้องเป็นไปตามลำดับงานบนหน้าจอ
- ใช้ element ให้ตรงความหมาย เช่น `button`, `link`, `table`, `dl`, `form`
- เคารพ `prefers-reduced-motion`

## 17. การเขียนข้อความบน UI

ใช้คำที่บอกการกระทำและผลลัพธ์โดยตรง:

| หลีกเลี่ยง | ใช้ |
|---|---|
| ตกลง | บันทึกสัญญา |
| Submit | ส่งขออนุมัติ |
| Error | บันทึกไม่ได้ กรุณาตรวจข้อมูล |
| No data | ยังไม่มีสัญญาซื้อขาย |
| Click here | ดูรายละเอียด |

ข้อความ Empty และ Error ควรบอกขั้นตอนต่อไป เช่น “กดสร้างสัญญาเพื่อเริ่มรายการใหม่”

ใช้คำเรียก Role และข้อมูลให้ตรงกันทุกหน้า:

- พนักงานขาย
- ผู้จัดการ
- หัวหน้าการขนส่ง
- พนักงานขับรถ
- โรงงาน / คู่ค้า
- คำขอซื้อ
- คำขอจัดส่ง
- สัญญาซื้อขาย

## 18. โครงสร้างไฟล์สำหรับ Feature ใหม่

```text
frontend/src/
├── components/       # UI ที่ใช้ซ้ำหลายหน้า
├── context/          # State ที่ใช้ร่วมทั้งระบบ
├── hooks/            # React hooks ที่ใช้ซ้ำ
├── pages/            # หน้า Route เช่น Items.tsx, ItemForm.tsx, ItemDetail.tsx
├── services/         # API client
├── utils/            # Formatter และ business helper ที่ไม่ใช่ UI
├── App.tsx           # Routes
├── styles.css        # CSS กลาง
└── types.ts          # TypeScript types
```

สำหรับ Feature ที่มี List, Form และ Detail ให้แยกเป็นสามไฟล์ เช่น:

```text
Contracts.tsx
ContractForm.tsx
ContractDetail.tsx
```

อย่ารวมทุกหน้าไว้ในไฟล์เดียว และอย่าแยกเป็นไฟล์เล็กมากจนหาโค้ดยาก หากส่วนใดใช้เพียงหน้าเดียวและมีขนาดเล็กสามารถเก็บเป็น component ภายในไฟล์หน้านั้นได้

## 19. รูปแบบการเรียก API และ State

- ข้อมูลร่วมทั้งระบบอ่านจาก `useApp()`
- หน้ารายละเอียดหรือข้อมูลเฉพาะหน้าใช้ `useRecord<T>(path)`
- ทุก Request เรียกผ่าน `api()` ห้ามใช้ `fetch()` กระจายตามหน้า
- API path ฝั่ง frontend เริ่มด้วย `/api` อัตโนมัติจาก helper และ Vite proxy
- หลังเพิ่ม/แก้ข้อมูล ใช้ลำดับ `setBusy(true) → api() → refresh/reload → notify()`
- แปลง Error ด้วย `errorText()` ก่อนแสดงผู้ใช้
- รหัส Dynamic ใน URL ต้องใช้ `encodeURIComponent()`
- ไม่ทำ optimistic update ถ้ายังไม่มีวิธีกู้สถานะเมื่อ API ล้มเหลว
- ห้ามฝังข้อมูล Demo เป็น fallback เมื่อ API Error เพราะผู้ใช้อาจเข้าใจว่าเป็นข้อมูลจริง
- Search/Filter ที่ผู้ใช้ควรแชร์ลิงก์หรือกดย้อนกลับแล้วยังคงค่า ให้เก็บใน URL query
- State ชั่วคราวของฟอร์มหรือ Modal เก็บใน component ได้

ตัวอย่าง Mutation:

```tsx
setBusy(true)
setError('')
try {
  await api('/items', 'POST', payload)
  await refresh()
  notify('บันทึกรายการแล้ว')
  navigate('/items')
} catch (reason) {
  setError(errorText(reason))
} finally {
  setBusy(false)
}
```

## 20. ขั้นตอนทำหน้าใหม่

1. อ่าน Requirement และระบุว่า Role ใดใช้งาน
2. ตรวจ Type/API ที่มีอยู่ก่อนเพิ่มข้อมูลจำลอง
3. เลือกหน้าปัจจุบันที่มีรูปแบบใกล้ที่สุด
4. เพิ่ม Type ใน `types.ts`
5. สร้าง List/Form/Detail ตามความจำเป็น
6. เพิ่ม Route ใน `App.tsx`
7. เพิ่มเมนูตาม Role ใน `Layout.tsx`
8. ใช้ shared components และ class เดิมก่อนเพิ่ม CSS
9. รองรับ Loading, Empty, Error, Busy และ Success
10. รัน `npm run build`
11. ทดสอบหน้าจอจริงทั้ง Desktop และ Mobile
12. ทดสอบสิทธิ์ของทุก Role ที่เกี่ยวข้อง

## 21. Checklist ก่อนส่งงาน

- [ ] หน้าตาใช้สี ฟอนต์ Card และระยะห่างตรงกับระบบเดิม
- [ ] ใช้ `PageIntro`, `Status`, `ErrorBox`, `Loading` และ `Empty` ตามสถานการณ์
- [ ] Route และเมนูเพิ่มเฉพาะ Role ที่เกี่ยวข้อง
- [ ] ไม่มีปุ่มที่ Role นี้ไม่ควรใช้
- [ ] Input มี Label และ validation
- [ ] ปุ่มป้องกันการกดซ้ำระหว่างบันทึก
- [ ] API Error แสดงเป็นข้อความที่ผู้ใช้เข้าใจได้
- [ ] Table เลื่อนได้บนจอเล็ก
- [ ] หน้าจอไม่ล้นที่ 1440px, 768px และ 390px
- [ ] ใช้ Lucide icons และเก็บรูปในโฟลเดอร์ assets ที่กำหนด
- [ ] ไม่มีข้อมูล Demo ฝังไว้ในหน้า Production
- [ ] `npm run build` ผ่าน

## 22. Prompt สำหรับส่งให้ AI ทำ UI ต่อ

คัดลอกข้อความนี้ แล้วเติมรายละเอียด Feature ที่ต้องการ:

```text
พัฒนา UI Feature [ชื่อ Feature] ในโปรเจกต์ RecycleHub ด้วย React + TypeScript

ให้อ่านและทำตาม design.md ที่ root ของโปรเจกต์ รวมถึงตรวจ frontend/src/components/ui.tsx, frontend/src/styles.css และหน้าที่มีรูปแบบใกล้เคียงก่อนแก้โค้ด

ข้อกำหนด:
- รักษา Sidebar, Topbar, สีเขียว, Typography, Card, Table, Form และ Responsive ให้เหมือนระบบเดิม
- ใช้ shared components และ CSS class ที่มีอยู่ก่อนสร้างใหม่
- ใช้ไอคอนจาก lucide-react
- รองรับ Loading, Empty, Error, Busy และ Success
- ตรวจสิทธิ์ตาม Role ทั้งใน UI และ API
- เชื่อม API จริง ห้ามฝังข้อมูล Demo ในหน้า
- แยกหน้า List, Form และ Detail เมื่อเหมาะสม
- เพิ่ม Route และเมนูเฉพาะ Role ที่ใช้งาน
- รัน npm run build และตรวจหน้าจอ Desktop กับ Mobile ก่อนส่งงาน

Feature ที่ต้องทำ:
[เขียน Requirement, Role, Fields, Status และ API ที่ต้องใช้ตรงนี้]
```

หาก Requirement ใหม่ขัดกับเอกสารนี้ ให้ทีมตกลงและแก้ `design.md` ก่อน เพื่อให้หน้าที่ทำหลังจากนั้นใช้มาตรฐานเดียวกัน
