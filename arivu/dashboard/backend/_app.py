"""
Thin module so uvicorn can import `arivu.dashboard.backend._app:app`
without having to deal with the (app, manager) tuple returned by
create_dashboard_app().
"""
from .server import create_dashboard_app

app, _manager = create_dashboard_app()
