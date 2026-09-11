# คู่มือติดตั้งและเปิดระบบ Octavia

คู่มือนี้ใช้สำหรับเปิดโปรเจกต์บน Windows PowerShell หลัง clone repository ใหม่ ลำดับที่ถูกต้องคือ Docker Desktop → PostgreSQL → Backend → Frontend

## โปรแกรมที่ต้องติดตั้ง

เวอร์ชันที่ใช้ทดสอบ:

| โปรแกรม | เวอร์ชัน |
|---|---|
| Go | `1.26.4` |
| Node.js | `24.15.0` |
| npm | `11.12.1` |
| Docker Desktop/Engine | `29.4.1` |
| Docker Compose | `v5.1.3` |
| Git | เวอร์ชันปัจจุบันที่รองรับ GitHub HTTPS |

Docker Compose v2 ขึ้นไปใช้ได้ โดยใช้คำสั่ง `docker compose` ไม่ใช่ `docker-compose`

## Libraries ที่ระบบใช้

Backend ใช้ Fiber, GORM, PostgreSQL driver/pgx, godotenv, Google UUID และ bcrypt จาก `golang.org/x/crypto`

Frontend ใช้ React, React DOM, React Router, Material UI, MUI Icons, Emotion, Axios, Day.js, Swiper และ `@zxing/browser` สำหรับ QR fallback ส่วนเครื่องมือพัฒนาและทดสอบคือ TypeScript, Vite, Vitest, Testing Library, jsdom และ Oxlint

ไม่ต้องติดตั้ง library ทีละตัว:

```powershell
cd frontend
npm ci
```

Backend ดาวน์โหลด dependencies ด้วย:

```powershell
cd backend
go mod download
```

## เตรียม Environment

จาก root ของ repository:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

ค่าหลักใน `backend/.env`:

```env
DB_HOST=localhost
DB_USER=admin_T01SA
DB_PASSWORD=T01SA
DB_NAME=backend_T01
DB_PORT=5432
DB_SSLMODE=disable
PORT=8080
APP_BASE_URL=http://localhost:5173
```

SMTP ต้องอยู่ใน `backend/.env` เท่านั้น ปล่อย `SMTP_HOST` ว่างได้เพื่อให้ระบบ log email ลง console ห้ามใส่ SMTP password ใน Frontend

ค่าหลักใน `frontend/.env`:

```env
VITE_API_URL=http://localhost:8080/api
VITE_API_BASE_URL=http://localhost:8080/api
VITE_API_PROXY_TARGET=http://127.0.0.1:8080
```

ถ้าต้องการใช้ Vite proxy ให้ตั้ง `VITE_API_URL=/api` และ `VITE_API_BASE_URL=/api`

## เปิด PostgreSQL และ pgAdmin

```powershell
cd backend
docker compose up -d postgres
docker compose ps
```

เปิด pgAdmin เพิ่ม:

```powershell
docker compose up -d postgres pgadmin
```

| รายการ | ค่า |
|---|---|
| PostgreSQL host จากเครื่อง | `localhost` |
| PostgreSQL port | `5432` |
| Database | `backend_T01` |
| Username | `admin_T01SA` |
| Password | `T01SA` |
| pgAdmin URL | `http://localhost:8081` |
| pgAdmin email | `T01SA@example.com` |
| pgAdmin password | `T01SA` |
| pgAdmin host สำหรับเชื่อม container | `postgres` |

ตรวจ log และหยุด container โดยเก็บข้อมูล:

```powershell
docker compose logs -f postgres
docker compose down
```

> `docker compose down -v` จะลบ PostgreSQL และ pgAdmin volumes รวมถึงข้อมูลเดิมทั้งหมด ห้ามใช้หากยังไม่ได้สำรองข้อมูล

## เปิด Backend

Terminal ที่ 1:

```powershell
cd backend
go mod download
go run ./cmd/server
```

ครั้งแรก Backend จะ AutoMigrate, สร้าง Concert เริ่มต้น, seed รูปจาก `frontend/src/assets/poster` เป็น binary ลง `concerts.poster` และ `concerts.concert_poster`, seed บัญชี Demo แล้วเปิด API ที่ `http://localhost:8080`

ตรวจ Backend และ Poster API:

```powershell
Invoke-RestMethod http://localhost:8080/
Invoke-WebRequest http://localhost:8080/api/concerts/CC0001/poster -OutFile poster-check.png
```

## เปิด Frontend

Terminal ที่ 2:

```powershell
cd frontend
npm ci
npm run dev
```

เปิด `http://localhost:5173` แล้วตรวจรูปจากฐานข้อมูลที่:

- `http://localhost:5173/dashboard`
- `http://localhost:5173/search-concert`
- `http://localhost:5173/event-registration`

## บัญชี Demo และลำดับเปิดระบบ

1. Docker Desktop
2. PostgreSQL container
3. Backend
4. Frontend

```text
รหัสพนักงาน: OCT-EMP-001
รหัสผ่าน: Octavia@2026
```

บัญชีเพิ่มเติมดูที่ `test.md`

## คำสั่งทดสอบ

Backend:

```powershell
cd backend
go test ./...
go vet ./...
```

Frontend:

```powershell
cd frontend
npm test -- --run --maxWorkers=1
npm run lint
npm run build
```

## Troubleshooting

- Docker ยังไม่เปิด: เปิด Docker Desktop และรอ Engine พร้อมก่อนสั่ง `docker compose up`
- ตรวจ container: รัน `docker compose ps` ใน `backend`
- พอร์ต `5432`, `8080` หรือ `5173` ชน: ตรวจด้วย `Get-NetTCPConnection -LocalPort 8080 -State Listen` และ `Get-Process -Id <PID>` แล้วหยุดเฉพาะ process ที่ตรวจแล้วว่าไม่ใช่งานอื่น
- `failed to listen`: มี process ใช้พอร์ตนั้นอยู่ ให้เปลี่ยน `PORT` หรือหยุด process เดิม
- `connection refused`: ตรวจ PostgreSQL, Backend และ URL ใน `.env` ตามลำดับ
- ไม่พบ `.env`: สร้างจาก `.env.example` ด้วย `Copy-Item` ตามหัวข้อ Environment
- รูปไม่แสดง: ดู log Backend ว่า Poster Seeder สำเร็จ แล้วเปิด Poster API โดยตรง
- asset หาย: ตรวจ `frontend/src/assets/poster/pulse.png`, `flux.png`, `celestial.png`, `starlight.png`; Backend จะหยุดพร้อมแจ้งชื่อไฟล์ที่ขาด
- Browser cache รูปเก่า: hard refresh ด้วย `Ctrl+F5`; URL รูปมี version จาก `updated_at`
- Git command ผิดโฟลเดอร์: รัน `git status` จาก root ที่มี `.git` ก่อน pull, commit หรือ push
- PostgreSQL port ชน: หยุด service เดิม หรือเปลี่ยน port mapping ใน `backend/compose.yml` และแก้ `DB_PORT` ให้ตรงกัน

