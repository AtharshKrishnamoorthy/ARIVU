"""
Entry point: python -m arivu.dashboard.backend
Starts the FastAPI dashboard backend on port 8000.

Usage:
    python -m arivu.dashboard.backend
    python -m arivu.dashboard.backend --port 8000
"""
import argparse
import uvicorn

def main():
    parser = argparse.ArgumentParser(description="Arivu Dashboard Backend")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    uvicorn.run(
        "arivu.dashboard.backend._app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )

if __name__ == "__main__":
    main()



