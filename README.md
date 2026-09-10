# RecycleHub

ระบบศูนย์รีไซเคิลสำหรับจัดการคู่ค้า วัสดุ คลัง การซื้อขาย และการขนส่ง

- Backend: Go, Gin, GORM และ PostgreSQL
- Frontend: React, TypeScript และ Vite
- Database tools: Docker Compose และ pgAdmin

## โครงสร้างโปรเจกต์

```text
T20_1/
├── backend/                 # API, Models, migrations, seed และ tests
├── frontend/                # หน้าเว็บ React และ tests
├── docker/pgadmin/          # ค่าตั้งต้นสำหรับ pgAdmin
├── docker-compose.yml       # เปิด PostgreSQL และ pgAdmin
├── design.md                # แนวทางสี รูปแบบ และส่วนประกอบ UI
├── B6707842.md              # ข้อมูลผู้จัดทำและส่วนงานที่รับผิดชอบ
└── README.md                # คู่มือเริ่มต้นของโปรเจกต์
```

รายละเอียดแต่ละส่วนอยู่ที่ [backend/README.md](backend/README.md),
[frontend/README.md](frontend/README.md) และ [design.md](design.md)

## เตรียมเครื่องครั้งแรก

ต้องติดตั้ง Docker Desktop, Go 1.24 ขึ้นไป และ Node.js 22.12 ขึ้นไป
เปิด PowerShell ที่รากโปรเจกต์แล้วรัน:

```powershell
docker compose up -d
Copy-Item backend/.env.example backend/.env
npm --prefix frontend install
```

เปิด `backend/.env` แล้วกำหนดรหัสผ่านฐานข้อมูลให้ตรงกับ
`POSTGRES_PASSWORD` ใน `docker-compose.yml` ค่าเริ่มต้นของชุดพัฒนานี้คือ `postgres`

### ใช้ฐานข้อมูลกลางร่วมกัน

ถ้าทีมมี PostgreSQL กลางอยู่แล้ว ไม่ต้องเปิด service `postgres` ใน Docker ของแต่ละเครื่อง
ให้สมาชิกทุกคนคัดลอก `.env.example` เป็น `.env` แล้วใส่ `DATABASE_URL`
ของฐานข้อมูลกลางที่ได้รับทางส่วนตัว:

```dotenv
DATABASE_URL="host=DB_HOST user=DB_USER password=DB_PASSWORD dbname=recycle_system port=5432 sslmode=require TimeZone=Asia/Bangkok"
```

`localhost` ใช้ได้เฉพาะฐานข้อมูลในเครื่องของคนนั้น จึงใช้เป็นฐานกลางของทีมไม่ได้
ห้ามใส่ URL, รหัสผ่าน หรือข้อมูลจริงลงใน `.env.example`, README, issue หรือ source code
ไฟล์ `.env` จริงถูกกันด้วย `.gitignore` และต้องส่งค่าการเชื่อมต่อให้สมาชิกผ่านช่องทางส่วนตัว

ควรใช้ฐานข้อมูลนี้เป็นฐานสำหรับพัฒนาของทีม และให้สมาชิกหนึ่งคนรับผิดชอบนำ migration
ของแต่ละรอบเข้า branch กลางก่อนที่ทุกคนจะเปิด Backend รุ่นใหม่ เพื่อลดปัญหาตารางเปลี่ยนพร้อมกัน
การทดสอบฐานข้อมูลควรใช้ฐานทดสอบแยกต่างหาก ถ้ายังไม่มีให้ปล่อย `TEST_DATABASE_URL`
ใน `.env` เป็น comment เพื่อให้ชุดทดสอบฐานข้อมูลถูกข้าม

ถ้าต้องการข้อมูลสำหรับทดลอง ให้รันหนึ่งครั้ง:

```powershell
go -C backend run ./cmd/seed
```

## เปิดระบบ

เปิดสอง Terminal ที่รากโปรเจกต์

Terminal แรก เปิดฐานข้อมูลและ API:

```powershell
docker compose up -d postgres
go -C backend run ./cmd/server
```

Terminal ที่สอง เปิดหน้าเว็บ:

```powershell
npm --prefix frontend run dev
```

- หน้าเว็บ: http://localhost:5173
- API: http://localhost:8080
- pgAdmin: http://localhost:5050

กด `Ctrl+C` ในแต่ละ Terminal เพื่อหยุด API และหน้าเว็บ เมื่อต้องการหยุด container ด้วยให้รัน:

```powershell
docker compose down
```

## ตรวจงานก่อน merge

```powershell
go -C backend test ./... -count=1
npm --prefix frontend test
npm --prefix frontend run build
```

โฟลเดอร์ `tests/`, `internal/migrations/`, `postman/` และไฟล์ `.env.example`
เป็นส่วนที่ทีมต้องใช้ต่อ จึงควรเก็บใน Git ส่วน `.env`, `bin/`, `node_modules/`,
`dist/`, `uploads/` และไฟล์ log เป็นข้อมูลของแต่ละเครื่องหรือไฟล์ที่สร้างใหม่ได้
และถูกละเว้นด้วย `.gitignore`
