# Climate Copilot — Backend Engine (Geospatial & Multimodal AI)

This backend module powers the deterministic Earth Observation, GIS spatial joins, and multimodal reasoning layers of **Climate Copilot** for the **AI Builder Cup 2026**.

Developed by **Kavindu** (Geospatial Telemetry Engine & Multimodal AI Analyst), this service computes satellite flood damage metrics, extracts critical infrastructure chokepoints, and feeds the Google ADK multi-agent orchestrator maintained by Gihara.

---

## Architecture & Data Flow

```
   ┌──────────────────────────────────────────────────────────────┐
   │ Google Earth Engine (ee_flood.py & ee_metrics.py)             │
   │  • Sentinel-1 SAR GRD VV (Change Detection: Δ < -3 dB)       │
   │  • JRC Global Surface Water (Permanent Water Filter < 80%)   │
   │  • SRTM Digital Elevation Model (Slope Filter < 5°)          │
   │  • CHIRPS Daily Rainfall (72h cumulative + anomaly %)        │
   │  • WorldPop 100m (Exposed Population count)                  │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ BigQuery GIS / Local GIS Engine (bq_spatial.py)              │
   │  • ST_Intersects: Submerged road network (e.g. AB10 highway) │
   │  • ST_DWithin / ST_Distance: Facility perimeter threat (CEB)  │
   │  • Hospital route severance analysis (Biyagama Hospital)    │
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
                      Contract 1: TelemetryPayload
                      (backend/ai/schemas.py)
                                  │
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ Multimodal Vision & Risk Analyst (multimodal_analyst.py)     │
   │  • Model: Vertex AI Gemini 2.5 Flash / Pro                   │
   │  • Visual Inputs: Before/After Sentinel-1 SAR PNGs           │
   │  • Telemetry Input: Deterministic GIS metrics                │
   │  • Grounding Rule: Mandatory metric citations (0 hallucination)│
   └──────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
                      Contract 2: PlaybookResponse
               (Consumed by ADK Orchestrator & Frontend)
```

---

## Directory Structure

```text
backend/
├── ai/
│   ├── __init__.py
│   ├── schemas.py              # Pydantic data contracts (TelemetryPayload & PlaybookResponse)
│   └── multimodal_analyst.py   # Gemini 2.5 multimodal agent with strict grounding
├── geo/
│   ├── __init__.py
│   ├── ee_flood.py             # Sentinel-1 SAR flood pipeline & Leaflet XYZ dynamic tiles
│   ├── ee_metrics.py           # CHIRPS precipitation anomaly & WorldPop exposure
│   ├── bq_spatial.py           # BigQuery GIS spatial intersection & route severance
│   └── osm_infra.json          # OpenStreetMap curated vector infrastructure for Kaduwela-Biyagama
├── cache/
│   ├── kelani_golden.json      # Pre-baked Contract 1 payload (fail-safe sub-100ms fallback)
│   └── kelani_playbook_golden.json # Pre-baked Contract 2 playbook response
├── test_pipeline.py            # End-to-end automated test and validation suite
└── README.md                   # This documentation
```

---

## Setup & Prerequisites

### 1. Python Environment

Ensure Python 3.11+ is installed. Activate your virtual environment and install dependencies:

```powershell
# From the repository root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Google Earth Engine Authentication

To query live Sentinel-1 radar, CHIRPS, and WorldPop datasets directly from Earth Engine:

1. **Authenticate your CLI account**:
   ```powershell
   earthengine authenticate
   ```
   *Follow the on-screen browser prompt and authorize your Google account.*

2. **Set your Google Earth Engine Cloud Project**:
   ```powershell
   earthengine set_project <YOUR-GEE-PROJECT-ID>
   ```

*(Note: If Earth Engine is not yet authenticated, the pipeline automatically and seamlessly falls back to high-precision cached golden metrics so development and tests never block.)*

### 3. Google Cloud / Vertex AI Credentials (Optional for Local Dev)

For live Vertex AI Gemini 2.5 multimodal execution and BigQuery GIS:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "path/to/copilot-runtime-sa.json"
$env:GOOGLE_CLOUD_PROJECT = "climate-copilot-2026"
```

---

## Testing & Verification

Run the full end-to-end verification suite with a single command:

```powershell
python backend/test_pipeline.py
```

### What the Test Suite Verifies:
1. **Contract Validation**: Validates `kelani_golden.json` and `kelani_playbook_golden.json` against `schemas.py`.
2. **Earth Engine Pipeline**: Initializes Earth Engine and verifies SAR change detection and dynamic tile generation.
3. **Spatial Intersection Engine**: Validates OpenStreetMap road overlay (`27.6 km` submerged roads, `850m` AB10 bridge approach cut off, Biyagama Substation at `115m` proximity, and hospital route status).
4. **Multimodal Analyst**: Tests Gemini 2.5 risk synthesis and metric grounding.

---

## Shared Data Contracts

### Contract 1: `TelemetryPayload` (`telemetry_payload.json`)
Produced by Kavindu's Geospatial Engine and consumed by Gihara's ADK orchestrator:
- `region_id`: `"LK-KELANI-BIYAGAMA"`
- `satellite_metrics`: Flooded area (`18.4 sq km`), CHIRPS 72h rainfall (`312.5 mm`), anomaly (`+240%`), exposed population (`42,800`).
- `bigquery_gis_impacts`: Submerged roads (`27.6 km`), chokepoints (`OSM-WAY-109482` AB10 highway, `OSM-NODE-883921` Biyagama Substation), threatened hospitals (`Biyagama Divisional Hospital`).
- `visual_artifacts`: Before/After SAR PNG URIs and Leaflet dynamic tile URL.

### Contract 2: `PlaybookResponse` (`playbook_response.json`)
Produced by the multimodal & agentic reasoning layer:
- `risk_level`: `"CRITICAL"`
- `prioritized_chokepoints`: Assets with explicit metric citations (e.g. `"submerged_length_m: 850"`).
- `supply_reroutes`: Recommended expressway bypass corridor (`E02`).
- `pubsub_dispatches`: Targeted machine-to-machine dispatch directives for CEB Grid Control and Emergency Logistics.
