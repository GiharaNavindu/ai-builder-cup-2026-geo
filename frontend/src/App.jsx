import React, { useState } from "react";
import MapCanvas from "./components/MapCanvas";
import { KELANI_TELEMETRY, KELANI_PLAYBOOK } from "./data/telemetryData";
import {
  ShieldAlert,
  Download,
  Radio,
  Send,
  Navigation,
  Activity,
  Layers,
  Zap,
  MapPin,
  ExternalLink
} from "lucide-react";

export default function App() {
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [activeAssetId, setActiveAssetId] = useState(null);

  // Handle citation chip clicks from AI playbook to fly to coordinates on the map
  const handleCiteClick = (coords, assetId) => {
    setSelectedCoords(coords);
    setActiveAssetId(assetId);
  };

  // Export playbook JSON/PDF handler
  const handleExportPlaybook = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(KELANI_PLAYBOOK, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "emergency_mitigation_playbook_kelani.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="app-container">
      {/* Top Operational Navigation & Telemetry KPI Header */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="brand-logo">
            <Radio size={20} color="#fff" />
          </div>
          <div className="brand-title">
            Climate Copilot
            <span className="brand-badge">Vertex AI + SAR</span>
          </div>
        </div>

        {/* Real-Time Deterministic Telemetry KPIs */}
        <div className="nav-metrics">
          <div className="metric-pill">
            <span className="metric-label">Flooded Extent</span>
            <span className="metric-value">{KELANI_TELEMETRY.satellite_metrics.flooded_area_sq_km} km²</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">72h Rainfall</span>
            <span className="metric-value">{KELANI_TELEMETRY.satellite_metrics.chirps_72h_rainfall_mm} mm</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Exposed Pop.</span>
            <span className="metric-value">{KELANI_TELEMETRY.satellite_metrics.exposed_population.toLocaleString()}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Submerged Roads</span>
            <span className="metric-value">{KELANI_TELEMETRY.bigquery_gis_impacts.submerged_road_km} km</span>
          </div>
        </div>

        <div className="nav-actions">
          <div className="status-indicator">
            <span className="status-dot"></span>
            CLOUD RUN ONLINE
          </div>
          <button className="btn-export" onClick={handleExportPlaybook} title="Export Emergency Playbook">
            <Download size={14} />
            Export Playbook
          </button>
        </div>
      </header>

      {/* Main Split-Screen Command Center */}
      <main className="split-screen">
        {/* Left Side: Geospatial Map Canvas (Kavindu's Domain) */}
        <MapCanvas
          selectedChokepointCoords={selectedCoords}
          onMarkerSelect={(id) => setActiveAssetId(id)}
        />

        {/* Right Side: AI & Operations Drawer (Shared Contract / Gihara Integration Slot) */}
        <aside className="right-panel">
          <div className="panel-header">
            <div className="panel-title">
              <ShieldAlert size={20} color="#f43f5e" />
              AI Mitigation Playbook
            </div>
            <span className="risk-badge-critical">
              {KELANI_PLAYBOOK.risk_level}
            </span>
          </div>

          {/* Multimodal Executive Summary */}
          <div className="playbook-summary-box">
            <div className="section-label">
              <Activity size={13} />
              Executive Multimodal Briefing
            </div>
            <p className="playbook-summary-text">
              {KELANI_PLAYBOOK.executive_summary}
            </p>
          </div>

          {/* SAR Visual Verification */}
          <div className="playbook-summary-box" style={{ borderColor: "rgba(6, 182, 212, 0.25)" }}>
            <div className="section-label" style={{ color: "#06b6d4" }}>
              <Layers size={13} />
              Radar Backscatter Verification
            </div>
            <p className="playbook-summary-text">
              {KELANI_PLAYBOOK.visual_sar_verification}
            </p>
          </div>

          {/* Prioritized Chokepoints with Interactive Map-Pan Citations */}
          <div>
            <div className="section-label">
              <Zap size={13} color="#f59e0b" />
              Prioritized Chokepoints (Click to Pan Map)
            </div>

            {KELANI_PLAYBOOK.prioritized_chokepoints.map((cp, idx) => (
              <div
                key={idx}
                className="chokepoint-card"
                onClick={() => handleCiteClick(cp.coordinates, cp.asset_id)}
                title="Click to pan Leaflet map to this location"
              >
                <div className="chokepoint-title">
                  <span>{cp.asset_name}</span>
                  <span className="chokepoint-metric-tag">[Cite: {cp.cited_metric}]</span>
                </div>
                <div className="chokepoint-desc">{cp.vulnerability_reason}</div>
              </div>
            ))}

            {/* Substation Proximity Alert */}
            <div
              className="chokepoint-card"
              onClick={() => handleCiteClick([6.9482, 79.9915], "OSM-NODE-883921")}
              title="Click to pan Leaflet map to this location"
            >
              <div className="chokepoint-title">
                <span>Biyagama 132kV Grid Substation</span>
                <span className="chokepoint-metric-tag" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b" }}>
                  [Cite: distance_to_flood_m: 115]
                </span>
              </div>
              <div className="chokepoint-desc">
                Inundation threatens power supply to 3 water pumping stations and hospital.
              </div>
            </div>
          </div>

          {/* Supply Reroutes */}
          <div className="reroute-box">
            <div className="reroute-title">
              <Navigation size={15} style={{ display: "inline", marginRight: "6px" }} />
              Recommended Bypass Route
            </div>
            <p className="reroute-text">
              <strong>{KELANI_PLAYBOOK.supply_reroutes[0].recommended_bypass}</strong>
              <br />
              Target: {KELANI_PLAYBOOK.supply_reroutes[0].target_fleet} • Delay: +{KELANI_PLAYBOOK.supply_reroutes[0].estimated_delay_mins} mins
            </p>
          </div>

          {/* Live Cloud Pub/Sub Terminal Feed */}
          <div className="terminal-stream">
            <div className="terminal-header">
              <span>CLOUD PUB/SUB SSE DISPATCH STREAM</span>
              <span style={{ color: "#10b981" }}>LIVE</span>
            </div>
            {KELANI_PLAYBOOK.pubsub_dispatches.map((disp, i) => (
              <div key={i} className="terminal-line">
                <span className="terminal-time">[10:42:01 UTC]</span>
                <span>
                  <strong>{disp.topic}</strong> → {disp.recipient}: "{disp.directive.slice(0, 48)}..."
                </span>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
