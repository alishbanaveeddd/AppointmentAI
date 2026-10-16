# AppointmentAI — Intelligent AI-Powered Appointment Scheduling Platform

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Express 5](https://img.shields.io/badge/Express-5.0-blue?style=flat&logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.0-teal?style=flat&logo=prisma)](https://www.prisma.io/)
[![Groq LLaMA](https://img.shields.io/badge/Groq-AI%20Inference-orange?style=flat&logo=openai)](https://groq.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tests-189%20Passed-brightgreen?style=flat&logo=vitest)](https://vitest.dev/)

An enterprise-grade, full-stack appointment scheduling system built for SaaS clinical operations. Features conversational AI scheduling powered by **Groq LLaMA / OpenAI OSS models**, strict multi-turn conversational context retention, mathematical double-booking prevention via **PostgreSQL exclusion constraints**, and a doctor directory with live 30-minute booking slots.

---

## ⚡ Quick Demo Access (For Evaluators)

A deterministic demo reviewer account has been pre-seeded into the database:

| Credential | Value |
|---|---|
| **URL** | `http://localhost:3000/login` |
| **Email** | `demo@example.com` |
| **Password** | `Demo@12345` |
| **Instant Access** | Click the **⚡ Auto-Fill Demo** button on the login screen to sign in with one click |

---

## 🌟 Key Capabilities & System Features

### 1. Conversational AI Scheduling Assistant
- Natural language slot extraction powered by the **Groq API** (`openai/gpt-oss-120b`).
- **Dynamic Calendar Awareness**: Injects live regional timestamps (`Asia/Karachi`, UTC+5) and resolves relative expressions (*"tomorrow afternoon"*, *"next Monday at 10am"*, *"Friday 2pm"*).
- **Multi-Turn Context Accumulation**: Retains previously stated services across conversational turns (e.g. Turn 1: *"I want a dental checkup"*, Turn 2: *"Let's do Monday at 10am"* without re-prompting for service).
- **Graceful Fallbacks**: If the AI extraction is ambiguous, a clean interactive booking form appears automatically in chat.

### 2. Clinical Specialist & Doctor Directory
- **Department Filters**: Dental Clinic, Cardiology, General Medicine, and Pediatrics.
- **Doctor Profiles**: Detailed cards with doctor ratings, clinical experience, consultation fees, and operational hours.
- **Live 30-min Open Slots**: Evaluators can click any open slot (e.g., `11:00 AM` on Dr. Ahmed Malik) to instantly launch the AI assistant with a pre-filled prompt and doctor consultation banner.

### 3. Rock-Solid Booking Architecture & Double-Booking Shield
- **AI is strictly an untrusted extraction agent**: The AI **never writes directly to the database**.
- **Transient Proposal Lifecycle**: Extracted parameters generate a 15-minute transient `BookingProposal`. The user must review and explicitly confirm or edit before reservation.
- **Physical Exclusion Constraints**: Concurrency double-bookings are prevented at the database engine level using PostgreSQL `btree_gist` exclusion constraints (`tstzrange` with overlapping prevention).

### 4. Appointment Management & Policy Enforcement
- **Business Hours Window**: Enforces Monday–Friday, 9:00 AM – 5:00 PM (`Asia/Karachi`, UTC+5) in 30-minute fixed intervals.
- **2-Hour Cancellation Cutoff**: Appointments cannot be cancelled within 2 hours of scheduled start time.
- **Filtering & Audit Trails**: Real-time status filtering (Upcoming Confirmed, Past Completed, Cancelled).

---

## 🏗️ System Architecture & Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Patient / User
    participant Web as Next.js 15 Web App
    participant API as Express 5 Backend
    participant Groq as Groq AI Engine (LLaMA/OSS)
    participant DB as PostgreSQL (Prisma + btree_gist)

    User->>Web: "Book a Dental checkup with Dr. Ahmed Malik tomorrow at 11am"
    Web->>API: POST /api/chat/sessions/:id/messages
    API->>Groq: Structured JSON Extraction with Dynamic Calendar Context
    Groq-->>API: Extracted { service, date, time }
    API->>API: Validate Business Rules (Mon-Fri 9-5 PKT, 30-min slot, not in past)
    API->>DB: Check availability & create transient BookingProposal (15-min TTL)
    API-->>Web: Assistant Message + Interactive Proposal Card
    User->>Web: Clicks "Confirm & Reserve Booking"
    Web->>API: POST /api/appointments/confirm { proposalId }
    API->>DB: Execute Transaction (Exclusion Constraint Enforced)
    DB-->>API: Persisted Confirmed Appointment
    API-->>Web: 201 Created + Confirmation Banner
```

---

## 🛠️ Tech Stack & Decisions

| Layer | Technology | Rationale & Architectural Choice |
|---|---|---|
| **Frontend** | **Next.js 15 (App Router), React 19, Tailwind CSS 4, TypeScript** | Zero-latency server components, modern glassmorphic design system, strict type safety, responsive layout. |
| **Backend** | **Express 5, Node.js v24, TypeScript Strict** | Native async error handling in Express 5, clean service-oriented architecture, modular route handlers. |
| **Database** | **PostgreSQL + Prisma ORM** | ACID transactions, versioned migrations, and `btree_gist` physical exclusion constraints. |
| **AI Provider** | **Groq Cloud API** (`openai/gpt-oss-120b`) | Ultra-fast inference (<500ms), native JSON structured output schema, isolated behind provider adapter interface. |
| **Security** | **JWT in HttpOnly SameSite=Strict cookies, bcrypt (cost 12), rate limiting, helmet** | Immune to XSS token theft, CSRF-resistant, strict request ID tracing. |
| **Testing** | **Vitest 5, Supertest 7 (189 tests passing)** | Fast unit, integration, and database concurrency regression test suite. |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 20.x (tested on v24.14.0)
- **npm** >= 10.x
- **PostgreSQL** >= 14 (with `btree_gist` extension enabled)

### 1. Clone the Repository
```bash
git clone https://github.com/alishbanaveeddd/AppointmentAI.git
cd AppointmentAI
```

### 2. Environment Configuration
Copy the provided environment example files:
```bash
# Root environment
cp .env.example .env

# Web environment
cp web/.env.example web/.env.local
```

Update `.env` with your PostgreSQL database URL and Groq API key:
```env
NODE_ENV=development
PORT=8000
DATABASE_URL="postgresql://postgres:password@localhost:5432/appointment_ai?schema=public"
JWT_SECRET="your-super-secret-jwt-signing-key-min-32-chars-long"
FRONTEND_URL="http://localhost:3000"
GROQ_API_KEY="gsk_your_groq_api_key_here"
```

### 3. Install Dependencies & Setup Database
```bash
# Install workspace dependencies
npm install

# Run database migrations
npm run prisma:migrate --workspace=api

# Seed deterministic demo account and doctor appointments
npm run seed --workspace=api
```

### 4. Run the Application
In two separate terminals:

```bash
# Terminal 1: Run Express 5 API (Port 8000)
npm run dev:api

# Terminal 2: Run Next.js 15 Frontend (Port 3000)
npm run dev:web
```

Visit **`http://localhost:3000`** in your browser.

---

## 🧪 Testing & Verification

The test suite contains **189 comprehensive automated tests** across 10 test files covering authentication, appointment validation, business hour policies, exclusion constraints, and AI extraction:

```bash
# Run all automated tests
npm run test

# Run full TypeScript typecheck
npm run typecheck

# Run production build
npm run build
```

---

## 📁 Repository Structure

```
AppointmentAI/
├── api/                       # Express 5 backend
│   ├── prisma/                # Prisma schema, migrations, seed script
│   │   ├── migrations/        # PostgreSQL migrations (including btree_gist)
│   │   └── schema.prisma      # Authoritative database model
│   ├── src/
│   │   ├── config/            # Environment & business policy config
│   │   ├── middleware/        # Auth, rate-limiter, CORS, error handler
│   │   ├── routes/            # Auth, appointments, chat endpoints
│   │   ├── schemas/           # Zod validation schemas
│   │   └── services/          # Business logic, Groq adapter, appointment service
│   └── test/                  # 189 Vitest unit and integration tests
├── web/                       # Next.js 15 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/     # Overview, chat assistant, appointments, doctors
│   │   │   ├── login/         # Sign in page with 1-click demo button
│   │   │   ├── signup/        # Patient registration page
│   │   │   └── globals.css    # Modern glassmorphic theme & typography
│   │   ├── components/        # Reusable UI cards, proposal modal, chat bubbles
│   │   └── lib/               # API client, auth context, doctor directory
├── database/
│   └── schema.sql             # Pure SQL DDL reference with indexes & constraints
└── docs/                      # Architectural documentation
    ├── ARCHITECTURE.md        # Deep dive into system architecture
    ├── DATABASE_DESIGN.md     # Relational schema & indexing strategy
    ├── AI_WORKFLOW.md         # Groq LLM extraction & fallback protocol
    ├── API_CONTRACT.md        # Comprehensive REST API specifications
    ├── SECURITY.md            # Authentication, rate limiting, and RBAC
    └── DECISION_LOG.md        # Architectural Decision Records (ADRs)
```

---

## 📄 Documentation Directory

For detailed engineering analysis and review, explore the documentation suite in `/docs`:
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Architectural diagrams, service boundaries, and request lifecycle.
- [`DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) — DDL, exclusion constraints, indexing, and multi-tenancy.
- [`AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) — LLM prompt design, JSON schema extraction, and fallback strategies.
- [`API_CONTRACT.md`](docs/API_CONTRACT.md) — REST endpoints, request/response formats, and status codes.
- [`SECURITY.md`](docs/SECURITY.md) — Cookie specifications, rate limits, and authentication protocols.

---

## 👥 Authors & Assessment Information
- **Applicant**: Senior Full Stack Developer Candidate
- **Project**: AI-Assisted Appointment Scheduling Platform
- **License**: MIT
