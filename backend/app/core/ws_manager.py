from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps board_id -> List of active WebSockets
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, board_id: str):
        await websocket.accept()
        if board_id not in self.active_connections:
            self.active_connections[board_id] = []
        self.active_connections[board_id].append(websocket)

    def disconnect(self, websocket: WebSocket, board_id: str):
        if board_id in self.active_connections:
            try:
                self.active_connections[board_id].remove(websocket)
                if not self.active_connections[board_id]:
                    del self.active_connections[board_id]
            except ValueError:
                pass

    async def broadcast(self, board_id: str, message: dict, exclude: WebSocket = None):
        if board_id in self.active_connections:
            for connection in self.active_connections[board_id]:
                if connection != exclude:
                    await connection.send_json(message)

manager = ConnectionManager()
