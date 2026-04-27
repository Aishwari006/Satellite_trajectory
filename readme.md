# 🚀 Artemis Mission Control Dashboard

A full-stack mission analytics and visualization platform supporting:

- 🌕 Moon missions (Earth → Moon trajectory)
- 🛰️ Satellite missions (Earth orbit)

Features:
- CSV upload pipeline
- Trajectory analytics
- Interactive dashboard
- 3D trajectory visualization (React + Three.js)

## 🏗️ Tech Stack

### Frontend
- React + Vite
- TypeScript
- Three.js (3D visualization)
- Tailwind CSS

### Backend
- FastAPI
- SQLAlchemy
- MySQL
- Pandas (data processing)

## 📁 Project Structure
artemis-project/
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── ...
│
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── strategies/
│   │   └── utils/
│   │
│   └── main.py
│
└── README.md
## ⚙️ Frontend Setup

```bash
cd frontend
npm install
npm run dev
App runs at:
http://localhost:8080


---

## ⚙️ 5. BACKEND SETUP

This is where most people mess up — be very clear.

---

### 🧩 5.1 Create Virtual Environment


Follow these steps to set up the backend using Conda:

### 1. Create Conda Environment

```bash
conda create -n artemis_backend python=3.11
conda activate artemis_backend

Install Dependencies

Navigate to backend folder:

cd backend

Then install requirements:

pip install -r requirements.txt

4. Select Interpreter (IMPORTANT)

If using VS Code:

Press Ctrl + Shift + P
Search: Python: Select Interpreter
Choose:
artemis_backend (Python 3.11)
5. Run Backend Server
uvicorn app.main:app --reload

Backend will run at:

http://127.0.0.1:8000


Important Notes
Always ensure the Conda environment is activated before running the backend
If modules are not found → check interpreter selection in VS Code
Database must be created before running the server


---

### 🛢️ 5.3 MySQL Database Setup

```md
### Database Setup (MySQL)

1. Open MySQL

2. Create database:

```sql
CREATE DATABASE artemis_db;

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=artemis_db

Environment Variables Setup
## 🔐 Environment Variables Setup

Before running the backend, create a `.env` file inside the **backend folder**.

### 📁 Path:

backend/.env


---

### ✍️ Add the following variables:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=fhefhferfg
DB_NAME=artemis_db
⚠️ Important Notes
Ensure MySQL is running locally
Replace DB_PASSWORD with your actual MySQL password if different
---

### 🏗️ 5.4 Initialize Tables

```md
### Initialize Database Tables

Run backend once:

```bash
uvicorn app.main:app --reload


---

### ▶️ 5.5 Run Backend

```md
### Run Backend

```bash
uvicorn app.main:app --reload

---

## 🔌 6. API ENDPOINTS

```md
## 🔌 API Endpoints

- POST /api/v1/upload
- GET /api/v1/trajectory/{mission_id}
- GET /api/v1/trajectory/full/{mission_id}
- GET /api/v1/analytics/{mission_id}
📊 7. HOW TO USE
## 📊 Usage

1. Upload CSV via UI
2. Select mission (moon/satellite)
3. View dashboard analytics
4. Explore 3D trajectory
📁 8. DATA FORMAT

Very important for your teammates.

## 📁 CSV Format

Required columns:

- time
- body (spacecraft/moon/earth)
- x, y, z
- vx, vy, vz
- ax, ay, az
- distance_from_earth
- distance_from_moon (optional for satellite)
- speed
- mission_phase
- event_flag
⚠️ 9. NOTES / GOTCHAS
## ⚠️ Notes

- Satellite missions do not include Moon data
- Ensure CSV format is correct
- Backend must be running before frontend