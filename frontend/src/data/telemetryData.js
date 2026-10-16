// Contract 1: Geospatial Telemetry Data for Kelani Basin / Kaduwela-Biyagama
export const KELANI_TELEMETRY = {
  region_id: "LK-KELANI-BIYAGAMA",
  region_name: "Kaduwela – Biyagama Corridor (Kelani River Basin)",
  event_dates: {
    baseline_window: "2024-05-01 to 2024-05-20",
    flood_window: "2024-06-01 to 2024-06-05"
  },
  satellite_metrics: {
    flooded_area_sq_km: 18.4,
    chirps_72h_rainfall_mm: 312.5,
    rainfall_anomaly_pct: 240.0,
    exposed_population: 42800
  },
  bigquery_gis_impacts: {
    submerged_road_km: 27.6,
    chokepoints: [
      {
        asset_id: "OSM-WAY-109482",
        name: "Kaduwela Bridge Approach (AB10 Highway)",
        asset_type: "primary_highway",
        coordinates: [6.9358, 79.9842],
        submerged_length_m: 850,
        distance_to_flood_m: 0,
        cascading_impact: "Severs primary ambulance & medical supply corridor to Biyagama Divisional Hospital"
      },
      {
        asset_id: "OSM-NODE-883921",
        name: "Biyagama 132kV Grid Substation Perimeter",
        asset_type: "power_substation",
        coordinates: [6.9482, 79.9915],
        submerged_length_m: null,
        distance_to_flood_m: 115,
        cascading_impact: "Inundation threatens power supply to 3 water pumping stations and Biyagama Hospital"
      }
    ],
    hospitals_at_risk: [
      {
        name: "Biyagama Divisional Hospital",
        coordinates: [6.9431, 80.0012],
        severed_access_routes: 2,
        remaining_viable_routes: 1
      }
    ]
  },
  visual_artifacts: {
    before_sar_png_uri: "gs://climate-copilot-assets/kelani_before_sar.png",
    after_sar_png_uri: "gs://climate-copilot-assets/kelani_after_sar.png",
    ee_flood_tile_url: "https://earthengine.googleapis.com/v1alpha/projects/climate-copilot-2026/maps/kelani_flood_tiles/{z}/{x}/{y}"
  }
};

// Contract 2: Vertex AI Gemini 2.5 Playbook Response
export const KELANI_PLAYBOOK = {
  risk_level: "CRITICAL",
  executive_summary: "Severe flash flooding across 18.4 sq km in the Kelani Basin driven by 312.5 mm of 72h rainfall (+240% anomaly). 27.6 km of road network is submerged, critically severing the AB10 Kaduwela Bridge approach and threatening the Biyagama 132kV substation.",
  visual_sar_verification: "Sentinel-1 VV backscatter decrease (>3 dB) confirms widespread floodplain inundation along the northern bank of the Kelani River, extending 850m across the AB10 approach.",
  prioritized_chokepoints: [
    {
      asset_id: "OSM-WAY-109482",
      asset_name: "Kaduwela Bridge Approach (AB10 Highway)",
      coordinates: [6.9358, 79.9842],
      vulnerability_reason: "850m road segment submerged; cuts off primary medical route to Biyagama Hospital.",
      cited_metric: "submerged_length_m: 850"
    }
  ],
  supply_reroutes: [
    {
      blocked_corridor: "AB10 Kaduwela Bridge Approach",
      recommended_bypass: "Southern Expressway (E02) via Kothalawala Interchange to Delgoda High-Ground Link",
      estimated_delay_mins: 18,
      target_fleet: "Medical Oxygen & Emergency Food Trucks"
    }
  ],
  pubsub_dispatches: [
    {
      topic: "infra-grid-substation-alerts",
      recipient: "CEB Grid Control / Biyagama 132kV Ops",
      urgency: "IMMEDIATE_0_2H",
      directive: "Deploy perimeter flood barriers and pre-stage mobile diesel generator at Biyagama Divisional Hospital (flood edge at 115m)."
    }
  ],
  confidence_score: 0.91,
  limitations: "Sentinel-1 SAR resolution is 10m; urban radar shadow in dense building clusters requires local gauge verification."
};

// Curated GeoJSON vector features for MapCanvas rendering
export const MAP_GEOJSON_FEATURES = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "OSM-WAY-109482",
      properties: {
        asset_id: "OSM-WAY-109482",
        name: "Kaduwela Bridge Approach (AB10 Highway)",
        type: "flooded_highway",
        color: "#f43f5e",
        submerged_length: "850m submerged",
        status: "SEVERED"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [79.9805, 6.9332],
          [79.9822, 6.9344],
          [79.9842, 6.9358],
          [79.9865, 6.9375],
          [79.9885, 6.9392]
        ]
      }
    },
    {
      type: "Feature",
      id: "OSM-WAY-E02-BYPASS",
      properties: {
        asset_id: "OSM-WAY-E02-BYPASS",
        name: "Southern Expressway (E02) Bypass Route",
        type: "recommended_bypass",
        color: "#10b981",
        delay: "+18 mins",
        status: "VIABLE HIGH GROUND"
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [79.9650, 6.9200],
          [79.9750, 6.9250],
          [79.9860, 6.9310],
          [79.9960, 6.9420],
          [80.0070, 6.9530]
        ]
      }
    },
    {
      type: "Feature",
      id: "FLOOD-POLYGON-SAR",
      properties: {
        type: "flood_extent",
        area_sq_km: 18.4,
        source: "Sentinel-1 SAR Change Detection"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [79.975, 6.930],
            [79.990, 6.932],
            [79.998, 6.940],
            [79.992, 6.950],
            [79.982, 6.945],
            [79.970, 6.938],
            [79.975, 6.930]
          ]
        ]
      }
    }
  ]
};
