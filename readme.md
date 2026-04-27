# 🚀 Artemis Mission Control Dashboard

A full-stack mission analytics and visualization platform supporting:

- 🌕 **Moon missions** (Earth → Moon trajectory)
- 🛰️ **Satellite missions** (Earth orbit)

**Features:**
- CSV upload pipeline
- Trajectory analytics
- Interactive dashboard
- 3D trajectory visualization (React + Three.js)

---

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

---

## 📁 Project Structure

```text
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
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── upload.py
│   │   │       ├── trajectory.py
│   │   │       ├── analytics.py
│   │   │       └── vision.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   │
│   │   ├── db/
│   │   │   └── crud.py
│   │   │
│   │   ├── models/
│   │   │   ├── mission.py
│   │   │   └── trajectory.py
│   │   │
│   │   ├── schemas/
│   │   │   └── trajectory.py
│   │   │
│   │   ├── services/
│   │   │   ├── trajectory_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── vision_service.py
│   │   │
│   │   ├── strategies/
│   │   │   ├── base_strategy.py
│   │   │   ├── moon_strategy.py
│   │   │   └── satellite_strategy.py
│   │   │
│   │   └── utils/
│   │       └── data_processing.py
│   │
│   └── main.py
│
└── README.md
```

---

## 💻 Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

> **Note:** The app runs at `http://localhost:8080`

---

## ⚙️ Backend Setup

### 1. Create Virtual Environment

```bash
conda create -n artemis_backend python=3.11
conda activate artemis_backend
```

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Select Interpreter (VS Code Users)

> If you are using VS Code, this step is crucial to avoid "module not found" errors:
> 1. Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on Mac)
> 2. Search and select: **Python: Select Interpreter**
> 3. Choose: **artemis_backend (Python 3.11)**

---

## 🛢️ Database & Environment Setup

### 1. MySQL Database Setup

Open MySQL on your machine and create the database:

```sql
CREATE DATABASE artemis_db;
```

### 2. Environment Variables

Create a `.env` file inside the `backend/` folder (`backend/.env`) and add:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=artemis_db
```

> ⚠️ **Important:** Ensure MySQL is running locally and replace `DB_PASSWORD` with your actual MySQL password.

### 3. Initialize Tables & Run Backend

Make sure your Conda environment is active, then start the server:

```bash
uvicorn app.main:app --reload
```

> **Note:** The backend will run at `http://127.0.0.1:8000`
>
> Starting the server for the first time will automatically initialize your database tables.

---

## 🔌 API Endpoints

| Method | Endpoint |
|--------|----------|
| `POST` | `/api/v1/upload` |
| `GET` | `/api/v1/trajectory/{mission_id}` |
| `GET` | `/api/v1/trajectory/full/{mission_id}` |
| `GET` | `/api/v1/analytics/{mission_id}` |

---

## 📊 Usage

1. Start both the backend and frontend servers
2. Open the UI and upload your trajectory CSV
3. Select the mission type (`moon` / `satellite`)
4. View dashboard analytics
5. Explore the interactive 3D trajectory

---

## 📁 CSV Data Format

Your CSV must include the following columns:

| Column | Required |
|--------|----------|
| `time` | ✅ |
| `body` (spacecraft / moon / earth) | ✅ |
| `x`, `y`, `z` | ✅ |
| `vx`, `vy`, `vz` | ✅ |
| `ax`, `ay`, `az` | ✅ |
| `distance_from_earth` | ✅ |
| `distance_from_moon` | ⚠️ Optional for satellite missions |
| `speed` | ✅ |
| `mission_phase` | ✅ |
| `event_flag` | ✅ |

---

## ⚠️ Notes & Gotchas

- **Run Order:** The backend must be running before you interact with the frontend.
- **Data Integrity:** Satellite missions do not include Moon data. Ensure your CSV strictly follows the required schema to avoid pipeline errors.
- **Environment:** Always ensure your Conda environment (`artemis_backend`) is activated before starting the backend server or running any scripts.