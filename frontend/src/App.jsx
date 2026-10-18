import React, { useState, useEffect } from "react";
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
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Mountain,
  Droplets,
  Truck,
  CheckCircle2,
  Clock,
  Globe,
  Sliders,
  Flame,
  HeartPulse
} from "lucide-react";

export default function App() {
  const [activeMode, setActiveMode] = useState("ditwah_2025");
  const [activeZone, setActiveZone] = useState("central_kandy");
  const [rainfallMultiplier, setRainfallMultiplier] = useState(1.0);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [activeAssetId, setActiveAssetId] = useState(null);
  const [liveTelemetry, setLiveTelemetry] = useState(KELANI_TELEMETRY);
  const [livePlaybook, setLivePlaybook] = useState(KELANI_PLAYBOOK);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("risk"); // "risk", "logistics", "dispatch"
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [dispatchingTopic, setDispatchingTopic] = useState(null);

  // Fetch analysis for active mode, zone, and surge multiplier
  const runAnalysis = async (mode = activeMode, zone = activeZone, multiplier = rainfallMultiplier) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone_id: zone,
          mode: mode,
          rainfall_simulation_multiplier: multiplier,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setLivePlaybook(data.playbook);
        setLiveTelemetry(data.telemetry);
      }
    } catch (err) {
      console.error("Failed to execute multi-hazard analysis:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run initial fetch on mount
  useEffect(() => {
    runAnalysis("ditwah_2025", "central_kandy", 1.0);
  }, []);

  const handleModeChange = (newMode) => {
    setActiveMode(newMode);
    runAnalysis(newMode, activeZone, rainfallMultiplier);
  };

  const handleZoneChange = (newZone) => {
    setActiveZone(newZone);
    setSelectedCoords(null);
    runAnalysis(activeMode, newZone, rainfallMultiplier);
  };

  const handleRainfallChange = (newMultiplier) => {
    setRainfallMultiplier(newMultiplier);
    runAnalysis(activeMode, activeZone, newMultiplier);
  };

  const handleCiteClick = (coords, assetId) => {
    setSelectedCoords(coords);
    setActiveAssetId(assetId);
  };

  const handleExecuteDispatch = async (dispatch) => {
    setDispatchingTopic(dispatch.topic);
    try {
      const response = await fetch("/api/simulate-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dispatch),
      });
      if (response.ok) {
        const receipt = await response.json();
        setDispatchLogs((prev) => [receipt, ...prev]);
        setActiveTab("dispatch");
      }
    } catch (err) {
      console.error("Failed to execute simulated Pub/Sub dispatch:", err);
    } finally {
      setDispatchingTopic(null);
    }
  };

  const handleExportPlaybook = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(livePlaybook, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `${activeZone}_${activeMode}_mitigation_playbook.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const metrics = liveTelemetry?.satellite_metrics || {};
  const gis = liveTelemetry?.bigquery_gis_impacts || {};
  const logistics = liveTelemetry?.humanitarian_logistics || {};

  return (
    <div className="app-container">
      {/* ====================================================================
          Top Command Bar
          ==================================================================== */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="brand-logo">
            <Radio size={20} color="#fff" />
          </div>
          <div className="brand-title">
            Climate Copilot
            <span className="brand-badge">Multi-Hazard Command</span>
          </div>
        </div>

        {/* Mode Toggle Pills */}
        <div className="mode-toggle-group">
          <button
            className={`mode-pill ${activeMode === "ditwah_2025" ? "active-ditwah" : ""}`}
            onClick={() => handleModeChange("ditwah_2025")}
            title="Calibrated with DMC Gazette 2465/08 & UNDP Cyclone Ditwah Ground Truth"
          >
            <span className="mode-dot-red"></span>
            Cyclone Ditwah (Nov 2025 Replay)
          </button>
          <button
            className={`mode-pill ${activeMode === "live_2026" ? "active-live" : ""}`}
            onClick={() => handleModeChange("live_2026")}
            title="Near-Real-Time Sentinel-1 SAR & CHIRPS Feed"
          >
            <span className="mode-dot-green"></span>
            Live Sentinel-1 Feed (Today)
          </button>
        </div>

        {/* Theater / Zone Selector */}
        <div className="zone-selector-wrapper">
          <select
            className="zone-select"
            value={activeZone}
            onChange={(e) => handleZoneChange(e.target.value)}
          >
            <option value="sri_lanka_national">🇱🇰 All Sri Lanka (National Command Overview)</option>
            <option value="central_kandy">⛰️ Central Highlands (Kandy / Gampola - Landslides & Floods)</option>
            <option value="western_kelani">🌊 Western Basin (Colombo / Kelani / Ja-Ela - Inundation)</option>
            <option value="eastern_northern">🌀 Eastern & Northern Coast (Batticaloa / Mullaitivu - Surge)</option>
          </select>
        </div>

        {/* Actions */}
        <div className="nav-actions">
          <button
            className="btn-export"
            onClick={() => runAnalysis(activeMode, activeZone, rainfallMultiplier)}
            disabled={isAnalyzing}
            style={
              isAnalyzing
                ? { opacity: 0.5, cursor: "wait" }
                : {
                    background: "rgba(6, 182, 212, 0.15)",
                    borderColor: "#06b6d4",
                    color: "#06b6d4",
                  }
            }
          >
            <RefreshCw size={14} className={isAnalyzing ? "spin" : ""} />
            {isAnalyzing ? "Analyzing SAR..." : "Run AI Analysis"}
          </button>
          <button
            className="btn-export"
            onClick={handleExportPlaybook}
            title="Export Emergency Playbook as JSON"
          >
            <Download size={14} />
            Export Playbook
          </button>
        </div>
      </header>

      {/* ====================================================================
          Expanded 6-KPI Ribbon
          ==================================================================== */}
      <section className="kpi-ribbon">
        <div className="kpi-card">
          <div className="kpi-label"><Droplets size={12} color="#06b6d4" /> Flooded Area</div>
          <div className="kpi-value">{metrics.flooded_area_sq_km || 0} <span className="kpi-unit">km²</span></div>
        </div>

        <div className="kpi-card" style={{ borderColor: "rgba(245, 158, 11, 0.3)" }}>
          <div className="kpi-label" style={{ color: "#f59e0b" }}><Mountain size={12} /> Landslide Risk Zone</div>
          <div className="kpi-value" style={{ color: "#f59e0b" }}>{metrics.landslide_high_risk_sq_km || 0} <span className="kpi-unit">km²</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label"><Activity size={12} color="#3b82f6" /> 72h Rainfall</div>
          <div className="kpi-value">{metrics.chirps_72h_rainfall_mm || 0} <span className="kpi-unit">mm</span></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label"><HeartPulse size={12} color="#ec4899" /> Exposed Population</div>
          <div className="kpi-value">{metrics.exposed_population?.toLocaleString() || 0}</div>
        </div>

        <div className="kpi-card" style={{ borderColor: "rgba(244, 63, 94, 0.3)" }}>
          <div className="kpi-label" style={{ color: "#f43f5e" }}><AlertTriangle size={12} /> Submerged Roads / Bridges</div>
          <div className="kpi-value" style={{ color: "#f43f5e" }}>
            {gis.submerged_road_km || 0} <span className="kpi-unit">km</span>
            <span className="kpi-sub">({metrics.damaged_bridges_count || 0} bridges)</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderColor: "rgba(16, 185, 129, 0.3)" }}>
          <div className="kpi-label" style={{ color: "#10b981" }}><Truck size={12} /> Displaced in Camps</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>
            {logistics.displaced_persons?.toLocaleString() || 0}
            <span className="kpi-sub">({logistics.active_relief_camps || 0} camps)</span>
          </div>
        </div>
      </section>

      {/* ====================================================================
          Main Split Screen: Map (Left) + 3-Tab Command Drawer (Right)
          ==================================================================== */}
      <main className="split-screen">
        <MapCanvas
          liveTelemetry={liveTelemetry}
          livePlaybook={livePlaybook}
          activeZone={activeZone}
          activeMode={activeMode}
          selectedChokepointCoords={selectedCoords}
          onMarkerSelect={(id) => setActiveAssetId(id)}
          rainfallMultiplier={rainfallMultiplier}
          onRainfallChange={handleRainfallChange}
        />

        <aside className="right-panel">
          {/* Drawer Top Header */}
          <div className="panel-header">
            <div className="panel-title">
              <ShieldAlert size={20} color="#f43f5e" />
              Disaster Operations Drawer
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span
                className={livePlaybook?.risk_level === "CRITICAL" ? "risk-badge-critical" : ""}
                style={
                  livePlaybook?.risk_level !== "CRITICAL"
                    ? {
                        color: "#10b981",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.72rem",
                        fontWeight: "700",
                      }
                    : {}
                }
              >
                {livePlaybook?.risk_level || "UNKNOWN"}
              </span>
              <span className="confidence-pill">
                {Math.round((livePlaybook?.confidence_score || 0.94) * 100)}% AI Grounded
              </span>
            </div>
          </div>

          {/* 3 Operational Tabs Navigation */}
          <div className="drawer-tabs">
            <button
              className={`drawer-tab-btn ${activeTab === "risk" ? "active" : ""}`}
              onClick={() => setActiveTab("risk")}
            >
              🎯 AI Risk & Chokepoints
            </button>
            <button
              className={`drawer-tab-btn ${activeTab === "logistics" ? "active" : ""}`}
              onClick={() => setActiveTab("logistics")}
            >
              🏥 Relief & Logistics
            </button>
            <button
              className={`drawer-tab-btn ${activeTab === "dispatch" ? "active" : ""}`}
              onClick={() => setActiveTab("dispatch")}
            >
              📡 Live Pub/Sub ({livePlaybook?.pubsub_dispatches?.length || 0})
            </button>
          </div>

          {/* TAB 1: 🎯 AI RISK & CHOKEPOINTS */}
          {activeTab === "risk" && (
            <div className="tab-content">
              {/* Executive Briefing */}
              <div className="playbook-summary-box">
                <div className="section-label">
                  <Activity size={13} />
                  Executive Multimodal Briefing
                </div>
                <p className="playbook-summary-text">{livePlaybook?.executive_summary}</p>
              </div>

              {/* Geotechnical & Radar Verification */}
              <div className="playbook-summary-box" style={{ borderColor: "rgba(6, 182, 212, 0.3)" }}>
                <div className="section-label" style={{ color: "#06b6d4" }}>
                  <Layers size={13} />
                  Radar Backscatter & Geotechnical Verification
                </div>
                <p className="playbook-summary-text">{livePlaybook?.visual_sar_verification}</p>
              </div>

              {/* Prioritized Chokepoints */}
              <div>
                <div className="section-label">
                  <Zap size={13} color="#f59e0b" />
                  Prioritized Chokepoints (Click to Pan Map)
                </div>
                {livePlaybook?.prioritized_chokepoints &&
                livePlaybook.prioritized_chokepoints.length > 0 ? (
                  livePlaybook.prioritized_chokepoints.map((cp, idx) => (
                    <div
                      key={idx}
                      className="chokepoint-card"
                      onClick={() => handleCiteClick(cp.coordinates, cp.asset_id)}
                    >
                      <div className="chokepoint-title">
                        <span>{cp.asset_name}</span>
                        <span className="chokepoint-metric-tag">[Cite: {cp.cited_metric}]</span>
                      </div>
                      <div className="chokepoint-desc">{cp.vulnerability_reason}</div>
                      <div className="chokepoint-footer">
                        <a
                          href={`https://www.google.com/maps?q=${cp.coordinates[0]},${cp.coordinates[1]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-gmaps"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe size={11} /> Open in Google Maps
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="chokepoint-card" style={{ cursor: "default" }}>
                    <div className="chokepoint-title" style={{ color: "#10b981" }}>
                      <span>No Critical Chokepoints Detected</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: 🏥 RELIEF & LOGISTICS CALCULATOR */}
          {activeTab === "logistics" && (
            <div className="tab-content">
              {/* Sphere Standard Logistics Calculator Grid */}
              <div className="section-label" style={{ color: "#10b981" }}>
                <Truck size={13} /> Sphere-Standard Relief Requirements
              </div>
              <div className="logistics-grid">
                <div className="logistics-card">
                  <div className="logistics-label">Active Safe Centers</div>
                  <div className="logistics-value">{logistics.active_relief_camps || 0}</div>
                  <div className="logistics-sub">Evacuation shelters</div>
                </div>

                <div className="logistics-card">
                  <div className="logistics-label">Displaced Persons (IDPs)</div>
                  <div className="logistics-value">{logistics.displaced_persons?.toLocaleString() || 0}</div>
                  <div className="logistics-sub">Verified count</div>
                </div>

                <div className="logistics-card" style={{ borderColor: "rgba(6, 182, 212, 0.4)" }}>
                  <div className="logistics-label" style={{ color: "#06b6d4" }}>Drinking Water Demand</div>
                  <div className="logistics-value" style={{ color: "#06b6d4" }}>
                    {logistics.daily_drinking_water_liters?.toLocaleString() || 0} <span className="kpi-unit">L/day</span>
                  </div>
                  <div className="logistics-sub">15L / person / day (Sphere standard)</div>
                </div>

                <div className="logistics-card">
                  <div className="logistics-label">Medical Trauma Kits</div>
                  <div className="logistics-value">{logistics.medical_trauma_kits_required || 0}</div>
                  <div className="logistics-sub">Surgical & emergency packs</div>
                </div>

                <div className="logistics-card" style={{ borderColor: "rgba(245, 158, 11, 0.4)" }}>
                  <div className="logistics-label" style={{ color: "#f59e0b" }}>UNDP Debris Volume</div>
                  <div className="logistics-value" style={{ color: "#f59e0b" }}>
                    {logistics.estimated_debris_cubic_meters?.toLocaleString() || 0} <span className="kpi-unit">m³</span>
                  </div>
                  <div className="logistics-sub">80m³ / destroyed structure</div>
                </div>
              </div>

              {/* Healthcare Facilities Status */}
              <div style={{ marginTop: "18px" }}>
                <div className="section-label" style={{ color: "#f43f5e" }}>
                  <HeartPulse size={13} /> Healthcare Facilities Accessibility
                </div>
                {gis.hospitals_at_risk && gis.hospitals_at_risk.length > 0 ? (
                  gis.hospitals_at_risk.map((hosp, idx) => (
                    <div
                      key={idx}
                      className="chokepoint-card"
                      onClick={() => handleCiteClick(hosp.coordinates, `HOSP-${idx}`)}
                    >
                      <div className="chokepoint-title">
                        <span>{hosp.name}</span>
                        {hosp.remaining_viable_routes === 0 ? (
                          <span className="badge-airlift">🚨 AIRLIFT REQUIRED</span>
                        ) : (
                          <span className="chokepoint-metric-tag" style={{ color: "#10b981", borderColor: "#10b981" }}>
                            {hosp.remaining_viable_routes} viable route(s)
                          </span>
                        )}
                      </div>
                      <div className="chokepoint-desc">
                        {hosp.severed_access_routes} access road(s) inundated.{" "}
                        {hosp.remaining_viable_routes === 0
                          ? "Ground vehicles completely cut off. Rotary-wing helicopter evacuation mandatory."
                          : "High-ground emergency detour operational."}
                      </div>
                      <div className="chokepoint-footer">
                        <a
                          href={`https://www.google.com/maps?q=${hosp.coordinates[0]},${hosp.coordinates[1]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-gmaps"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe size={11} /> View Hospital on Google Maps
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="chokepoint-desc">All regional healthcare facilities fully accessible.</div>
                )}
              </div>

              {/* Recommended High-Ground Bypass Routes */}
              <div style={{ marginTop: "18px" }}>
                <div className="section-label" style={{ color: "#10b981" }}>
                  <Navigation size={13} /> Recommended Bypass Corridors
                </div>
                {livePlaybook?.supply_reroutes && livePlaybook.supply_reroutes.length > 0 ? (
                  livePlaybook.supply_reroutes.map((r, idx) => (
                    <div key={idx} className="reroute-box" style={{ marginBottom: "10px" }}>
                      <div className="reroute-title">
                        <Navigation size={14} style={{ display: "inline", marginRight: "6px" }} />
                        {r.recommended_bypass}
                      </div>
                      <p className="reroute-text">
                        <strong>Blocked:</strong> {r.blocked_corridor}
                        <br />
                        <strong>Target:</strong> {r.target_fleet} • <strong>Delay:</strong> +{r.estimated_delay_mins} mins
                      </p>
                      <div style={{ marginTop: "8px" }}>
                        <a
                          href={`https://www.google.com/maps/search/${encodeURIComponent(r.recommended_bypass + " Sri Lanka")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-gmaps"
                        >
                          <ExternalLink size={11} /> View Route on Google Maps
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="reroute-box">
                    <p className="reroute-text">All primary arterial corridors operating normally.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 📡 LIVE PUB/SUB DISPATCH CONSOLE */}
          {activeTab === "dispatch" && (
            <div className="tab-content">
              <div className="section-label" style={{ color: "#06b6d4" }}>
                <Send size={13} /> Inter-Agency Pub/Sub Directives
              </div>

              {livePlaybook?.pubsub_dispatches && livePlaybook.pubsub_dispatches.length > 0 ? (
                livePlaybook.pubsub_dispatches.map((dispatch, idx) => (
                  <div key={idx} className="dispatch-card">
                    <div className="dispatch-header">
                      <span className="dispatch-topic">{dispatch.topic}</span>
                      <span
                        className="dispatch-urgency"
                        style={
                          dispatch.urgency === "IMMEDIATE"
                            ? { color: "#f43f5e", borderColor: "#f43f5e" }
                            : dispatch.urgency === "CRITICAL"
                            ? { color: "#f59e0b", borderColor: "#f59e0b" }
                            : { color: "#10b981", borderColor: "#10b981" }
                        }
                      >
                        {dispatch.urgency}
                      </span>
                    </div>
                    <div className="dispatch-recipient">Recipient: {dispatch.recipient}</div>
                    <div className="dispatch-directive">{dispatch.directive}</div>
                    <button
                      className="btn-dispatch-action"
                      onClick={() => handleExecuteDispatch(dispatch)}
                      disabled={dispatchingTopic === dispatch.topic}
                    >
                      <Send size={12} />
                      {dispatchingTopic === dispatch.topic ? "Publishing to GCP..." : "🚀 Execute Pub/Sub Dispatch"}
                    </button>
                  </div>
                ))
              ) : (
                <div className="chokepoint-desc">No active dispatches required for current threat level.</div>
              )}

              {/* Terminal Audit Log of Dispatched Receipts */}
              <div style={{ marginTop: "20px" }}>
                <div className="section-label">
                  <Clock size={13} /> Real-Time DMC Dispatch Audit Stream
                </div>
                <div className="terminal-stream">
                  <div className="terminal-header">
                    <span>STATUS: ACTIVE DISPATCH BUS</span>
                    <span>PROTOCOL: GOOGLE CLOUD PUB/SUB</span>
                  </div>
                  {dispatchLogs.length > 0 ? (
                    dispatchLogs.map((log, idx) => (
                      <div key={idx} className="receipt-item">
                        <div className="receipt-row">
                          <span className="receipt-badge">
                            <CheckCircle2 size={11} color="#10b981" /> {log.status}
                          </span>
                          <span className="receipt-time">{new Date(log.timestamp_utc).toLocaleTimeString()}</span>
                        </div>
                        <div className="receipt-meta">ID: {log.message_id} • Ack: {log.ack_id}</div>
                        <div className="receipt-topic">Topic: {log.topic}</div>
                        <div className="receipt-directive">"{log.directive.slice(0, 95)}..."</div>
                      </div>
                    ))
                  ) : (
                    <div className="terminal-line" style={{ color: "#64748b" }}>
                      Waiting for dispatch execution... Click any dispatch card above to publish.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
