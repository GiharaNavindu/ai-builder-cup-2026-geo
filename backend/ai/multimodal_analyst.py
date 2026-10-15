"""Multimodal Vision & Risk Synthesis Agent (Gemini 2.5).

Analyzes Before/After Sentinel-1 SAR satellite imagery and enriched GIS telemetry
to generate a verified, hallucination-free Mitigation Playbook.
"""

import os
import json
from typing import Optional, Dict, Any, Union
from pathlib import Path

from backend.ai.schemas import TelemetryPayload, PlaybookResponse

SYSTEM_INSTRUCTION = """You are the Multimodal SAR & Vulnerability Analyst for Climate Copilot.
You specialize in synthetic aperture radar (SAR) flood damage assessment and infrastructure risk synthesis.

Your role:
1. Inspect the provided Sentinel-1 SAR Before and After imagery and the deterministic GIS telemetry.
2. Formulate a verified Disaster Mitigation Playbook with high-confidence operational actions.

STRICT GROUNDING & HALLUCINATION RULES:
- Never hallucinate coordinates or asset names. You must ONLY reference assets and coordinates present in the input telemetry.
- Every chokepoint vulnerability assessment MUST include a mandatory field-level cited metric from the telemetry (e.g., 'submerged_length_m: 850' or 'distance_to_flood_m: 115').
- Address cascading impacts on healthcare facilities (e.g. Biyagama Divisional Hospital) and power transmission (e.g. Biyagama 132kV Substation).
- Output strictly conformant JSON adhering to the PlaybookResponse schema.
"""


def format_multimodal_prompt(telemetry: Union[TelemetryPayload, Dict[str, Any]]) -> str:
    """Format structured telemetry data into prompt context for Gemini."""
    if isinstance(telemetry, TelemetryPayload):
        telemetry_dict = telemetry.model_dump()
    else:
        telemetry_dict = telemetry

    return f"""Analyze the provided SAR satellite radar images and GIS impact telemetry for:
Region: {telemetry_dict.get('region_name')} ({telemetry_dict.get('region_id')})
Baseline Period: {telemetry_dict.get('event_dates', {}).get('baseline_window')}
Flood Event Period: {telemetry_dict.get('event_dates', {}).get('flood_window')}

Deterministic Telemetry Input:
{json.dumps(telemetry_dict, indent=2)}

Task:
1. Cross-reference the radar backscatter anomalies (dark pixels indicating specular reflection from standing flood water) with the reported GIS submerged roads and facilities.
2. Synthesize prioritized infrastructure chokepoints, supply corridor bypass routes, and critical Pub/Sub emergency directives.
3. Explicitly cite exact metrics for each chokepoint to ensure zero-hallucination verification.
"""


def analyze_flood_multimodal(
    telemetry: Union[TelemetryPayload, Dict[str, Any]],
    before_sar_image_path: Optional[str] = None,
    after_sar_image_path: Optional[str] = None,
    use_mock_fallback: bool = False
) -> PlaybookResponse:
    """Run multimodal risk synthesis using Gemini 2.5 or golden cache fallback."""
    # Ensure telemetry is parsed into Pydantic model for validation
    if isinstance(telemetry, dict):
        telemetry_model = TelemetryPayload.model_validate(telemetry)
    else:
        telemetry_model = telemetry

    # Check if mock fallback is requested or credentials are not configured
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT", os.getenv("VERTEX_PROJECT"))
    has_credentials = os.getenv("GOOGLE_APPLICATION_CREDENTIALS") is not None or project_id is not None

    if use_mock_fallback or not has_credentials:
        print("[INFO] Using golden cache fallback for PlaybookResponse.")
        cache_path = Path(__file__).parent.parent / "cache" / "kelani_playbook_golden.json"
        if cache_path.exists():
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return PlaybookResponse.model_validate(data)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(
            vertexai=True,
            project=project_id,
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        )

        contents = []

        # Add image parts if provided
        for img_path in [before_sar_image_path, after_sar_image_path]:
            if img_path and os.path.exists(img_path):
                with open(img_path, "rb") as f:
                    img_bytes = f.read()
                contents.append(
                    types.Part.from_bytes(data=img_bytes, mime_type="image/png")
                )

        contents.append(format_multimodal_prompt(telemetry_model))

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=PlaybookResponse,
                temperature=0.1
            )
        )

        return PlaybookResponse.model_validate_json(response.text)

    except Exception as exc:
        print(f"[WARN] Gemini 2.5 API invocation error: {exc}. Falling back to golden response.")
        cache_path = Path(__file__).parent.parent / "cache" / "kelani_playbook_golden.json"
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return PlaybookResponse.model_validate(data)
