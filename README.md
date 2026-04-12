# Dashmaxxing 🚀

Dashmaxxing is an AI-powered dashboard platform built for the modern team. It empowers non-technical stakeholders to build, edit, and interact with data dashboards securely using AI without relying on a dedicated Data Analyst bottleneck.

## Features (Phase MVP)
- **Decoupled Architecture:** Built on a Next.js (React) unified Frontend and a FastAPI (Python) backend.
- **Glassmorphism Design System:** A highly aesthetic, custom-engineered dark mode natively decoupled from standard design libraries.
- **Secure by Default:** Raw data never rests on Dashmaxxing servers. All connection credentials are encrypted using Google Cloud KMS.
- **AI-Powered:** Ask questions in natural language and have the underlying charts automatically pivot, filter, and adapt.
- **Google Sheets native:** Pulls natively and directly from your connected team spreadsheets.

## Environment Setup

### 1. Prerequisites
- Node.js (v20+)
- Python (3.10+)
- Docker & Docker Compose
- Google Cloud Service Account with KMS permissions

### 2. Bootstrapping
You will need two separate terminal windows for the decoupled apps, alongside Docker running locally.

**Database (Postgres & Redis):**
```bash
docker compose up -d
```

**FastAPI Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt # (Ensure dependencies match Phase 1 build)
uvicorn main:app --reload
```

**Next.js Frontend:**
Create `frontend/.env.local` containing your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Then run:
```bash
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:3000/login` to access the application.

## Development Workflow
If modifying Python database models, always generate Alembic revisions:
```bash
alembic revision --autogenerate -m "description details"
alembic upgrade head
```
