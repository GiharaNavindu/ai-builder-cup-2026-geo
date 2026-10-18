"""FastAPI Server for Climate Copilot Autonomous Disaster Command Center.

Provides endpoints for:
1. Multi-hazard GIS & SAR risk analysis with Sphere humanitarian logistics (/api/analyze)
2. Operational zones discovery endpoint (/api/zones)
3. Simulated & live Google Cloud Pub/Sub emergency dispatch (/api/simulate-dispatch)
4. Health check for Google Cloud Run container probes (/health and /)
5. Production static asset hosting for containerized Cloud Run deployments
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pathlib import Path

# Ensure project root is in sys.path
root_dir = Path(__file__).parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.ai.schemas import (
    TelemetryPayload,
    PlaybookResponse,
    PubSubDispatch,
)
from backend.geo.ee_flood import init_earth_engine, build_sar_flood_pipeline
from backend.geo.bq_spatial import (
    SRI_LANKA_ZONES,
    resolve_zone_id,
    run_bigquery_spatial_analysis,
    assemble_telemetry_payload,
)
from backend.ai.multimodal_analyst import analyze_flood_multimodal


app = FastAPI(
    title="Climate Copilot Disaster Command API",
    description="Autonomous Multi-Hazard Disaster Resilience Command Center powered by Sentinel-1 SAR, SRTM, BigQuery GIS, and Gemini 2.5",
    version="2.2.0",
)

# Enable CORS for local frontend development and Cloud Run deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    zone_id: str = Field(
        default="central_kandy",
        description="Selectable Operational Zone: 'central_kandy', 'western_kelani', 'eastern_northern', or 'sri_lanka_national'"
    )
    mode: str = Field(
        default="ditwah_2025",
        description="Operating mode: 'ditwah_2025' (ground-truth Cyclone Ditwah) or 'live_2026' (near-real-time Earth Engine query)"
    )
    rainfall_simulation_multiplier: float = Field(
        default=1.0,
        ge=0.1,
        le=3.0,
        description="Multiplier for rainfall surge simulation (e.g. 1.2 for +20% monsoon surge)"
    )
    region_name: Optional[str] = Field(
        default=None,
        description="Optional custom region description"
    )
    bounding_box: Optional[List[float]] = Field(
        default=None,
        description="Optional custom bounding box [min_lon, min_lat, max_lon, max_lat]"
    )
    baseline_dates: Optional[List[str]] = Field(
        default=None,
        description="Optional [start_date, end_date] for pre-event baseline SAR imagery"
    )
    event_dates: Optional[List[str]] = Field(
        default=None,
        description="Optional [start_date, end_date] for disaster event SAR imagery"
    )


class AnalysisResponse(BaseModel):
    telemetry: TelemetryPayload
    playbook: PlaybookResponse
    available_zones: Optional[List[str]] = Field(
        default=["central_kandy", "western_kelani", "eastern_northern", "sri_lanka_national"],
        description="List of selectable Sri Lanka operational disaster zones"
    )


class DispatchReceipt(BaseModel):
    message_id: str = Field(..., description="Unique Pub/Sub or simulated delivery identifier")
    timestamp_utc: str = Field(..., description="ISO 8601 UTC delivery timestamp")
    status: str = Field(default="DISPATCHED_TO_DMC", description="Dispatch delivery status")
    topic: str = Field(..., description="Target Google Cloud Pub/Sub topic")
    recipient: str = Field(..., description="Designated emergency response authority")
    urgency: str = Field(..., description="Operational urgency classification")
    directive: str = Field(..., description="Exact operational action instructions")
    delivery_latency_ms: int = Field(default=38, description="Simulated network transport latency in milliseconds")
    ack_id: str = Field(..., description="Downstream acknowledgment token")


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for Google Cloud Run container liveness probes."""
    return {
        "status": "healthy",
        "service": "climate-copilot-backend",
        "version": "2.2.0"
    }


@app.get("/api/zones", tags=["Operational Zones"])
def get_zones():
    """Return available Sri Lanka operational zones and baseline parameters."""
    zones_summary = []
    for zid, zdata in SRI_LANKA_ZONES.items():
        zones_summary.append({
            "zone_id": zid,
            "region_id": zdata["region_id"],
            "name": zdata["name"],
            "bounding_box": zdata["bounding_box"],
            "baseline_dates": zdata["baseline_dates"],
            "event_dates": zdata["event_dates"],
            "metrics": zdata["metrics"],
            "chokepoints_count": len(zdata["chokepoints"]),
            "hospitals_count": len(zdata["hospitals"]),
        })
    return {"zones": zones_summary}


@app.post("/api/analyze", response_model=AnalysisResponse, tags=["Analysis"])
def analyze_flood(request: AnalysisRequest):
    """Execute multi-hazard geospatial telemetry extraction and multimodal risk synthesis.

    Supports:
    - 4 official Sri Lanka Operational Zones ('central_kandy', 'western_kelani', 'eastern_northern', 'sri_lanka_national')
    - Modes: 'ditwah_2025' (calibrated DMC/UNDP ground-truth) vs 'live_2026' (live Earth Engine)
    - Dynamic rainfall simulation multiplier (e.g. 1.2 for +20% surge)
    - Multi-hazard impact: Flood inundation, Landslide slope failure, Bridge collapse
    - Sphere humanitarian logistics: IDPs, drinking water liters, trauma kits, debris volume
    """
    try:
        # Validate coordinates & dates if custom values provided
        if request.bounding_box is not None and len(request.bounding_box) != 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="bounding_box must contain exactly 4 coordinates: [min_lon, min_lat, max_lon, max_lat]"
            )
        if request.baseline_dates is not None and len(request.baseline_dates) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="baseline_dates must contain exactly 2 date strings: [start_date, end_date]"
            )
        if request.event_dates is not None and len(request.event_dates) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="event_dates must contain exactly 2 date strings: [start_date, end_date]"
            )

        # 1. Resolve active zone and parameters
        resolved_zone = resolve_zone_id(request.zone_id, request.bounding_box)
        zone_data = SRI_LANKA_ZONES[resolved_zone]

        bbox = request.bounding_box or zone_data["bounding_box"]
        base_dates = request.baseline_dates or zone_data["baseline_dates"]
        ev_dates = request.event_dates or zone_data["event_dates"]
        reg_name = request.region_name or zone_data["name"]

        # 2. Earth Engine SAR Flood & Landslide Pipeline
        has_ee = init_earth_engine(project=os.getenv("EE_PROJECT", "hack-506414"))
        tile_url = ""
        live_flooded_km: Optional[float] = None
        live_landslide_km: Optional[float] = None

        if has_ee and request.mode == "live_2026":
            try:
                ee_result = build_sar_flood_pipeline(
                    roi_coords=bbox,
                    baseline_window=(base_dates[0], base_dates[1]),
                    flood_window=(ev_dates[0], ev_dates[1])
                )
                live_flooded_km = float(ee_result["flooded_area_sq_km"].getInfo() or 0.0)
                live_landslide_km = float(ee_result["landslide_risk_sq_km"].getInfo() or 0.0)
                tile_url = ee_result["tile_url_template"]
            except Exception as ee_err:
                print(f"[WARN] Earth Engine live query issue: {ee_err}. Using calibrated zone data.")

        # 3. BigQuery OpenStreetMap Multi-Hazard Spatial Analysis
        gis_impacts = run_bigquery_spatial_analysis(
            bounding_box=bbox,
            zone_id=resolved_zone,
            rainfall_simulation_multiplier=request.rainfall_simulation_multiplier
        )

        # 4. Assemble Contract 1 Telemetry Payload
        telemetry = assemble_telemetry_payload(
            zone_id=resolved_zone,
            region_id=zone_data["region_id"],
            region_name=reg_name,
            baseline_window=f"{base_dates[0]} to {base_dates[1]}",
            flood_window=f"{ev_dates[0]} to {ev_dates[1]}",
            flooded_area_sq_km=live_flooded_km,
            landslide_high_risk_sq_km=live_landslide_km,
            gis_impacts=gis_impacts,
            bounding_box=bbox,
            rainfall_simulation_multiplier=request.rainfall_simulation_multiplier
        )

        if tile_url:
            telemetry.visual_artifacts.ee_flood_tile_url = tile_url

        # 5. Generate Contract 2 Playbook via Gemini 2.5
        playbook = analyze_flood_multimodal(telemetry=telemetry, use_mock_fallback=True)

        return AnalysisResponse(
            telemetry=telemetry,
            playbook=playbook,
            available_zones=list(SRI_LANKA_ZONES.keys())
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Disaster analysis pipeline error: {str(exc)}"
        )


@app.post("/api/simulate-dispatch", response_model=DispatchReceipt, tags=["Humanitarian Logistics & Dispatch"])
def simulate_dispatch(dispatch: PubSubDispatch):
    """Execute or simulate live Pub/Sub message publishing to Sri Lanka emergency authorities.

    Dispatches emergency directives for helicopter medevac airlifts, Sphere-standard water bowsers,
    heavy debris excavators, or power switchyard defenses, returning an official confirmation receipt.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    message_id = f"pubsub-msg-{uuid.uuid4().hex[:12]}"
    ack_id = f"ack-{uuid.uuid4().hex[:8]}"

    # Attempt live GCP Pub/Sub publish if service credentials and project are configured
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", os.getenv("BIGQUERY_PROJECT"))
    if project_id and os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        try:
            from google.cloud import pubsub_v1
            publisher = pubsub_v1.PublisherClient()
            topic_path = publisher.topic_path(project_id, dispatch.topic)
            payload_bytes = dispatch.model_dump_json().encode("utf-8")
            future = publisher.publish(topic_path, payload_bytes)
            gcp_msg_id = future.result(timeout=5.0)
            message_id = f"gcp-pubsub-{gcp_msg_id}"
            ack_id = f"gcp-ack-{gcp_msg_id[:8]}"
        except Exception as pub_err:
            print(f"[NOTE] Live GCP Pub/Sub delivery fallback: {pub_err}")

    return DispatchReceipt(
        message_id=message_id,
        timestamp_utc=timestamp,
        status="DISPATCHED_TO_DMC",
        topic=dispatch.topic,
        recipient=dispatch.recipient,
        urgency=dispatch.urgency,
        directive=dispatch.directive,
        delivery_latency_ms=38,
        ack_id=ack_id,
    )


# Mount static frontend build if directory exists (for Cloud Run production container)
static_dir = Path("/app/static")
if not static_dir.exists():
    static_dir = root_dir / "static"
if not static_dir.exists():
    static_dir = root_dir / "frontend" / "dist"

if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
else:
    @app.get("/", tags=["Health"])
    def root_fallback():
        return {
            "status": "healthy",
            "service": "climate-copilot-backend",
            "version": "2.2.0"
        }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
