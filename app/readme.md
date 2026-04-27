# 🚀 Artemis Mission Control — Backend API

FastAPI backend for the Artemis Mission Control & Trajectory Analytics System.

---

## Architecture

```
app/
├── main.py                    ← FastAPI app, CORS, lifespan
├── core/
│   ├── config.py              ← MissionConfig dataclasses + Settings
│   └── database.py            ← SQLAlchemy engine, session factory
├── models/
│   ├── mission.py             ← Mission ORM model
│   └── trajectory.py          ← TrajectoryPoint ORM model
├── schemas/
│   └── trajectory.py          ← Pydantic I/O schemas
├── api/routes/
│   ├── upload.py              ← POST /api/v1/upload
│   ├── trajectory.py          ← GET  /api/v1/trajectory/{id}
│   ├── analytics.py           ← GET  /api/v1/analytics/{id}
│   └── vision.py              ← POST /api/v1/vision/detect-craters
├── services/
│   ├── trajectory_service.py  ← Ingest orchestration
│   ├── analytics_service.py   ← Analytics recomputation
│   └── vision_service.py      ← OpenCV crater detection
├── strategies/
│   ├── __init__.py            ← Strategy factory (get_strategy)
│   ├── base_strategy.py       ← Abstract pipeline interface
│   ├── moon_strategy.py       ← Earth→Moon pipeline
│   └── satellite_strategy.py  ← Earth-orbit pipeline
├── utils/
│   └── data_processing.py     ← CSV parsing, column aliasing
└── db/
    └── crud.py                ← DB read/write helpers
```

---

## Quick Start

```bash
# 1. Clone and enter
git clone <repo> && cd artemis-backend

# 2. Create virtual environment
python -m venv .venv && source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 5. Run
uvicorn app.main:app --reload
```

Interactive docs → http://localhost:8000/docs

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/upload` | Upload CSV + mission_type |
| GET | `/api/v1/trajectory/{id}` | Trajectory data for 3D rendering |
| GET | `/api/v1/analytics/{id}` | Mission KPIs for dashboard |
| POST | `/api/v1/vision/detect-craters` | Crater detection on lunar image |
| GET | `/health` | DB connectivity health check |

### Upload request (multipart/form-data)
| Field | Type | Required |
|-------|------|----------|
| `file` | CSV | ✅ |
| `mission_type` | `moon` \| `satellite` | ✅ |
| `mission_name` | string | optional |

### Trajectory response
```json
{
  "mission_id": 1,
  "mission_type": "moon",
  "time": [0.0, 1.0, ...],
  "positions": [{"x": 0, "y": 0, "z": 0}, ...],
  "speed": [7.8, 7.9, ...],
  "events": [false, true, ...],
  "mission_phase": ["launch", "cruise", ...]
}
```

---

## Mission Types

### Moon (`mission_type=moon`)
- Tracks Earth + Moon + Spacecraft bodies
- Uses `distance_from_moon` for closest approach
- Analytics: total distance, max speed, Moon approach

### Satellite (`mission_type=satellite`)
- Tracks Earth + Satellite only
- Ignores Moon data
- Analytics: altitude profile, orbital period (Kepler fallback), velocity stability

---

## CSV Schema

```
time, body, x, y, z, vx, vy, vz, ax, ay, az,
distance_from_earth, distance_from_moon, speed,
mission_phase, event_flag
```

Columns are auto-aliased (e.g. `timestamp` → `time`, `pos_x` → `x`).
Missing optional columns are filled with `null`.

---

## Design Principles

- **Config-driven** — `MissionConfig` drives all branch behaviour; no scattered `if mission_type ==` checks
- **Strategy Pattern** — `BaseStrategy` → `MoonStrategy` / `SatelliteStrategy`; new mission types = new strategy file only
- **Clean layers** — Routes contain zero business logic; all logic lives in Services + Strategies
- **Dependency injection** — DB session injected via FastAPI `Depends(get_db)`