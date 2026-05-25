import asyncio
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from pydantic import BaseModel
from statuses import PresentationStatus
from worker import parse_presentation_task
import tempfile, shutil

class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/0"
    database_url: str = ""
    deepgram_api_key: str = ""
    openai_api_key: str = ""
    next_api_url: str = "http://localhost:3000"
    internal_service_token: str = ""
    redis_pubsub_channel: str = "presentation_events"
    ws_heartbeat_seconds: int = 30
    # Comma-separated origins, e.g. "https://app.example.com,http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()

def _parse_cors_origins(raw: str) -> list[str]:
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or ["http://localhost:3000"]

app = FastAPI(title="SlideFlow API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)
        self.lock = asyncio.Lock()

    async def connect(self, presentation_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.connections[presentation_id].add(websocket)

    async def disconnect(self, presentation_id: str, websocket: WebSocket):
        async with self.lock:
            sockets = self.connections.get(presentation_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self.connections.pop(presentation_id, None)

    async def broadcast(self, presentation_id: str, message: dict[str, Any]):
        async with self.lock:
            sockets = list(self.connections.get(presentation_id, set()))

        if not sockets:
            return

        dead_sockets: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(message)
            except Exception:
                dead_sockets.append(socket)

        if dead_sockets:
            async with self.lock:
                current = self.connections.get(presentation_id, set())
                for socket in dead_sockets:
                    current.discard(socket)
                if not current:
                    self.connections.pop(presentation_id, None)


manager = ConnectionManager()


def build_server_event(event: str, presentation_id: str, owner_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "event": event,
        "version": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "presentationId": presentation_id,
        "ownerId": owner_id,
        "data": data,
    }


async def redis_event_listener():
    if not settings.redis_url:
        print("[WS] REDIS_URL missing, pub/sub listener disabled.")
        return

    client = redis.from_url(settings.redis_url, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(settings.redis_pubsub_channel)
    print(f"[WS] Subscribed to Redis channel: {settings.redis_pubsub_channel}")

    try:
        async for message in pubsub.listen():
            if not message or message.get("type") != "message":
                continue
            raw_data = message.get("data")
            if not raw_data:
                continue
            try:
                payload = json.loads(raw_data)
                presentation_id = payload.get("presentationId")
                if not presentation_id:
                    continue
                await manager.broadcast(presentation_id, payload)
            except Exception as exc:
                print(f"[WS] Failed to process pub/sub message: {exc}")
    finally:
        await pubsub.unsubscribe(settings.redis_pubsub_channel)
        await pubsub.close()
        await client.close()


@app.on_event("startup")
async def startup_event():
    app.state.redis_listener_task = asyncio.create_task(redis_event_listener())


@app.on_event("shutdown")
async def shutdown_event():
    listener_task = getattr(app.state, "redis_listener_task", None)
    if listener_task:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass

class ParseRequest(BaseModel):
    fileUrl: str
    ownerId: str
    fileName: str

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    presentation_id: str = Form(default=""),
    owner_id: str = Form(default="pending"),
    x_service_token: str | None = Header(default=None),
):
    if settings.internal_service_token and x_service_token != settings.internal_service_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    """
    Accepts a file from the Next.js upload-proxy.
    Saves to temp folder, enqueues Celery parsing task.
    """
    upload_dir = os.path.join(tempfile.gettempdir(), "slideflow_uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    task = parse_presentation_task.delay(
        file_path=file_path,
        owner_id=owner_id,
        file_name=file.filename,
        next_api_url=settings.next_api_url,
        presentation_id=presentation_id,
    )

    return {"status": "processing", "task_id": task.id, "file": file.filename}

@app.post("/api/parse")
def parse_presentation(req: ParseRequest, x_service_token: str | None = Header(default=None)):
    if settings.internal_service_token and x_service_token != settings.internal_service_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    task = parse_presentation_task.delay(
        file_path=req.fileUrl,
        owner_id=req.ownerId,
        file_name=req.fileName,
        next_api_url=settings.next_api_url
    )
    return {"status": "processing", "task_id": task.id}

@app.get("/")
def read_root():
    return {"message": "SlideFlow API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Basic WebSocket endpoint for future STT / auto-advance
@app.websocket("/ws/presentation/{presentation_id}")
async def websocket_endpoint(websocket: WebSocket, presentation_id: str):
    owner_id = websocket.query_params.get("ownerId", "")
    await manager.connect(presentation_id, websocket)
    try:
        await websocket.send_json(
            build_server_event(
                event="presentation.status_synced",
                presentation_id=presentation_id,
                owner_id=owner_id,
                data={
                    "status": PresentationStatus.PROCESSING.value,
                    "progressPercent": 0,
                    "lastKnownStage": "connected",
                },
            )
        )

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=settings.ws_heartbeat_seconds)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                await websocket.send_text("ping")
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(presentation_id, websocket)
