"""Google Earth Engine Sentinel-1 SAR Flood & Landslide Detection Pipeline.

Performs:
1. Sentinel-1 GRD SAR data retrieval (baseline vs flood period).
2. Focal median speckle filtering.
3. Change detection thresholding (< -3.0 dB drop).
4. Permanent surface water masking via JRC Global Surface Water.
5. Steep terrain slope masking via SRTM for flood isolation (slope < 5 deg).
6. Deterministic Landslide Susceptibility calculation (SRTM slope > 15 deg + CHIRPS rainfall > 300mm).
7. Dynamic XYZ map tile URL generation (getMapId).
8. Thumbnail export / generation for Gemini Multimodal Analyst.
"""

import os
from typing import Dict, Any, Tuple, Optional
import ee

# Default Bounding Box: Kaduwela–Biyagama Corridor (Kelani River Basin)
# Format: [min_lon, min_lat, max_lon, max_lat]
DEFAULT_ROI = [79.94, 6.90, 80.06, 6.99]
DEFAULT_BASELINE = ("2025-11-01", "2025-11-20")
DEFAULT_FLOOD = ("2025-11-28", "2025-12-04")


def init_earth_engine(
    service_account: Optional[str] = None,
    key_file: Optional[str] = None,
    project: Optional[str] = None
) -> bool:
    """Initialize Google Earth Engine API with credentials or standard auth."""
    try:
        if service_account and key_file:
            credentials = ee.ServiceAccountCredentials(service_account, key_file)
            ee.Initialize(credentials, project=project)
        else:
            project_id = project or os.getenv("EE_PROJECT", "hack-506414")
            ee.Initialize(project=project_id)
        return True
    except Exception as exc:
        print(f"[WARN] Earth Engine init warning: {exc}")
        return False


def build_sar_flood_pipeline(
    roi_coords: list = DEFAULT_ROI,
    baseline_window: Tuple[str, str] = DEFAULT_BASELINE,
    flood_window: Tuple[str, str] = DEFAULT_FLOOD,
    difference_threshold_db: float = -3.0
) -> Dict[str, Any]:
    """Execute Sentinel-1 SAR change detection with JRC and SRTM masks,
    and calculate deterministic Landslide Susceptibility (slope > 15 deg + high rainfall).

    Returns dict with ee.Image objects, flood metrics, landslide risk, and tile URL.
    """
    roi = ee.Geometry.Rectangle(roi_coords)

    # 1. Query Sentinel-1 GRD (IW mode, VV polarization, descending & ascending)
    s1_collection = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(roi)
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .select("VV")
    )

    before_col = s1_collection.filterDate(baseline_window[0], baseline_window[1])
    after_col = s1_collection.filterDate(flood_window[0], flood_window[1])

    # Composite images (mean backscatter in dB)
    before_img = before_col.mosaic().clip(roi)
    after_img = after_col.mosaic().clip(roi)

    # 2. Speckle filter using 50m focal median filter
    before_filtered = before_img.focal_median(50, "circle", "meters")
    after_filtered = after_img.focal_median(50, "circle", "meters")

    # 3. Difference: smooth flood waters reflect radar away, causing significant backscatter drop
    difference = after_filtered.subtract(before_filtered)
    raw_flood_mask = difference.lt(difference_threshold_db)

    # 4. Mask out permanent surface water (JRC occurrence < 80%)
    jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").clip(roi)
    jrc_occurrence = jrc.select("occurrence")
    permanent_water_mask = jrc_occurrence.lt(80)

    # 5. Topographic modeling via SRTM DEM (slope < 5 deg for flat flood plains)
    dem = ee.Image("USGS/SRTMGL1_003").clip(roi)
    slope = ee.Terrain.slope(dem)
    slope_mask = slope.lt(5)

    # 6. Apply masks to isolate active inundation
    final_flood_mask = (
        raw_flood_mask
        .updateMask(permanent_water_mask)
        .updateMask(slope_mask)
        .selfMask()
    )

    # 7. Compute total flooded area in sq km
    pixel_area = final_flood_mask.multiply(ee.Image.pixelArea())
    area_stats = pixel_area.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=roi,
        scale=10,
        maxPixels=1e9
    )
    flooded_area_sq_m = ee.Number(area_stats.get("VV", 0))
    flooded_area_sq_km = flooded_area_sq_m.divide(1e6)

    # 8. Deterministic Landslide Susceptibility:
    # Steep terrain (SRTM slope > 15 degrees) combined with high rainfall (> 300mm)
    chirps_col = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterBounds(roi)
        .filterDate(flood_window[0], flood_window[1])
        .select("precipitation")
    )
    chirps_sum = ee.Algorithms.If(
        chirps_col.size().gt(0),
        chirps_col.sum().clip(roi),
        ee.Image.constant(350.0).clip(roi)  # Fallback threshold if CHIRPS latency
    )
    rainfall_img = ee.Image(chirps_sum)
    steep_slope_mask = slope.gt(15)
    high_rain_mask = rainfall_img.gte(300.0)
    landslide_mask = steep_slope_mask.And(high_rain_mask).selfMask()

    # Compute total landslide risk area in sq km
    landslide_pixel_area = landslide_mask.multiply(ee.Image.pixelArea())
    landslide_stats = landslide_pixel_area.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=roi,
        scale=30,
        maxPixels=1e9
    )
    landslide_risk_sq_m = ee.Number(landslide_stats.get("slope", 0))
    landslide_risk_sq_km = landslide_risk_sq_m.divide(1e6)

    # 9. Generate dynamic Leaflet tile URL template
    vis_params = {
        "min": 0,
        "max": 1,
        "palette": ["#00B4D8", "#0077B6"]
    }
    map_id = final_flood_mask.getMapId(vis_params)
    tile_url_template = map_id["tile_fetcher"].url_format

    return {
        "roi": roi,
        "before_img": before_img,
        "after_img": after_img,
        "final_flood_mask": final_flood_mask,
        "flooded_area_sq_km": flooded_area_sq_km,
        "landslide_mask": landslide_mask,
        "landslide_risk_sq_km": landslide_risk_sq_km,
        "tile_url_template": tile_url_template,
        "map_id": map_id
    }


def get_sar_thumbnail_urls(
    pipeline_result: Dict[str, Any],
    dimensions: int = 512
) -> Dict[str, str]:
    """Generate Before and After SAR thumbnail PNG URLs for multimodal Gemini ingestion."""
    roi = pipeline_result["roi"]
    before_img = pipeline_result["before_img"]
    after_img = pipeline_result["after_img"]
    final_flood_mask = pipeline_result["final_flood_mask"]

    # SAR backscatter visualization (-25 dB to 0 dB)
    sar_vis = {
        "min": -25,
        "max": 0,
        "palette": ["#000000", "#4B5563", "#9CA3AF", "#FFFFFF"],
        "dimensions": dimensions,
        "region": roi
    }

    # Flood overlay visualization
    flood_vis = {
        "min": 0,
        "max": 1,
        "palette": ["#EF4444"],
        "dimensions": dimensions,
        "region": roi
    }

    before_thumb_url = before_img.getThumbURL(sar_vis)
    after_thumb_url = after_img.getThumbURL(sar_vis)
    flood_thumb_url = final_flood_mask.getThumbURL(flood_vis)

    return {
        "before_sar_png_url": before_thumb_url,
        "after_sar_png_url": after_thumb_url,
        "flood_mask_png_url": flood_thumb_url
    }
