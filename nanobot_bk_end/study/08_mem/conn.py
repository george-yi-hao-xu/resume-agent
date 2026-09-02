# main.py

from google.adk.sessions import DatabaseSessionService, VertexAiSessionService

db_url = "sqlite:///./mem_db.db"
session_service = DatabaseSessionService(db_url=db_url)


