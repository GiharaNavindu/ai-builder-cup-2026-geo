import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  Layers,
  Sliders,
  AlertTriangle,
  Zap,
  Activity,
  Compass,
  Navigation,
  Globe,
  Mountain,
  HeartPulse,
  Flame,
} from "lucide-react";

// Fix Leaflet marker icon asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Zone coordinate anchors & default zoom levels
const ZONE_ANCHORS = {
  sri_lanka_national: { center: [7.8731, 80.7718], zoom: 8, title: "Sri Lanka Island-Wide Overview" },
  central_kandy: { center: [7.2500, 80.5800], zoom: 11, title: "Central Highlands & Mahaweli Basin" },
  western_kelani: { center: [6.9800, 79.9600], zoom: 11, title: "Western Province & Kelani Basin" },
  eastern_northern: { center: [8.2000, 81.3000], zoom: 9, title: "Eastern & Northern Coastal Zone" },
};

// Dynamic Marker Icons by Multi-Hazard Type
const createMultiHazardIcon = (hazardType = "FLOOD_INUNDATION") => {
  const type = hazardType || "FLOOD_INUNDATION";
  let coreClass = "marker-core-danger";
  let pingColor = "#f43f5e";
  let symbol = "";

  if (type === "LANDSLIDE_BLOCKAGE") {
    coreClass = "marker-core-landslide";
    pingColor = "#f59e0b";
    symbol = "▲";
  } else if (type === "BRIDGE_COLLAPSE") {
    coreClass = "marker-core-bridge";
    pingColor = "#a855f7";
    symbol = "✕";
  } else if (type === "HOSPITAL") {
    coreClass = "marker-core-hospital";
    pingColor = "#3b82f6";
    symbol = "H";
  }

  const pingHtml =
    type === "HOSPITAL"
      ? ""
      : `<div class="radar-ping" style="border-color: ${pingColor};"></div>`;

  return L.divIcon({
    className: "custom-pulsing-marker",
    html: `
      <div style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
        ${pingHtml}
        <div class="${coreClass}">${symbol}</div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
};

// Map Pan Controller for Zone Transitions and Citation Clicks
function MapFlyController({ activeZone, targetCoords }) {
  const map = useMap();

  // Fly to zone center when user changes the active zone
  useEffect(() => {
    const anchor = ZONE_ANCHORS[activeZone] || ZONE_ANCHORS.central_kandy;
    map.flyTo(anchor.center, anchor.zoom, {
      duration: 1.5,
      easeLinearity: 0.25,
    });
  }, [activeZone, map]);

  // Fly to specific chokepoint coordinates when citation is clicked
  useEffect(() => {
    if (targetCoords && targetCoords.length === 2) {
      map.flyTo(targetCoords, 14, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [targetCoords, map]);

  return null;
}

export default function MapCanvas({
  liveTelemetry,
  livePlaybook,
  activeZone = "central_kandy",
  activeMode = "ditwah_2025",
  selectedChokepointCoords,
  onMarkerSelect,
  rainfallMultiplier = 1.0,
  onRainfallChange,
}) {
  const currentAnchor = ZONE_ANCHORS[activeZone] || ZONE_ANCHORS.central_kandy;
  const [sarOpacity, setSarOpacity] = useState(0.85);
  const [showFloodMask, setShowFloodMask] = useState(true);
  const [showInfrastructure, setShowInfrastructure] = useState(true);
  const [showBypassRoutes, setShowBypassRoutes] = useState(true);

  const chokepoints = liveTelemetry?.bigquery_gis_impacts?.chokepoints || [];
  const hospitals = liveTelemetry?.bigquery_gis_impacts?.hospitals_at_risk || [];
  const tileUrl = liveTelemetry?.visual_artifacts?.ee_flood_tile_url;

  return (
    <div className="map-canvas-container">
      {/* Floating HUD: Top Left Theater & Quick-Pan Buttons */}
      <div className="map-hud-top-left">
        <div className="hud-card">
          <div className="hud-title-row">
            <div className="hud-title">
              <Compass size={18} color="#06b6d4" />
              {currentAnchor.title}
            </div>
            <span
              className="brand-badge"
              style={
                activeMode === "ditwah_2025"
                  ? { color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.4)", background: "rgba(244, 63, 94, 0.15)" }
                  : { color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.15)" }
              }
            >
              {activeMode === "ditwah_2025" ? "DITWAH 2025 REPLAY" : "LIVE SENTINEL-1 FEED"}
            </span>
          </div>
          <div className="hud-subtitle">
            Zone: {activeZone} • Rain Surge: +{Math.round((rainfallMultiplier - 1.0) * 100)}%
          </div>

          {/* Quick-Pan Buttons for Assets in Current Zone */}
          <div className="quick-pan-bar">
            {chokepoints.slice(0, 3).map((cp, idx) => (
              <button
                key={idx}
                className="pan-btn"
                onClick={() => onMarkerSelect && onMarkerSelect(cp.asset_id)}
                title={cp.name}
              >
                {cp.hazard_type === "LANDSLIDE_BLOCKAGE" ? (
                  <Mountain size={11} color="#f59e0b" />
                ) : cp.hazard_type === "BRIDGE_COLLAPSE" ? (
                  <AlertTriangle size={11} color="#a855f7" />
                ) : (
                  <Zap size={11} color="#f43f5e" />
                )}
                {(cp.name || "Chokepoint").split(" ")[0]}...
              </button>
            ))}
            {hospitals.slice(0, 1).map((hosp, idx) => (
              <button
                key={`h-${idx}`}
                className="pan-btn"
                onClick={() => onMarkerSelect && onMarkerSelect(`HOSP-${idx}`)}
                title={hosp.name}
              >
                <HeartPulse size={11} color="#3b82f6" />
                {(hosp.name || "Hospital").split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Floating HUD: Bottom Dock with Surge Slider & Layer Controls */}
      <div className="map-hud-bottom">
        {/* What-If Rainfall Surge Simulator Slider */}
        <div className="slider-group surge-slider-group">
          <span className="slider-label" style={{ color: "#f59e0b" }}>
            <Flame size={14} color="#f59e0b" />
            Surge Simulator: +{Math.round((rainfallMultiplier - 1.0) * 100)}%
          </span>
          <input
            type="range"
            min="1.0"
            max="1.5"
            step="0.05"
            value={rainfallMultiplier}
            onChange={(e) => onRainfallChange && onRainfallChange(parseFloat(e.target.value))}
            className="sar-slider surge-slider"
            title="Simulate worsening monsoon rainfall surge (100% to 150%)"
          />
        </div>

        {/* SAR Radar Opacity */}
        <div className="slider-group">
          <span className="slider-label">
            <Sliders size={13} color="#06b6d4" />
            SAR Opacity: {Math.round(sarOpacity * 100)}%
          </span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={sarOpacity}
            onChange={(e) => setSarOpacity(parseFloat(e.target.value))}
            className="sar-slider"
            title="Adjust radar flood layer opacity"
          />
        </div>

        {/* Layer Toggles */}
        <button
          className={`layer-toggle-btn ${showFloodMask ? "active" : ""}`}
          onClick={() => setShowFloodMask(!showFloodMask)}
        >
          <Layers size={13} />
          Flood Mask
        </button>

        <button
          className={`layer-toggle-btn ${showInfrastructure ? "active" : ""}`}
          onClick={() => setShowInfrastructure(!showInfrastructure)}
        >
          <Zap size={13} />
          Chokepoints
        </button>

        <button
          className={`layer-toggle-btn ${showBypassRoutes ? "active" : ""}`}
          onClick={() => setShowBypassRoutes(!showBypassRoutes)}
        >
          <Navigation size={13} />
          Bypass Routes
        </button>
      </div>

      {/* Leaflet Map Engine */}
      <MapContainer
        center={currentAnchor.center}
        zoom={currentAnchor.zoom}
        zoomControl={false}
        className="leaflet-map-wrapper"
      >
        <MapFlyController activeZone={activeZone} targetCoords={selectedChokepointCoords} />

        {/* Dark High-Contrast Basemap */}
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a> &copy; OpenStreetMap'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />

        {/* Dynamic Earth Engine Flood Tile Layer if available */}
        {showFloodMask && tileUrl && (
          <TileLayer url={tileUrl} opacity={sarOpacity} maxZoom={16} />
        )}

        {/* Multi-Hazard Infrastructure Chokepoints */}
        {showInfrastructure &&
          chokepoints.map((cp, idx) => (
            <React.Fragment key={`cp-${idx}`}>
              {/* Highlight Circle for Submerged Road Radius */}
              {showFloodMask && cp.submerged_length_m && (
                <Circle
                  center={cp.coordinates}
                  radius={Math.min(cp.submerged_length_m, 2000)}
                  pathOptions={{
                    color: cp.hazard_type === "LANDSLIDE_BLOCKAGE" ? "#f59e0b" : "#f43f5e",
                    fillColor: cp.hazard_type === "LANDSLIDE_BLOCKAGE" ? "#d97706" : "#0284c7",
                    fillOpacity: sarOpacity * 0.35,
                    weight: 1.5,
                  }}
                />
              )}

              {/* Pulsing Beacon Marker */}
              <Marker
                position={cp.coordinates}
                icon={createMultiHazardIcon(cp.hazard_type)}
                eventHandlers={{
                  click: () => onMarkerSelect && onMarkerSelect(cp.asset_id),
                }}
              >
                <Popup>
                  <div className="popup-card">
                    <div className="popup-title">{cp.name}</div>
                    <div
                      className="popup-badge"
                      style={
                        cp.hazard_type === "LANDSLIDE_BLOCKAGE"
                          ? { background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", borderColor: "rgba(245, 158, 11, 0.4)" }
                          : cp.hazard_type === "BRIDGE_COLLAPSE"
                          ? { background: "rgba(168, 85, 247, 0.2)", color: "#a855f7", borderColor: "rgba(168, 85, 247, 0.4)" }
                          : { background: "rgba(244, 63, 94, 0.2)", color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.4)" }
                      }
                    >
                      {(cp.hazard_type || "FLOOD_INUNDATION").replace("_", " ")}
                    </div>
                    <div className="popup-detail">
                      <strong>Impact:</strong> {cp.cascading_impact}
                      <br />
                      {cp.submerged_length_m && (
                        <span><strong>Submerged:</strong> {cp.submerged_length_m} meters<br /></span>
                      )}
                      {cp.distance_to_flood_m !== null && cp.distance_to_flood_m !== undefined && (
                        <span><strong>Flood Proximity:</strong> {cp.distance_to_flood_m}m from boundary<br /></span>
                      )}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--accent-cyan)" }}>
                        Coords: {cp.coordinates[0].toFixed(4)}°N, {cp.coordinates[1].toFixed(4)}°E
                      </span>
                    </div>

                    <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <a
                        href={`https://www.google.com/maps?q=${cp.coordinates[0]},${cp.coordinates[1]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-gmaps"
                      >
                        <Globe size={12} /> Open in Google Maps / Street View
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}

        {/* Healthcare Facilities at Risk */}
        {showInfrastructure &&
          hospitals.map((hosp, idx) => (
            <Marker
              key={`hosp-${idx}`}
              position={hosp.coordinates}
              icon={createMultiHazardIcon("HOSPITAL")}
              eventHandlers={{
                click: () => onMarkerSelect && onMarkerSelect(`HOSP-${idx}`),
              }}
            >
              <Popup>
                <div className="popup-card">
                  <div className="popup-title">{hosp.name}</div>
                  <div
                    className="popup-badge"
                    style={
                      hosp.remaining_viable_routes === 0
                        ? { background: "rgba(244, 63, 94, 0.25)", color: "#f43f5e", borderColor: "#f43f5e", fontWeight: "700" }
                        : { background: "rgba(16, 185, 129, 0.2)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }
                    }
                  >
                    {hosp.remaining_viable_routes === 0
                      ? "🚨 0 VIABLE ROUTES - AIRLIFT MANDATORY"
                      : `${hosp.remaining_viable_routes} VIABLE ROUTE(S)`}
                  </div>
                  <div className="popup-detail">
                    <strong>Severed Routes:</strong> {hosp.severed_access_routes} access corridor(s) flooded.
                    <br />
                    {hosp.remaining_viable_routes === 0 ? (
                      <span style={{ color: "#f43f5e", fontWeight: "600" }}>
                        Ground access completely impassable. Rotary-wing airforce airlift dispatched.
                      </span>
                    ) : (
                      <span style={{ color: "#10b981" }}>
                        Ambulance access operational via high-ground bypass.
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <a
                      href={`https://www.google.com/maps?q=${hosp.coordinates[0]},${hosp.coordinates[1]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gmaps"
                    >
                      <Globe size={12} /> Open in Google Maps / Street View
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
