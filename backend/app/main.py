import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.routers import auth, boards, images, stock
from app.database import engine, Base, SessionLocal
from app.core.config import settings
from app.core.ws_manager import manager
from app.core import security
from app.core.ai import handle_ai_summon, should_igor_respond
from app import crud

# Create all tables conceptually for Phase 1 testing
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(boards.router, prefix=f"{settings.API_V1_STR}/boards", tags=["boards"])
app.include_router(images.router, prefix=f"{settings.API_V1_STR}/images", tags=["images"])
app.include_router(stock.router, prefix=f"{settings.API_V1_STR}/stock", tags=["stock"])

@app.websocket(f"{settings.API_V1_STR}/ws/boards/{{board_id}}")
async def websocket_endpoint(websocket: WebSocket, board_id: str, token: str):
    # 1. Validate the user via the token query parameter
    db: Session = SessionLocal()
    try:
        user = security.get_current_user(db=db, token=token)
    except Exception:
        await websocket.close(code=1008) # Policy Violation
        db.close()
        return

    # 2. Check if the board exists
    board = crud.get_board(db, board_id=board_id)
    db.close()
    if not board:
        await websocket.close(code=1008)
        return

    # 3. Connect the user to the room
    await manager.connect(websocket, board_id)
    
    # 4. Main Event Loop
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "chat":
                # Inject validated author details before broadcasting
                data["payload"]["authorId"] = str(user.id)
                data["payload"]["authorName"] = user.display_name or user.email.split('@')[0]
                data["payload"]["isSelf"] = False # It's only 'self' for the local sender
                await manager.broadcast(board_id, data, exclude=websocket)
                
                # Persist to database
                crud.update_board_chat(db, board_id=board_id, chat_message=data["payload"])
                
                # Check for AI Summon
                text = data.get("payload", {}).get("text", "")
                if should_igor_respond(board_id, text):
                    # Fetch contextual data right now in the synchronous block context
                    # to avoid SQLAlchemy DetachedInstanceErrors in the async thread
                    db_session = SessionLocal()
                    try:
                        board_state = crud.get_board(db_session, board_id=board_id)
                        canvas_data = board_state.canvas_data if board_state else {"shapes": []}
                        
                        # Pass the real chat history for context
                        chat_history = board_state.chat_history[-10:] if board_state and board_state.chat_history else [{"role": "user", "content": text}]
                    finally:
                        db_session.close()

                    snapshot_data = data.get("payload", {}).get("snapshot")
                    model_id = data.get("payload", {}).get("modelId")
                    viewport_data = data.get("payload", {}).get("viewport")
                    
                    asyncio.create_task(
                        handle_ai_summon(board_id, text, canvas_data, chat_history, requester_id=str(user.id), snapshot=snapshot_data, model_id=model_id, viewport=viewport_data)
                    )
                
                continue # Continue to next message after handling chat

            # Persist non-chat events to DB
            db_session = SessionLocal()
            try:
                if data.get("type") == "stroke":
                    board_state = crud.get_board(db_session, board_id=board_id)
                    if board_state:
                        canvas_data = board_state.canvas_data or {"shapes": []}
                        if "shapes" not in canvas_data:
                            canvas_data["shapes"] = []
                        
                        existing_idx = next((i for i, s in enumerate(canvas_data["shapes"]) if s.get("id") == data["payload"]["id"]), -1)
                        if existing_idx >= 0:
                            canvas_data["shapes"][existing_idx] = {**canvas_data["shapes"][existing_idx], **data["payload"]}
                        else:
                            canvas_data["shapes"].append(data["payload"])
                            
                        crud.update_board_canvas(db_session, board_id=board_id, canvas_data=canvas_data)
                        # Broadcast to everyone else
                        await manager.broadcast(board_id, data, exclude=websocket)
                
                elif data.get("type") == "delete_node":
                    board_state = crud.get_board(db_session, board_id=board_id)
                    if board_state:
                        canvas_data = board_state.canvas_data or {"shapes": []}
                        if "shapes" in canvas_data:
                            canvas_data["shapes"] = [s for s in canvas_data["shapes"] if s.get("id") not in data["payload"]["nodeIds"]]
                            crud.update_board_canvas(db_session, board_id=board_id, canvas_data=canvas_data)
                            # Broadcast deletion
                            await manager.broadcast(board_id, data, exclude=websocket)

                elif data.get("type") == "reorder":
                    board_state = crud.get_board(db_session, board_id=board_id)
                    if board_state:
                        canvas_data = board_state.canvas_data or {"shapes": []}
                        if "shapes" in canvas_data:
                            id_map = {s.get("id"): s for s in canvas_data["shapes"]}
                            new_shapes = [id_map[node_id] for node_id in data["payload"]["nodeIds"] if node_id in id_map]
                            canvas_data["shapes"] = new_shapes
                            crud.update_board_canvas(db_session, board_id=board_id, canvas_data=canvas_data)
                            # Broadcast reorder
                            await manager.broadcast(board_id, data, exclude=websocket)
                
                elif data.get("type") == "clear":
                    crud.update_board_canvas(db_session, board_id=board_id, canvas_data={"shapes": []})
                    # Broadcast clear
                    await manager.broadcast(board_id, data, exclude=websocket)

                elif data.get("type") == "presence":
                    # Just broadcast presence, no DB persistence needed
                    data["userId"] = str(user.id)
                    await manager.broadcast(board_id, data, exclude=websocket)
                    
            finally:
                db_session.close()
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)
        # Broadcast that the user left the room
        await manager.broadcast(
            board_id, 
            {"type": "user_left", "userId": str(user.id)}, 
            exclude=websocket
        )

@app.get("/")
def read_root():
    return {"message": "Welcome to Chalkboard API"}
