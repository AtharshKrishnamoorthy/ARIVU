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
import re
import logging
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request

logger = logging.getLogger("arivu.dashboard.visualize")

router = APIRouter(prefix="/api")

_RATE_LIMIT = os.environ.get("ARIVU_VISUALIZE_RATE_LIMIT", "20/minute")

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    _limiter = Limiter(key_func=get_remote_address)
    _rate_limited = _limiter.limit(_RATE_LIMIT)
except ImportError:
    _rate_limited = lambda fn: fn


# ─────────────────────────────────────────────────────────────
# System prompt — strict, no ambiguous "or" branches
# ─────────────────────────────────────────────────────────────

VISUALIZE_SYSTEM_PROMPT = """\
You are a JSX chart renderer. You output ONLY a single JSX self-closing component tag and NOTHING else.

══ HARD OUTPUT RULES (violating any of these breaks the render) ══
1. Your entire response MUST be exactly ONE line starting with < and ending with />
2. NO prose, NO explanation, NO titles, NO markdown, NO code fences, NO comments
3. NO text nodes, NO wrapper divs, NO fragments, NO multi-line output
4. NO "X-Axis:", "Y-Axis:", "Count", "Legend:", "Note:" or any standalone text
5. The tag MUST be self-closing — it ends with />

══ THEME: {theme} ══
You MUST pass theme="{theme}" as a prop.
{theme_instruction}

══ REQUIRED PROPS (include ALL) ══
Every chart MUST include: theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="..." yAxisLabel="..."

══ CHART DECISION TREE — follow top-to-bottom, pick the FIRST match ══

STEP 1 — Count how many NUMERIC columns vs CATEGORICAL columns exist in the data.

STEP 2 — Apply these rules IN ORDER:
  A. 2 categorical cols + 1 numeric col → <Heatmap data={{{{data}}}} xKey="cat1" yKey="cat2" valueKey="num" theme="{theme}" legend={{{{true}}}} />
  B. date/time col + 2+ numeric cols → <MultiLineChart data={{{{data}}}} xKey="date_col" series={{{{["num1","num2"]}}}} theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="Date" yAxisLabel="Value" />
  C. date/time col + 1 numeric col → <AreaChart data={{{{data}}}} xKey="date_col" yKey="num_col" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="Date" yAxisLabel="Value" />
  D. 3+ numeric cols (no date) → <BubbleChart data={{{{data}}}} xKey="num1" yKey="num2" sizeKey="num3" categoryKey="cat" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="num1" yAxisLabel="num2" />
  E. 1 categorical col + 1 numeric col AND <= 5 unique values AND values differ by >20% → <DonutChart data={{{{data}}}} nameKey="cat" valueKey="num" theme="{theme}" legend={{{{true}}}} />
  F. 1 categorical col + 1 numeric col AND values represent pipeline stages/funnel → <FunnelChart data={{{{data}}}} nameKey="cat" valueKey="num" theme="{theme}" legend={{{{true}}}} />
  G. 1 categorical col + 1 numeric col (default) → <BarChart data={{{{data}}}} xKey="cat" yKey="num" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="cat" yAxisLabel="num" />
  H. ONLY categorical cols (no numerics at all, e.g. list of names/tables/tags) → count occurrences of each unique value in the first column, then use <BarChart data={{{{counted_data}}}} xKey="name" yKey="count" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="Name" yAxisLabel="Count" />
  I. 2 categorical cols + no numeric → <BarChart /> grouping by one, counting the other
  J. 1 numeric col only → <HistogramChart data={{{{data}}}} valueKey="num" bins={{{{10}}}} theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} />

CRITICAL RULE FOR RULE H: When data is a list of table names, schema objects, labels, or any purely categorical list with no numeric values — you MUST use BarChart, never PieChart or DonutChart. Pie/Donut are ONLY for when values differ meaningfully AND there are ≤5 items.

══ FULL COMPONENT CATALOGUE (reference for prop names) ══
<BarChart data={{{{data}}}} xKey="col" yKey="val" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="X" yAxisLabel="Y" />
<GroupedBarChart data={{{{data}}}} xKey="col" series={{{{["v1","v2"]}}}} theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="X" yAxisLabel="Y" />
<StackedBarChart data={{{{data}}}} xKey="col" series={{{{["v1","v2"]}}}} theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="X" yAxisLabel="Y" />
<LineChart data={{{{data}}}} xKey="date" yKey="value" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="Date" yAxisLabel="Value" />
<MultiLineChart data={{{{data}}}} xKey="date" series={{{{["v1","v2"]}}}} theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="X" yAxisLabel="Y" />
<AreaChart data={{{{data}}}} xKey="date" yKey="value" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="Date" yAxisLabel="Value" />
<StackedAreaChart data={{{{data}}}} xKey="date" series={{{{["v1","v2"]}}}} theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="X" yAxisLabel="Y" />
<PieChart data={{{{data}}}} nameKey="label" valueKey="value" theme="{theme}" legend={{{{true}}}} />
<DonutChart data={{{{data}}}} nameKey="label" valueKey="value" theme="{theme}" legend={{{{true}}}} />
<ScatterChart data={{{{data}}}} xKey="x" yKey="y" categoryKey="type" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="X" yAxisLabel="Y" />
<BubbleChart data={{{{data}}}} xKey="x" yKey="y" sizeKey="size" categoryKey="type" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} xAxisLabel="X" yAxisLabel="Y" />
<Heatmap data={{{{data}}}} xKey="cat1" yKey="cat2" valueKey="value" theme="{theme}" legend={{{{true}}}} />
<HistogramChart data={{{{data}}}} valueKey="numeric_val" bins={{{{10}}}} theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} />
<FunnelChart data={{{{data}}}} nameKey="stage" valueKey="count" theme="{theme}" legend={{{{true}}}} />
<WaterfallChart data={{{{data}}}} categoryKey="stage" valueKey="delta" theme="{theme}" grid={{{{true}}}} legend={{{{true}}}} />
<GaugeChart value={{{{50}}}} min={{{{0}}}} max={{{{100}}}} label="KPI" theme="{theme}" />
<RadarChart data={{{{data}}}} xKey="dim" series={{{{["v1","v2"]}}}} theme="{theme}" legend={{{{true}}}} />

Remember: one line, starts with <, ends with />, no other text.
"""


# ─────────────────────────────────────────────────────────────
# Pre-analysis: inspect data shape in Python so we can inject
# a hard chart recommendation into the user message, reducing
# model guesswork dramatically.
# ─────────────────────────────────────────────────────────────

def _analyze_data_shape(data: list[dict]) -> dict[str, Any]:
    """
    Returns a dict with:
      - numeric_cols: list of column names with numeric values
      - categorical_cols: list of column names with string/bool values
      - date_cols: list of column names that look like dates/times
      - row_count: int
      - unique_counts: {col: n_unique} for categorical cols
      - all_equal_values: bool (True if all numeric values in the first numeric col are identical)
      - recommended_chart: a string hint injected into the prompt
    """
    if not data:
        return {}

    sample = data[0]
    numeric_cols = []
    categorical_cols = []
    date_cols = []

    DATE_PATTERNS = re.compile(
        r"^\d{4}[-/]\d{2}([-/]\d{2})?$"          # YYYY-MM or YYYY-MM-DD
        r"|^\d{2}[-/]\d{2}[-/]\d{4}$"             # DD-MM-YYYY
        r"|^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)",
        re.IGNORECASE,
    )

    for col, val in sample.items():
        if val is None:
            continue
        if isinstance(val, bool):
            categorical_cols.append(col)
        elif isinstance(val, (int, float)):
            numeric_cols.append(col)
        elif isinstance(val, str):
            # Try numeric coercion
            stripped = val.strip().replace(",", "").replace("%", "")
            try:
                float(stripped)
                numeric_cols.append(col)
            except ValueError:
                if DATE_PATTERNS.match(val.strip()):
                    date_cols.append(col)
                else:
                    categorical_cols.append(col)

    unique_counts = {}
    for col in categorical_cols:
        unique_counts[col] = len(set(str(r.get(col, "")) for r in data))

    all_equal_values = False
    if numeric_cols:
        first_num_col = numeric_cols[0]
        vals = [r.get(first_num_col) for r in data if r.get(first_num_col) is not None]
        if len(vals) > 1:
            all_equal_values = len(set(vals)) == 1

    # Derive recommendation
    n_num = len(numeric_cols)
    n_cat = len(categorical_cols)
    n_date = len(date_cols)
    row_count = len(data)

    recommendation = ""

    if n_date > 0 and n_num >= 2:
        recommendation = f"USE MultiLineChart. xKey='{date_cols[0]}', series={json.dumps(numeric_cols[:4])}"
    elif n_date > 0 and n_num == 1:
        recommendation = f"USE AreaChart. xKey='{date_cols[0]}', yKey='{numeric_cols[0]}'"
    elif n_num == 0 and n_cat >= 1:
        # Pure categorical — list of names (like DB tables) — always BarChart
        recommendation = (
            f"USE BarChart. Data is purely categorical — no numeric columns. "
            f"Count occurrences of each unique value in '{categorical_cols[0]}'. "
            f"xKey='name', yKey='count'. NEVER use PieChart or DonutChart here."
        )
    elif n_num == 1 and n_cat == 1:
        cat_col = categorical_cols[0]
        num_col = numeric_cols[0]
        n_unique = unique_counts.get(cat_col, row_count)
        vals = [r.get(num_col) for r in data if r.get(num_col) is not None]
        if vals:
            max_v, min_v = max(vals), min(vals)
            spread = (max_v - min_v) / (max_v + 1e-9)
        else:
            spread = 0

        if all_equal_values or spread < 0.20:
            # All equal or near-equal → Pie/Donut is useless → BarChart
            recommendation = (
                f"USE BarChart. Values in '{num_col}' are all equal or near-equal (spread={spread:.0%}). "
                f"PieChart/DonutChart MUST NOT be used when values are equal. "
                f"xKey='{cat_col}', yKey='{num_col}'"
            )
        elif n_unique <= 5 and spread >= 0.20:
            recommendation = (
                f"USE DonutChart. Only {n_unique} unique categories with meaningful spread ({spread:.0%}). "
                f"nameKey='{cat_col}', valueKey='{num_col}'"
            )
        else:
            recommendation = (
                f"USE BarChart. {n_unique} categories is too many for Pie/Donut. "
                f"xKey='{cat_col}', yKey='{num_col}'"
            )
    elif n_num >= 3 and n_cat >= 1:
        recommendation = (
            f"USE BubbleChart. xKey='{numeric_cols[0]}', yKey='{numeric_cols[1]}', "
            f"sizeKey='{numeric_cols[2]}', categoryKey='{categorical_cols[0]}'"
        )
    elif n_num == 2 and n_cat == 2:
        recommendation = (
            f"USE Heatmap. xKey='{categorical_cols[0]}', yKey='{categorical_cols[1]}', "
            f"valueKey='{numeric_cols[0]}'"
        )
    elif n_num >= 2 and n_cat >= 1:
        recommendation = (
            f"USE GroupedBarChart. xKey='{categorical_cols[0]}', "
            f"series={json.dumps(numeric_cols[:4])}"
        )
    elif n_num == 1 and n_cat == 0:
        recommendation = f"USE HistogramChart. valueKey='{numeric_cols[0]}', bins=10"
    else:
        recommendation = "USE BarChart as default fallback."

    return {
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
        "date_cols": date_cols,
        "row_count": row_count,
        "unique_counts": unique_counts,
        "all_equal_values": all_equal_values,
        "recommendation": recommendation,
    }


# ─────────────────────────────────────────────────────────────
# Sanitizer — aggressive extraction of just the JSX component
# ─────────────────────────────────────────────────────────────

def _sanitize_c1(raw: str) -> str:
    """
    Extract ONLY the JSX component from C1's response.
    Handles:
      - markdown code fences
      - prose before/after the tag
      - multi-line component props (joins them to one line)
      - JSX and HTML comments
      - trailing punctuation / stray characters after />
    """
    # Strip code fences
    raw = re.sub(r"```[a-zA-Z]*\n?", "", raw)
    raw = re.sub(r"\n?```", "", raw)
    # Strip JSX block comments
    raw = re.sub(r"\{/\*.*?\*/\}", "", raw, flags=re.DOTALL)
    # Strip HTML comments
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.DOTALL)
    raw = raw.strip()

    # Strategy 1: find the component using a greedy regex that handles multi-line props
    # Matches from the first < to the self-closing />
    match = re.search(r"(<[A-Z][A-Za-z]+\s[^>]*?/>)", raw, re.DOTALL)
    if match:
        component = match.group(1)
        # Collapse internal newlines/extra spaces in prop values to single spaces
        component = re.sub(r"\s+", " ", component).strip()
        # Make sure it still ends with />
        if component.endswith("/>"):
            return component

    # Strategy 2: collect lines between the opening tag and />
    lines = raw.splitlines()
    result_lines: list[str] = []
    collecting = False

    for line in lines:
        stripped = line.strip()

        # Detect start of a JSX component (uppercase tag name)
        if not collecting and re.match(r"^<[A-Z]", stripped):
            collecting = True

        if collecting:
            result_lines.append(stripped)

        # Self-closing end
        if collecting and stripped.endswith("/>"):
            break

    if result_lines:
        component = " ".join(result_lines)
        # Normalize whitespace
        component = re.sub(r"\s+", " ", component).strip()
        if component.startswith("<") and component.endswith("/>"):
            return component

    # Fallback: return original (frontend should handle gracefully)
    logger.warning("[visualize] _sanitize_c1 could not extract clean JSX, returning raw")
    return raw.strip()


# ─────────────────────────────────────────────────────────────
# Main endpoint
# ─────────────────────────────────────────────────────────────

@router.post("/visualize")
@_rate_limited
async def api_visualize(request: Request, req: dict = Body(...)):
    """
    Generate a Thesys C1 Generative UI response from pipeline data.

    Expected body:
        {
            "question": "Show me revenue by month",
            "sql": "SELECT ...",
            "data": [{"month": "Jan", "revenue": 1200}, ...]
        }
    """
    api_key = os.environ.get("THESYS_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=501,
            detail="Thesys C1 is not configured. Set the THESYS_API_KEY environment variable.",
        )

    question: str = req.get("question", "")
    sql: str = req.get("sql", "")
    data: list = req.get("data", [])
    theme: str = req.get("theme", "dark")

    if not data:
        raise HTTPException(status_code=400, detail="No data provided for visualization.")

    # Truncate large datasets to keep C1 context window reasonable
    max_rows = 500
    truncated = len(data) > max_rows
    vis_data = data[:max_rows]

    # ── Pre-analyse data shape in Python so the model doesn't guess ──
    shape = _analyze_data_shape(vis_data)
    recommendation = shape.get("recommendation", "")

    logger.info(
        f"[visualize] shape={shape.get('numeric_cols')}/{shape.get('categorical_cols')}/"
        f"{shape.get('date_cols')} rows={shape.get('row_count')} → {recommendation}"
    )

    # Theme instruction injected into the prompt
    if theme == "dark":
        theme_instruction = (
            "Background is very dark (#09090b). "
            "ALL labels, tick text, axis text, legend text MUST be light (#e4e4e7 or white). "
            "Grid lines should be subtle (#27272a)."
        )
    else:
        theme_instruction = (
            "Background is white (#ffffff). "
            "ALL labels, tick text, axis text, legend text MUST be dark (#18181b). "
            "Grid lines should be subtle (#e4e4e7)."
        )

    system_prompt = VISUALIZE_SYSTEM_PROMPT.format(
        theme=theme,
        theme_instruction=theme_instruction,
    )

    # ── User message: include the pre-analysis recommendation as a hard directive ──
    col_summary = (
        f"Numeric columns: {shape.get('numeric_cols', [])}\n"
        f"Categorical columns: {shape.get('categorical_cols', [])}\n"
        f"Date/time columns: {shape.get('date_cols', [])}\n"
        f"Row count: {shape.get('row_count', 0)}\n"
        f"All values equal in first numeric col: {shape.get('all_equal_values', False)}\n"
        f"Unique counts: {shape.get('unique_counts', {})}"
    )

    user_content = (
        f"MANDATORY CHART DIRECTIVE (you MUST follow this exactly): {recommendation}\n\n"
        f"Data shape analysis:\n{col_summary}\n\n"
        f"Question: {question}\n"
        f"SQL: {sql}\n"
        f"Data ({len(vis_data)} rows{'; truncated to 500' if truncated else ''}):\n"
        f"{json.dumps(vis_data, default=str)}\n\n"
        f"Output ONLY the single JSX component tag. One line. Starts with <. Ends with />. Nothing else."
    )

    def _call_c1() -> str:
        try:
            from openai import OpenAI
            import httpx
        except ImportError:
            raise RuntimeError(
                "openai and httpx packages required. pip install openai httpx"
            )

        client = OpenAI(
            api_key=api_key,
            base_url="https://api.thesys.dev/v1/embed",
            http_client=httpx.Client(),
        )

        completion = client.chat.completions.create(
            # Claude Sonnet 4 follows strict formatting instructions much better than Gemini Flash
            model="c1/anthropic/claude-sonnet-4/v-20251230",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            # Low temperature = less creative, more rule-following
            temperature=0.1,
            max_tokens=512,  # JSX component is always short; cap it to avoid prose overflow
        )
        return completion.choices[0].message.content or ""

    try:
        c1_response = await asyncio.to_thread(_call_c1)
        c1_response = _sanitize_c1(c1_response)
        logger.info(f"[visualize] C1 response ({len(c1_response)} chars): {c1_response[:120]}...")
        return {"c1_response": c1_response}
    except Exception as exc:
        logger.error(f"[visualize] C1 API call failed: {exc}")
        raise HTTPException(status_code=502, detail=f"Thesys C1 API error: {str(exc)}")