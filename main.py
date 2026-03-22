from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="V2V Communication Demo")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return FileResponse("static/index.html")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    V2V WebSocket endpoint.
    Currently accepts connections and keeps them alive.
    Future: bridge incoming MQTT messages from the cellular module and
    forward them as JSON to all connected clients.
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back for development/testing purposes
            await websocket.send_text(data)
    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
