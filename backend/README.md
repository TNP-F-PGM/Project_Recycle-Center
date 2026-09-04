# T20 Backend

Go / Gin สำหรับ HTTP API และ GORM / PostgreSQL สำหรับฐานข้อมูล
ครอบคลุมรถขนส่ง คำขอซื้อ และการจัดส่ง โดยแยก Models กับ Controllers ตามส่วนงาน

## สำหรับผู้เริ่มต้น

ถ้าเครื่องนี้ตั้งค่าไว้แล้ว ให้เปิด Docker Desktop และใช้คำสั่งนี้จากโฟลเดอร์โปรเจกต์:

```powershell
docker compose up -d postgres
go -C backend run ./cmd/server
```

เปิด Terminal ค้างไว้ แล้วทดสอบใน Postman ที่ `http://localhost:8080`
คุณไม่ต้องเปิดหรือแก้ `tests/` เพื่อใช้งาน API ส่วนนี้เก็บไว้ให้ทีมตรวจว่าแก้โค้ดแล้วระบบยังทำงานถูกต้อง
สำหรับเพื่อนที่เพิ่งดึงโปรเจกต์มาใช้ ให้ทำขั้นตอนเริ่มใช้งานด้านล่างครั้งแรกก่อน

## เริ่มใช้งาน

ต้องมี Go 1.24 ขึ้นไป และ Docker Desktop ที่เปิดทำงานอยู่
ครั้งแรกที่เพื่อนดึงโปรเจกต์ ให้รันจากรากโปรเจกต์ใน PowerShell:

```powershell
docker compose up -d postgres
cd backend
Copy-Item .env.example .env
```

เปิด `backend/.env` แล้วเปลี่ยน `YOUR_PASSWORD` ให้ตรงกับ `POSTGRES_PASSWORD` ใน `docker-compose.yml`
ขั้นตอนคัดลอกและตั้งค่านี้ทำครั้งเดียว จากนั้นเปิด API:

```powershell
go run ./cmd/server
```

API เปิดที่ `http://localhost:8080` กด Ctrl+C เพื่อหยุด
โปรแกรมอัปเดตโครงสร้างฐานข้อมูลก่อนเปิด API แต่ไม่เติมข้อมูลตัวอย่างเอง
หลังแก้โค้ด ให้หยุดแล้วรันใหม่เพื่อโหลดการเปลี่ยนแปลง

หลังเปิดเครื่องใหม่ ให้เปิด Docker Desktop แล้วรันจากรากโปรเจกต์:

```powershell
docker compose up -d postgres
go -C backend run ./cmd/server
```

API และ seed อ่าน `backend/.env` อัตโนมัติ จึงไม่ต้องตั้ง `$env:DATABASE_URL` ทุกครั้ง
`.env` เก็บค่าการเชื่อมต่อ ส่วน Docker และ API ยังต้องเปิดทำงาน
ไฟล์จริงถูกละเว้นโดย Git; แชร์เฉพาะ `.env.example` ให้สมาชิกตั้งค่าของตัวเอง

### ค่าการตั้งค่า

| ตัวแปร | หน้าที่ |
|---|---|
| `DATABASE_URL` | การเชื่อมต่อ PostgreSQL สำหรับ API และ seed |
| `HTTP_ADDR` | ที่อยู่ API ค่าเริ่มต้น `127.0.0.1:8080` |
| `TEST_DATABASE_URL` | ฐานข้อมูลทดสอบ โดยตัวอย่างอ้างถึง `${DATABASE_URL}` |

ตัวอ่านไฟล์ใช้ [godotenv](https://github.com/joho/godotenv)
ค่าที่ตั้งไว้ใน environment ของ Terminal หรือระบบมีลำดับความสำคัญเหนือ `.env`
ถ้าเคยตั้งค่าใน Terminal แล้วต้องการใช้ค่าจากไฟล์ ให้เปิด Terminal ใหม่
เมื่อใช้งานบนเซิร์ฟเวอร์ สามารถกำหนด environment โดยตรงได้โดยไม่ต้องมีไฟล์ `.env`

## คำสั่งที่ใช้

รันจากโฟลเดอร์ `backend` หลังเตรียม `.env` ตามขั้นตอนด้านบน

| คำสั่ง | หน้าที่ |
|---|---|
| `go run ./cmd/server` | อัปเดตตารางและเปิด API |
| `go run ./cmd/server -migrate-only` | อัปเดตเฉพาะโครงสร้างฐานข้อมูลแล้วจบ |
| `go run ./cmd/seed` | อัปเดตตารางและเติมข้อมูลตัวอย่างแล้วจบ |
| `go test ./... -count=1` | รันชุดทดสอบ; PostgreSQL ใช้ `TEST_DATABASE_URL` จาก `.env` หรือ environment |

### ข้อมูลตัวอย่าง (seed)

เมื่อต้องการทดลองด้วย Postman ให้รันคำสั่งนี้ก่อนเปิด API:

```powershell
go run ./cmd/seed
go run ./cmd/server
```

seed ใช้ GORM และ Models ใน `internal/seed/seed.go` เติมโรงงาน วัสดุ พนักงาน และรถรหัส `DEMO-…`
รันซ้ำได้โดยข้ามรหัสที่มีอยู่ ไม่ทับข้อมูลที่แก้ไขหรือสถานะรถที่ติดงาน
การเติมข้อมูลอยู่ใน transaction เดียว หากเกิดข้อผิดพลาดจะย้อนเฉพาะการเติมในรอบนั้น
บัญชีตัวอย่างใช้ประกอบความสัมพันธ์ของข้อมูล ไม่มีรหัสเข้าสู่ระบบ

## โครงสร้าง

```text
backend/
├── cmd/
│   ├── server/main.go       # คำสั่งเปิด API
│   └── seed/main.go         # คำสั่งเติมข้อมูลตัวอย่าง
├── internal/
│   ├── config/              # อ่าน .env และเชื่อมต่อฐานข้อมูล
│   ├── models/              # ตารางและความสัมพันธ์ (GORM)
│   ├── dto/                 # รูปแบบ JSON ที่รับและส่งผ่าน API
│   ├── controllers/         # รับคำขอ ตรวจข้อมูล และบันทึกผล (Gin)
│   ├── routes/              # เชื่อม URL กับ Controller
│   ├── migrations/          # สร้าง/ปรับตารางและย้ายข้อมูลเดิม
│   ├── seed/                # ข้อมูลตัวอย่างสำหรับพัฒนา
│   └── utils/               # อ่าน JSON ตอบข้อผิดพลาด และสร้างรหัส
├── tests/
│   ├── api/                 # ทดสอบ API และ Postman workflow
│   ├── config/              # ทดสอบการอ่านค่าตั้งต้น
│   └── database/            # ทดสอบ migration และ seed
├── postman/                 # Collection สำหรับทดสอบด้วยมือ
├── docs/                    # รายละเอียด API และตัวอย่าง Body
├── .env                     # ค่าของเครื่องนี้ (ไม่ขึ้น Git)
├── .env.example             # ตัวอย่างค่าตั้งต้นสำหรับสมาชิกในทีม
├── go.mod
├── go.sum
└── README.md
```

ไฟล์ `docker-compose.yml` และ `docker/pgadmin/` อยู่ที่รากโปรเจกต์
คำว่า `models` หมายถึง Entity (Go / GORM) ตามที่อาจารย์กำหนด แต่ละตารางมีไฟล์ของตัวเอง
ไฟล์ `_test.go` ทำงานเมื่อรัน `go test` และไม่รวมอยู่ในโปรแกรม API

`dto/` แยกตามส่วนงาน เช่น `truck_dto.go`, `purchase_order_dto.go` และ `delivery_dto.go`
ชนิดที่ลงท้าย `Request` คือ JSON ที่รับเข้า ส่วน `Response` และ `ListItem` คือข้อมูลที่ส่งออก
Models ใช้กำหนดตาราง ส่วน DTO ใช้กำหนดข้อมูลที่ API อนุญาตให้รับและส่ง
`utils/` เก็บตัวช่วยทั่วไป ส่วนเงื่อนไขการซื้อและการจัดส่งอยู่ใน `controllers/`

คำสั่งเปิด API เปลี่ยนจาก `go run ./cmd` เป็น `go run ./cmd/server`
URL, JSON และ Postman Collection ใช้แบบเดิม; คำสั่ง seed ยังเป็น `go run ./cmd/seed`

## ทดสอบด้วย Postman

ใช้ Import → File แล้วเลือก Collection ที่ต้องการ ตั้ง `base_url` เป็น `http://localhost:8080`

| ส่วนงาน | Collection | คู่มือ |
|---|---|---|
| รถขนส่ง | [trucks](postman/trucks.postman_collection.json) | ตัวอย่างอยู่ใน Collection |
| คำขอซื้อและการจัดส่ง | [workflow](postman/workflow.postman_collection.json) | [ลำดับทดสอบและ API](docs/workflow.md) |

ชุด workflow ใช้ข้อมูลจาก seed ให้ส่งคำขอตามโฟลเดอร์ 1 → 4
การส่ง POST/PATCH บันทึกข้อมูลจริงในฐานข้อมูลเครื่องที่เชื่อมต่อ

## เพิ่มงานของสมาชิกในทีม

1. เพิ่ม Model ใน `internal/models/` และลงทะเบียนใน `internal/migrations/migrate.go`
2. กำหนด Request/Response ของส่วนงานใน `internal/dto/`
3. เพิ่ม Controller ของส่วนงานใน `internal/controllers/`
4. ลงทะเบียนเส้นทางใน `internal/routes/router.go`
5. เพิ่มข้อมูลตัวอย่างใน `internal/seed/seed.go` เมื่อต้องใช้ และทดสอบ API

ตัวอย่างการไล่โค้ด: `routes/router.go` → `controllers/truck_controller.go` → `dto/truck_dto.go` และ `models/truck.go`
ตัวช่วยอ่าน JSON อยู่ที่ `utils/json.go` และรูปแบบข้อผิดพลาดอยู่ที่ `utils/response.go`
ไฟล์ migrations และ router เป็นจุดที่หลายคนแก้ร่วมกัน เวลา merge ต้องรวม Models และ Routes ของทุกคน
ส่วน migration เก็บขั้นตอนย้ายข้อมูลเดิมไว้ เพื่อให้เครื่องที่มีตารางรุ่นก่อนอัปเดตต่อได้

## ทดสอบอัตโนมัติ

เปิด PostgreSQL และเตรียม `.env` ตามขั้นตอนเริ่มใช้งาน จากนั้นรันจากโฟลเดอร์ `backend`:

```powershell
go test ./... -count=1
```

ชุดทดสอบใช้ schema ชั่วคราวแยกจากตารางแอป และล้างเมื่อจบ
seed ในชุดทดสอบสร้างข้อมูลใน schema ชั่วคราวด้วย จึงไม่ต้องรันคำสั่ง seed เองก่อนทดสอบ
ชุดทดสอบ PostgreSQL อ่าน `.env` อัตโนมัติ หากไม่ต้องการรัน ให้ลบหรือคอมเมนต์บรรทัด `TEST_DATABASE_URL` และอย่าตั้งตัวแปรนี้ใน environment
เมื่อไม่มี `TEST_DATABASE_URL` การทดสอบ PostgreSQL จะถูกข้าม ส่วนการตรวจข้อมูล API ที่ไม่ใช้ฐานข้อมูลยังทำงาน
