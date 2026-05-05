"""
arivu.dashboard.backend.routers.visualize
──────────────────────────────────────────
Proxy endpoint for the Thesys C1 Generative UI API.

Takes a user question + SQL + raw query result from the Arivu pipeline
and generates an interactive UI (charts, tables, cards) via Thesys C1.

Requires THESYS_API_KEY in environment.  If missing, returns a clear
error so the frontend can hide the Visualize button gracefully.
"""

import asyncio
import json
import os
import logging

from fastapi import APIRouter, Body, HTTPException

logger = logging.getLogger("arivu.dashboard.visualize")

router = APIRouter(prefix="/api")

# ── Thesys C1 system prompt ─────────────────────────────────────────────────
VISUALIZE_SYSTEM_PROMPT = """\
You are a chart renderer. Output ONLY a single chart visualization.

ABSOLUTE RULES — VIOLATING ANY OF THESE IS FORBIDDEN:
1. Output EXACTLY ONE chart (bar chart, line chart, pie chart, or donut chart). Nothing else.
2. Do NOT output any text, paragraphs, headings, titles, descriptions, or summaries.
3. Do NOT output stat cards, KPI cards, metric cards, or any card-like UI.
4. Do NOT output tables.
5. Do NOT add any wrapper, container, or explanatory content around the chart.
6. The chart must use the provided data rows directly — never fabricate data.
7. Include axis labels and a legend only if there are multiple data series.
8. THEME: Use {theme} theme colors — {theme_desc}.
"""


@router.post("/visualize")
async def api_visualize(req: dict = Body(...)):
    """
    Generate a Thesys C1 Generative UI response from pipeline data.

    Expected body:
        {
            "question": "Show me revenue by month",
            "sql": "SELECT ...",
            "data": [{"month": "Jan", "revenue": 1200}, ...]
        }
    """
    api_key = os.environ.get("THESYS_API_KEY", "sk-th-JHIxIcqEkl2NIDiUb7JDulQKHpdQ9yVg3DWSweHxx2CYV8qITPPit7cziq5qmz6PMkHQn8rpzC32ORriKhkt6c9VdCxkUzYUVDqL")
    if not api_key:
        raise HTTPException(
            status_code=501,
            detail="Thesys C1 is not configured. Set the THESYS_API_KEY environment variable.",
        )

    question = req.get("question", "")
    sql = req.get("sql", "")
    data = req.get("data", [])
    theme = req.get("theme", "dark")

    if not data:
        raise HTTPException(status_code=400, detail="No data provided for visualization.")

    # Truncate large datasets to keep C1 context window reasonable
    max_rows = 500
    truncated = len(data) > max_rows
    vis_data = data[:max_rows]

    # Build theme-aware system prompt
    theme_desc = (
        "dark backgrounds (#09090b), light text (#fafafa), muted borders (#27272a), vibrant chart colors on dark"
        if theme == "dark"
        else "white backgrounds (#ffffff), dark text (#09090b), light borders (#e4e4e7), vibrant chart colors on light"
    )
    system_prompt = VISUALIZE_SYSTEM_PROMPT.format(theme=theme, theme_desc=theme_desc)

    user_content = (
        f"Generate ONLY a single chart for this data. No text, no cards, no descriptions.\n"
        f"Question: {question}\n"
        f"SQL: {sql}\n"
        f"Data ({len(vis_data)} rows{' — truncated' if truncated else ''}):\n"
        f"{json.dumps(vis_data, default=str)}"
    )

    def _call_c1():
        try:
            from openai import OpenAI
        except ImportError:
            raise RuntimeError(
                "The 'openai' package is required for Thesys C1 integration. "
                "Install with: pip install openai"
            )

        client = OpenAI(
            api_key=api_key,
            base_url="https://api.thesys.dev/v1/embed",
        )

        completion = client.chat.completions.create(
            model="c1/google/gemini-3-flash/v-20251230",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        )
        return completion.choices[0].message.content

    try:
        c1_response = await asyncio.to_thread(_call_c1)
        logger.info(f"[visualize] C1 response generated ({len(c1_response)} chars)")
        return {"c1_response": c1_response}
    except Exception as exc:
        logger.error(f"[visualize] C1 API call failed: {exc}")
        raise HTTPException(status_code=502, detail=f"Thesys C1 API error: {str(exc)}")
