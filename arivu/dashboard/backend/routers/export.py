"""
arivu.dashboard.backend.routers.export
──────────────────────────────────────
Export query results to CSV format for download.
"""

import csv
import io
import json

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api")


@router.post("/export")
async def export_data(req: dict = Body(...)):
    """
    Export data as CSV.

    Body:
        {
            "data": [{"col1": "val1", ...}, ...],
            "filename": "export"   (optional)
        }
    """
    data = req.get("data", [])
    filename = req.get("filename", "arivu_export")

    if not data or not isinstance(data, list):
        raise HTTPException(status_code=400, detail="No data to export.")

    # Build CSV in-memory
    output = io.StringIO()
    keys = list(data[0].keys()) if data else []
    writer = csv.DictWriter(output, fieldnames=keys)
    writer.writeheader()
    for row in data:
        writer.writerow({k: str(v) for k, v in row.items()})

    csv_bytes = output.getvalue().encode("utf-8")

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}.csv"',
            "Content-Length": str(len(csv_bytes)),
        },
    )
