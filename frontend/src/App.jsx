import React, { useState, useEffect } from "react";
import MapCanvas from "./components/MapCanvas";
import { KELANI_TELEMETRY, KELANI_PLAYBOOK } from "./data/telemetryData";
import { ShieldAlert, Download, Radio, Send, Navigation, Activity, Layers, Zap, MapPin, ExternalLink } from "lucide-react";

export default function App() {
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [activeAssetId, setActiveAssetId] = useState(null);
  const [liveTelemetry, setLiveTelemetry] = useState(KELANI_TELEMETRY);
  const [livePlaybook, setLivePlaybook] = useState(KELANI_PLAYBOOK);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleCiteClick = (coords, assetId) => {
    setSelectedCoords(coords);
    setActiveAssetId(assetId);
  };

  const runLiveAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region_name: "Eastern & Central Provinces (Cyclone Ditwah 2025)",
          bounding_box: [80.5, 6.5, 81.9, 8.5],
          baseline_dates: ["2025-11-01", "2025-11-20"],
          event_dates: ["2025-11-28", "2025-12-04"]
        })
      });
      const data = await response.json();
      setLivePlaybook(data.playbook);
      setLiveTelemetry(data.telemetry);
    } catch (err) {
      console.error("Failed to run analysis:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportPlaybook = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(livePlaybook, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "ditwah_mitigation_playbook.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="app-container">
      <header className="top-nav">
        <div className="brand-section">
          <div className="brand-logo"><Radio size={20} color="#fff" /></div>
          <div className="brand-title">Climate Copilot<span className="brand-badge">Vertex AI + SAR</span></div>
        </div>

        <div className="nav-metrics">
          <div className="metric-pill">
            <span className="metric-label">Flooded Extent</span>
            <span className="metric-value">{liveTelemetry?.satellite_metrics?.flooded_area_sq_km || 0} km²</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">72h Rainfall</span>
            <span className="metric-value">{liveTelemetry?.satellite_metrics?.chirps_72h_rainfall_mm || 0} mm</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Exposed Pop.</span>
            <span className="metric-value">{liveTelemetry?.satellite_metrics?.exposed_population?.toLocaleString() || 0}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Submerged Roads</span>
            <span className="metric-value">{liveTelemetry?.bigquery_gis_impacts?.submerged_road_km || 0} km</span>
          </div>
        </div>

        <div className="nav-actions">
          <button 
            className="btn-export" 
            onClick={runLiveAnalysis} 
            disabled={isAnalyzing}
            style={isAnalyzing ? { opacity: 0.5, cursor: "wait" } : { background: "rgba(244, 63, 94, 0.15)", borderColor: "#f43f5e", color: "#f43f5e" }}
          >
            <Activity size={14} />
            {isAnalyzing ? "Analyzing SAR..." : "Run AI Analysis"}
          </button>
          <button className="btn-export" onClick={handleExportPlaybook} title="Export Emergency Playbook">
            <Download size={14} />
            Export Playbook
          </button>
        </div>
      </header>

      <main className="split-screen">
        <MapCanvas selectedChokepointCoords={selectedCoords} onMarkerSelect={(id) => setActiveAssetId(id)} />
        
        <aside className="right-panel">
          <div className="panel-header">
            <div className="panel-title">
              <ShieldAlert size={20} color="#f43f5e" />
              AI Mitigation Playbook
            </div>
            <span className={livePlaybook?.risk_level === "CRITICAL" ? "risk-badge-critical" : ""} style={livePlaybook?.risk_level !== "CRITICAL" ? { color: "#10b981", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.4)", padding: "3px 10px", borderRadius: "20px", fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: "700" } : {}}>
              {livePlaybook?.risk_level || "UNKNOWN"}
            </span>
          </div>

          <div className="playbook-summary-box">
            <div className="section-label"><Activity size={13} />Executive Multimodal Briefing</div>
            <p className="playbook-summary-text">{livePlaybook?.executive_summary}</p>
          </div>

          <div className="playbook-summary-box" style={{ borderColor: "rgba(6, 182, 212, 0.25)" }}>
            <div className="section-label" style={{ color: "#06b6d4" }}><Layers size={13} />Radar Backscatter Verification</div>
            <p className="playbook-summary-text">{livePlaybook?.visual_sar_verification}</p>
          </div>

          <div>
            <div className="section-label"><Zap size={13} color="#f59e0b" />Prioritized Chokepoints (Click to Pan Map)</div>
            {livePlaybook?.prioritized_chokepoints && livePlaybook.prioritized_chokepoints.length > 0 ? (
              livePlaybook.prioritized_chokepoints.map((cp, idx) => (
                <div key={idx} className="chokepoint-card" onClick={() => handleCiteClick(cp.coordinates, cp.asset_id)}>
                  <div className="chokepoint-title">
                    <span>{cp.asset_name}</span>
                    <span className="chokepoint-metric-tag">[Cite: {cp.cited_metric}]</span>
                  </div>
                  <div className="chokepoint-desc">{cp.vulnerability_reason}</div>
                </div>
              ))
            ) : (
              <div className="chokepoint-card" style={{ cursor: "default", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                <div className="chokepoint-title" style={{ color: "#10b981" }}><span>No Critical Chokepoints Detected</span></div>
              </div>
            )}
          </div>

          <div className="reroute-box" style={livePlaybook?.supply_reroutes?.length ? {} : { borderColor: "rgba(16, 185, 129, 0.3)", background: "rgba(16, 185, 129, 0.05)" }}>
            <div className="reroute-title">
              <Navigation size={15} style={{ display: "inline", marginRight: "6px" }} />
              {livePlaybook?.supply_reroutes?.length ? "Recommended Bypass Route" : "Logistics Corridors Status"}
            </div>
            <p className="reroute-text">
              {livePlaybook?.supply_reroutes && livePlaybook.supply_reroutes.length > 0 ? (
                <>
                  <strong>{livePlaybook.supply_reroutes[0].recommended_bypass}</strong><br />
                  Target: {livePlaybook.supply_reroutes[0].target_fleet} • Delay: +{livePlaybook.supply_reroutes[0].estimated_delay_mins} mins
                </>
              ) : (
                <span>All primary highway arteries are operating with zero flood delays.</span>
              )}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
