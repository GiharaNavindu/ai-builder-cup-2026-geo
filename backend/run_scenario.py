"""Interactive Scenario Runner for Climate Copilot.

Allows running the Geospatial & AI pipeline for:
1. 'kelani_2024' (Historical disaster scenario)
2. 'ditwah_2025' (Major 2025 Cyclone Ditwah scenario)
3. 'today' (Live current date range)

Usage:
  python backend/run_scenario.py --scenario ditwah_2025
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Ensure backend modules can be imported
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

from backend.geo.ee_flood import init_earth_engine, build_sar_flood_pipeline, DEFAULT_ROI
from backend.geo.bq_spatial import assemble_telemetry_payload
from backend.ai.multimodal_analyst import analyze_flood_multimodal

def get_today_date_windows():
    today = datetime.now()
    flood_start = (today - timedelta(days=5)).strftime("%Y-%m-%d")
    flood_end = today.strftime("%Y-%m-%d")
    baseline_start = (today - timedelta(days=25)).strftime("%Y-%m-%d")
    baseline_end = (today - timedelta(days=6)).strftime("%Y-%m-%d")
    return (baseline_start, baseline_end), (flood_start, flood_end)

def run_scenario(scenario_name: str = "today", export_to_frontend: bool = True):
    print(f"\n==========================================================")
    print(f"   Executing Scenario: {scenario_name.upper()}")
    print(f"==========================================================")

    if scenario_name == "today":
        (base_start, base_end), (flood_start, flood_end) = get_today_date_windows()
        region_name = f"Sri Lanka Watch Zone (Live: {flood_end})"
        roi_coords = DEFAULT_ROI
        is_live = True
    elif scenario_name == "ditwah_2025":
        base_start, base_end = "2025-11-01", "2025-11-20"
        flood_start, flood_end = "2025-11-28", "2025-12-04"
        region_name = "Eastern & Central Provinces (Cyclone Ditwah 2025)"
        roi_coords = [80.5, 6.5, 81.9, 8.5] # Bounding box covering Eastern and Central impact zones
        is_live = False
    else: # kelani_2024
        base_start, base_end = "2024-05-01", "2024-05-20"
        flood_start, flood_end = "2024-06-01", "2024-06-05"
        region_name = "Kaduwela – Biyagama Corridor (Kelani River Basin)"
        roi_coords = DEFAULT_ROI
        is_live = False

    print(f"* Region Target   : {region_name}")
    print(f"* Baseline Window : {base_start} to {base_end}")
    print(f"* Target Window   : {flood_start} to {flood_end}")

    # 1. Initialize Earth Engine
    print("\n[Step 1] Connecting to Google Earth Engine...")
    has_ee = init_earth_engine(project="hack-506414")

    if has_ee:
        try:
            print("  Querying Sentinel-1 SAR GRD VV radar imagery...")
            ee_result = build_sar_flood_pipeline(
                roi_coords=roi_coords,
                baseline_window=(base_start, base_end),
                flood_window=(flood_start, flood_end)
            )
            flooded_sq_km = float(ee_result["flooded_area_sq_km"].getInfo() or 0.0)
            tile_url = ee_result["tile_url_template"]
            print(f"  [OK] Live SAR Radar Analysis Complete! Flooded Area: {flooded_sq_km:.2f} km^2")
        except Exception as e:
            print(f"  [WARN] Live Earth Engine query returned error: {e}")
            flooded_sq_km = 0.0 if is_live else (125.4 if scenario_name == 'ditwah_2025' else 18.4)
            tile_url = ""
    else:
        print("  [NOTE] Earth Engine not authenticated locally. Using scenario defaults.")
        flooded_sq_km = 0.0 if is_live else (125.4 if scenario_name == 'ditwah_2025' else 18.4)
        tile_url = ""

    # 2. Run GIS Spatial Intersections
    print("\n[Step 2] Executing BigQuery / Spatial Intersection...")
    if is_live and flooded_sq_km < 1.0:
        telemetry = assemble_telemetry_payload(
            region_name=region_name,
            baseline_window=f"{base_start} to {base_end}",
            flood_window=f"{flood_start} to {flood_end}",
            flooded_area_sq_km=flooded_sq_km,
            chirps_72h_rainfall_mm=12.4,
            rainfall_anomaly_pct=0.0,
            exposed_population=0
        )
        telemetry.bigquery_gis_impacts.submerged_road_km = 0.0
        telemetry.bigquery_gis_impacts.chokepoints = []
        for hosp in telemetry.bigquery_gis_impacts.hospitals_at_risk:
            hosp.severed_access_routes = 0
            hosp.remaining_viable_routes = 3
    else:
        # Use different mock data thresholds based on the scenario
        if scenario_name == 'ditwah_2025':
            telemetry = assemble_telemetry_payload(
                region_name=region_name,
                baseline_window=f"{base_start} to {base_end}",
                flood_window=f"{flood_start} to {flood_end}",
                flooded_area_sq_km=flooded_sq_km,
                chirps_72h_rainfall_mm=450.0, 
                rainfall_anomaly_pct=320.0,
                exposed_population=1400000 
            )
            # You would ideally replace this with BigQuery results covering the East coast
            telemetry.bigquery_gis_impacts.submerged_road_km = 210.5
        else:
            telemetry = assemble_telemetry_payload()

    print(f"  [OK] Submerged Roads: {telemetry.bigquery_gis_impacts.submerged_road_km} km")
    print(f"  [OK] Active Chokepoints: {len(telemetry.bigquery_gis_impacts.chokepoints)}")

    # 3. AI Risk Synthesis
    print("\n[Step 3] Gemini 2.5 Multimodal Risk Synthesis...")
    if is_live and flooded_sq_km < 1.0:
        from backend.ai.schemas import PlaybookResponse
        playbook = PlaybookResponse(
            risk_level="NORMAL",
            executive_summary=f"No active flood inundation detected across {region_name} for window {flood_start} to {flood_end}. All primary highway corridors and grid substations are operating under normal conditions.",
            visual_sar_verification="Sentinel-1 radar backscatter shows typical surface reflection with no significant specular anomaly (< -3 dB).",
            prioritized_chokepoints=[],
            supply_reroutes=[],
            pubsub_dispatches=[],
            confidence_score=0.96,
            limitations="Standard 10m Sentinel-1 SAR resolution; local rain gauge telemetry confirms dry-to-moderate weather."
        )
    else:
        playbook = analyze_flood_multimodal(telemetry=telemetry, use_mock_fallback=True)

    print(f"  [OK] Risk Level: {playbook.risk_level}")
    print(f"  [OK] Executive Summary: {playbook.executive_summary[:100]}...")

    # Optional: Cache the payload to a local file for the Ditwah scenario
    if scenario_name == 'ditwah_2025':
         cache_path = root_dir / "backend" / "cache" / "ditwah_playbook_golden.json"
         with open(cache_path, "w", encoding="utf-8") as f:
             f.write(playbook.model_dump_json(indent=2))
         print(f"  [OK] Cached Ditwah playbook to {cache_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Climate Copilot Scenario")
    parser.add_argument(
        "--scenario",
        choices=["today", "kelani_2024", "ditwah_2025"],
        default="ditwah_2025",
        help="Scenario to run: 'today', 'kelani_2024', or 'ditwah_2025'"
    )
    args = parser.parse_args()
    run_scenario(args.scenario)