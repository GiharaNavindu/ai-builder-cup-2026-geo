"""Data Contracts and Pydantic Schemas for Climate Copilot.

Contract 1: TelemetryPayload (Produced by Geospatial Telemetry Engine: Kavindu)
Contract 2: PlaybookResponse (Produced by AI Multimodal / Agentic Pipeline: Kavindu & Gihara)
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Contract 1: Geospatial Telemetry Contract
# ============================================================================

class EventDates(BaseModel):
    baseline_window: str = Field(
        ...,
        description="Date range for SAR baseline imagery (e.g. 2024-05-01 to 2024-05-20)"
    )
    flood_window: str = Field(
        ...,
        description="Date range for SAR flood event imagery (e.g. 2024-06-01 to 2024-06-05)"
    )


class SatelliteMetrics(BaseModel):
    flooded_area_sq_km: float = Field(
        ...,
        description="Total detected flood extent in square kilometers via Sentinel-1 SAR"
    )
    chirps_72h_rainfall_mm: float = Field(
        ...,
        description="72-hour cumulative precipitation in mm from CHIRPS"
    )
    rainfall_anomaly_pct: float = Field(
        ...,
        description="Rainfall percentage deviation compared to historical 30-day baseline"
    )
    exposed_population: int = Field(
        ...,
        description="Estimated population exposed within flood boundary via WorldPop"
    )


class Chokepoint(BaseModel):
    asset_id: str = Field(
        ...,
        description="OpenStreetMap or infrastructure asset identifier"
    )
    name: str = Field(
        ...,
        description="Human-readable asset name"
    )
    asset_type: str = Field(
        ...,
        description="Type of asset (e.g. primary_highway, power_substation, bridge)"
    )
    coordinates: List[float] = Field(
        ...,
        description="Latitude and longitude [lat, lon]"
    )
    submerged_length_m: Optional[float] = Field(
        None,
        description="Length of road submerged in meters, if applicable"
    )
    distance_to_flood_m: Optional[float] = Field(
        None,
        description="Distance to nearest flood edge in meters, if applicable"
    )
    cascading_impact: str = Field(
        ...,
        description="Impact assessment on critical connectivity or services"
    )


class HospitalAtRisk(BaseModel):
    name: str = Field(
        ...,
        description="Hospital or medical facility name"
    )
    coordinates: List[float] = Field(
        ...,
        description="Coordinates [lat, lon]"
    )
    severed_access_routes: int = Field(
        ...,
        description="Number of access roads currently inundated"
    )
    remaining_viable_routes: int = Field(
        ...,
        description="Number of remaining viable, unflooded routes"
    )


class VisualArtifacts(BaseModel):
    before_sar_png_uri: str = Field(
        ...,
        description="GCS URI or local path for Sentinel-1 baseline SAR PNG"
    )
    after_sar_png_uri: str = Field(
        ...,
        description="GCS URI or local path for Sentinel-1 flood SAR PNG"
    )
    ee_flood_tile_url: str = Field(
        ...,
        description="Dynamic XYZ tile URL template from Earth Engine for Leaflet rendering"
    )


class BigQueryGisImpacts(BaseModel):
    submerged_road_km: float = Field(
        ...,
        description="Total kilometers of road submerged based on BigQuery ST_Intersects"
    )
    chokepoints: List[Chokepoint] = Field(
        default_factory=list,
        description="List of critical infrastructure chokepoints"
    )
    hospitals_at_risk: List[HospitalAtRisk] = Field(
        default_factory=list,
        description="List of healthcare facilities with threatened access"
    )


class TelemetryPayload(BaseModel):
    region_id: str = Field(
        ...,
        description="Unique region code, e.g. LK-KELANI-BIYAGAMA"
    )
    region_name: str = Field(
        ...,
        description="Descriptive name of the disaster region"
    )
    event_dates: EventDates
    satellite_metrics: SatelliteMetrics
    bigquery_gis_impacts: BigQueryGisImpacts
    visual_artifacts: VisualArtifacts


# ============================================================================
# Contract 2: Vertex AI / ADK Output Schema
# ============================================================================

class PrioritizedChokepoint(BaseModel):
    asset_id: str
    asset_name: str
    coordinates: List[float]
    vulnerability_reason: str
    cited_metric: str = Field(
        ...,
        description="Direct citation from telemetry data to prevent hallucinations"
    )


class SupplyReroute(BaseModel):
    blocked_corridor: str
    recommended_bypass: str
    estimated_delay_mins: int
    target_fleet: str


class PubSubDispatch(BaseModel):
    topic: str
    recipient: str
    urgency: str
    directive: str


class PlaybookResponse(BaseModel):
    risk_level: str = Field(
        ...,
        description="Risk categorization (CRITICAL, HIGH, MODERATE, LOW)"
    )
    executive_summary: str = Field(
        ...,
        description="High-level operational briefing of the event"
    )
    visual_sar_verification: str = Field(
        ...,
        description="Detailed observation from radar backscatter and flood mask"
    )
    prioritized_chokepoints: List[PrioritizedChokepoint]
    supply_reroutes: List[SupplyReroute]
    pubsub_dispatches: List[PubSubDispatch]
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Model confidence score between 0.0 and 1.0"
    )
    limitations: str = Field(
        ...,
        description="Physical sensor and resolution constraints or assumptions"
    )
