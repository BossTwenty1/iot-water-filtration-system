# Development

This document defines the development workflow for the IoT Embedded Water
Filtration System.

---

## 1. Team

Nash:
- Project Lead
- Frontend
- Integration
- Cross-component assistance

Alejandro:
- Backend
- Database
- API

Edgar:
- ESP32
- Firmware
- Hardware Integration

---

## 2. Repository Areas

```text
frontend/        React frontend
backend/         Node.js + Express backend
firmware/esp32/  ESP32 firmware
simulator/       synthetic device simulator
database/        migrations/schema artifacts
docs/            shared documentation
```

## 3. Frontend

The frontend uses React, TypeScript, Vite, Tailwind CSS, React Router, Recharts,
and Lucide icons. Pages consume typed domain services, which currently use local
development adapters and are prepared for the planned Express REST API. The
frontend does not connect directly to Supabase or control hardware.

```powershell
cd frontend
npm install
npm run dev
```

Before review, run:

```powershell
npm run build
npm run lint
```

`VITE_API_BASE_URL` is the public frontend environment variable for the Express
API base URL. Copy `frontend/.env.example` to a local `.env` when an approved API
is available. Do not place secrets, service-role credentials, or device
credentials in the frontend environment.
