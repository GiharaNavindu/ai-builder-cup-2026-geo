import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  Marker,
  Popup,
  useMap
} from "react-leaflet";
import L from "leaflet";
import {
  Layers,
  Sliders,
  AlertTriangle,
  Zap,
  Activity,
  Compass,
  Eye,
  Navigation
} from "lucide-react";
import { MAP_GEOJSON_FEATURES } from "../data/telemetryData";

// Fix for default Leaflet icon paths in Vite / React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom HTML Pulsing Beacon Icons
const createPulsingIcon = (type = "danger") => {
  const isDanger = type === "danger";
  const isWarning = type === "warning";
  const isHospital = type === "hospital";

  const coreClass = isHospital
    ? "marker-core-hospital"
    : isDanger
    ? "marker-core-danger"
    : "marker-core-warning";

  const pingHtml = isHospital
    ? ""
    : `<div class="radar-ping" style="border-color: ${isDanger ? "#f43f5e" : "#f59e0b"};"></div>`;

  const innerText = isHospital ? "H" : "";

  return L.divIcon({
    className: "custom-pulsing-marker",
    html: `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        ${pingHtml}
        <div class="${coreClass}">${innerText}</div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Component to handle programmatic map pan/zoom (flyTo)
function MapPanController({ targetCoords, zoom = 15 }) {
  const map = useMap();

  useEffect(() => {
    if (targetCoords && targetCoords.length === 2) {
      map.flyTo(targetCoords, zoom, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    }
  }, [targetCoords, zoom, map]);

  return null;
}

export default function MapCanvas({
  selectedChokepointCoords,
  onMarkerSelect,
  floodTileUrl,
}) {
  const initialCenter = [6.940, 79.988];
  const [activePan, setActivePan] = useState(null);
  const [sarOpacity, setSarOpacity] = useState(0.85);
  const [showFloodMask, setShowFloodMask] = useState(true);
  const [showInfrastructure, setShowInfrastructure] = useState(true);
  const [showBypassRoutes, setShowBypassRoutes] = useState(true);

  // Synchronize target pan if passed from parent (e.g. from Gihara's citation cards)
  useEffect(() => {
    if (selectedChokepointCoords) {
      setActivePan(selectedChokepointCoords);
    }
  }, [selectedChokepointCoords]);

  // Extract layers from GeoJSON
  const floodedRoads = MAP_GEOJSON_FEATURES.features.filter(
    (f) => f.properties.type === "flooded_highway"
  );
  const bypassRoutes = MAP_GEOJSON_FEATURES.features.filter(
    (f) => f.properties.type === "recommended_bypass"
  );
  const floodPolygons = MAP_GEOJSON_FEATURES.features.filter(
    (f) => f.properties.type === "flood_extent"
  );

  return (
    <div className="map-canvas-container">
      {/* Floating HUD: Location & Quick-Pan Navigation */}
      <div className="map-hud-top-left">
        <div className="hud-card">
          <div className="hud-title-row">
            <div className="hud-title">
              <Compass size={18} color="#06b6d4" />
              Kelani River Basin
            </div>
            <span className="brand-badge">S-1 SAR ACTIVE</span>
          </div>
          <div className="hud-subtitle">
            Kaduwela – Biyagama Corridor • 6.94° N, 79.99° E
          </div>

          <div className="quick-pan-bar">
            <button
              className="pan-btn"
              onClick={() => setActivePan([6.9358, 79.9842])}
            >
              <AlertTriangle size={13} color="#f43f5e" />
              AB10 Bridge
            </button>
            <button
              className="pan-btn"
              onClick={() => setActivePan([6.9482, 79.9915])}
            >
              <Zap size={13} color="#f59e0b" />
              132kV Substation
            </button>
            <button
              className="pan-btn"
              onClick={() => setActivePan([6.9431, 80.0012])}
            >
              <Activity size={13} color="#3b82f6" />
              Hospital
            </button>
            <button
              className="pan-btn"
              onClick={() => setActivePan([6.940, 79.988])}
            >
              Overview
            </button>
          </div>
        </div>
      </div>

      {/* Floating HUD: Bottom SAR Radar Opacity & Layer Dock */}
      <div className="map-hud-bottom">
        <div className="slider-group">
          <span className="slider-label">
            <Sliders size={14} color="#06b6d4" />
            SAR Opacity: {Math.round(sarOpacity * 100)}%
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sarOpacity}
            onChange={(e) => setSarOpacity(parseFloat(e.target.value))}
            className="sar-slider"
            title="Slide to compare Baseline SAR vs Flood Inundation"
          />
        </div>

        <button
          className={`layer-toggle-btn ${showFloodMask ? "active" : ""}`}
          onClick={() => setShowFloodMask(!showFloodMask)}
        >
          <Layers size={13} />
          Flood Inundation
        </button>

        <button
          className={`layer-toggle-btn ${showInfrastructure ? "active" : ""}`}
          onClick={() => setShowInfrastructure(!showInfrastructure)}
        >
          <Zap size={13} />
          Threatened Assets
        </button>

        <button
          className={`layer-toggle-btn ${showBypassRoutes ? "active" : ""}`}
          onClick={() => setShowBypassRoutes(!showBypassRoutes)}
        >
          <Navigation size={13} />
          E02 Bypass
        </button>
      </div>

      {/* Leaflet Map Engine */}
      <MapContainer
        center={initialCenter}
        zoom={13}
        zoomControl={false}
        className="leaflet-map-wrapper"
      >
        <MapPanController targetCoords={activePan} zoom={14} />

        {/* High-Contrast Dark Basemap (Zero API Key Required) */}
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a> &copy; OpenStreetMap contributors'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />

        {/* Sentinel-1 SAR Flood Inundation Tile Layer / Mask */}
        {showFloodMask && floodPolygons.map((poly, idx) => (
          <Polygon
            key={`flood-${idx}`}
            positions={poly.geometry.coordinates[0].map(([lon, lat]) => [lat, lon])}
            pathOptions={{
              color: "#00b4d8",
              weight: 1.5,
              fillColor: "#0284c7",
              fillOpacity: sarOpacity * 0.45,
            }}
          >
            <Popup>
              <div className="popup-card">
                <div className="popup-title">Sentinel-1 SAR Flood Extent</div>
                <div className="popup-badge badge-warning">Change Detection Δ &lt; -3 dB</div>
                <div className="popup-detail">
                  Inundated Area: <strong>18.4 sq km</strong><br />
                  Permanent water and steep terrain masked.
                </div>
              </div>
            </Popup>
          </Polygon>
        ))}

        {/* Flooded Highway Segments (Glowing Red/Rose) */}
        {showInfrastructure && floodedRoads.map((road) => (
          <Polyline
            key={road.id}
            positions={road.geometry.coordinates.map(([lon, lat]) => [lat, lon])}
            pathOptions={{
              color: "#f43f5e",
              weight: 5,
              opacity: 0.95,
              dashArray: "6, 6",
            }}
          >
            <Popup>
              <div className="popup-card">
                <div className="popup-title">{road.properties.name}</div>
                <div className="popup-badge badge-danger">SUBMERGED 850m</div>
                <div className="popup-detail">
                  Primary highway connection severed. Ambulances cannot cross the Kelani Bridge approach.
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* AI-Recommended Bypass Corridor (Glowing Emerald Green) */}
        {showBypassRoutes && bypassRoutes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.geometry.coordinates.map(([lon, lat]) => [lat, lon])}
            pathOptions={{
              color: "#10b981",
              weight: 4,
              opacity: 0.9,
            }}
          >
            <Popup>
              <div className="popup-card">
                <div className="popup-title">{route.properties.name}</div>
                <div className="popup-badge badge-warning" style={{ color: "#10b981", borderColor: "#10b981" }}>
                  HIGH-GROUND BYPASS (+18m)
                </div>
                <div className="popup-detail">
                  Recommended detour for medical supplies and food logistics via Kothalawala interchange.
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Pulsing Infrastructure Markers */}
        {showInfrastructure && (
          <>
            {/* AB10 Highway Chokepoint */}
            <Marker
              position={[6.9358, 79.9842]}
              icon={createPulsingIcon("danger")}
              eventHandlers={{
                click: () => onMarkerSelect && onMarkerSelect("OSM-WAY-109482"),
              }}
            >
              <Popup>
                <div className="popup-card">
                  <div className="popup-title">AB10 Kaduwela Bridge Approach</div>
                  <div className="popup-badge badge-danger">CRITICAL CHOKEPOINT</div>
                  <div className="popup-detail">
                    <strong>850m submerged</strong>. Severs primary ambulance corridor to Biyagama Divisional Hospital.
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Biyagama 132kV Substation */}
            <Marker
              position={[6.9482, 79.9915]}
              icon={createPulsingIcon("warning")}
              eventHandlers={{
                click: () => onMarkerSelect && onMarkerSelect("OSM-NODE-883921"),
              }}
            >
              <Popup>
                <div className="popup-card">
                  <div className="popup-title">Biyagama 132kV Grid Substation</div>
                  <div className="popup-badge badge-warning">PROXIMITY ALERT (115m)</div>
                  <div className="popup-detail">
                    Flood edge is 115m from perimeter. Threatens power supply to 3 water pumping stations and hospital.
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Biyagama Divisional Hospital */}
            <Marker
              position={[6.9431, 80.0012]}
              icon={createPulsingIcon("hospital")}
            >
              <Popup>
                <div className="popup-card">
                  <div className="popup-title">Biyagama Divisional Hospital</div>
                  <div className="popup-badge badge-danger">ACCESS THREATENED</div>
                  <div className="popup-detail">
                    2 access roads inundated; 1 high-ground route remaining viable.
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
}
