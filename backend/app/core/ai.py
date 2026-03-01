import json
import logging
import time
import uuid
from typing import Dict, List, Optional
from openai import AsyncOpenAI
from app.core.config import settings
from app.core.ws_manager import manager

logger = logging.getLogger(__name__)

# Initialize the AsyncOpenAI client targeting OpenRouter
ai_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.OPENROUTER_API_KEY,
)

# Phase 15: State Management
# Tracks when Igor was last summoned to allow natural follow-ups
active_conversations: Dict[str, float] = {} # board_id -> unix_timestamp (active_until)
BOARD_ACTIVE_DURATION = 90

# Tracks if Igor is currently "thinking" for a board
thinking_boards: Dict[str, bool] = {} # board_id -> bool
# Queue for messages that arrived while Igor was thinking
pending_context: Dict[str, List[str]] = {} # board_id -> [message_text]

def should_igor_respond(board_id: str, text: str) -> bool:
    """Determine if Igor should respond based on @igor tag or active state."""
    if "@igor" in text.lower():
        return True
    
    # Check if we are in an active conversation window
    active_until = active_conversations.get(board_id, 0)
    if time.time() < active_until:
        return True
    
    return False

async def handle_ai_summon(board_id: str, prompt: str, canvas_data: dict, chat_history: list, requester_id: str = None, snapshot: str = None, model_id: str = None):
    """
    Called asynchronously when Igor is triggered.
    Handles queueing if already thinking, and updates active state.
    """
    # 1. Update active state immediately
    active_conversations[board_id] = time.time() + BOARD_ACTIVE_DURATION
    
    # Broadcast active state to frontend
    await manager.broadcast(board_id, {
        "type": "ai_active_state",
        "payload": {
            "isActive": True,
            "expiresAt": active_conversations[board_id]
        }
    })

    # 2. Check if already thinking
    if thinking_boards.get(board_id):
        logger.info(f"Igor is already thinking for {board_id}. Queuing context.")
        if board_id not in pending_context:
            pending_context[board_id] = []
        pending_context[board_id].append(prompt)
        return

    try:
        await _process_ai_request(board_id, prompt, canvas_data, chat_history, requester_id, snapshot, model_id)
        
        # 3. Check for pending context that arrived during processing
        while pending_context.get(board_id):
            next_prompts = pending_context.pop(board_id)
            combined_prompt = " [Follow-up context]: " + " | ".join(next_prompts)
            logger.info(f"Processing queued context for {board_id}: {combined_prompt}")
            # Refresh canvas/chat context potentially? For now, just continue with combined
            await _process_ai_request(board_id, combined_prompt, canvas_data, chat_history, requester_id, snapshot, model_id)
            
    finally:
        thinking_boards[board_id] = False

async def _process_ai_request(board_id: str, prompt: str, canvas_data: dict, chat_history: list, requester_id: str = None, snapshot: str = None, model_id: str = None):
    """Internal method to call the LLM and broadcast response."""
    if not settings.OPENROUTER_API_KEY:
        logger.error("OPENROUTER_API_KEY is not set.")
        await _send_ai_error(board_id, "The OpenRouter API key is missing. Contact the administrator.")
        return
    
    # Use the provided model_id or fallback to default
    target_model = model_id or settings.OPENROUTER_MODEL

    # Broadcast a typing indicator right away
    await manager.broadcast(
        board_id,
        {
            "type": "chat",
            "payload": {
                "authorId": "ai",
                "authorName": "Igor",
                "text": "thinking...",
                "isSelf": False,
                "isAi": True,
                "temporaryId": "ai-typing-indicator"
            }
        }
    )

    try:
        system_prompt = f"""You are Igor, an AI Team Member inside a real-time collaborative Whiteboard application called Chalkboard.
You are participating in a group chat with human users who are drawing on the board.

Here is the current Chat History (for context only):
{json.dumps(chat_history[-10:], indent=2)}

When the user says "@igor", they are talking to you. Look at the attached image of the whiteboard canvas and the conversation history to understand what they are asking. 

# GUIDELINES
- You are Igor, a natural team member. You are currently in an ACTIVE CONVERSATION.
- Respond if the user is following up on your last action, asking a question, or providing new context.
- If the user didn't tag you specifically but the message is clearly for you (e.g., "now make it blue"), act on it.
- **CRITICAL DRAWING RULE:** When asked to "draw", "make", or "create" an object, scene, or item, you MUST construct it manually using multiple `draw_shape` actions (rectangles, circles, triangles) and the `polygon` tool. Do NOT use image generation tools for drawing requests.
- **POLYGON USAGE:** Use `polygon` aggressively for any complex, custom, or irregular shapes that cannot be made with basic geometry (e.g., stars, clouds, custom icons).
- **STRICT GENERATION RULE:** ONLY use `generate_image`, `sketch_to_image`, or `structure_to_image` when the user explicitly uses trigger words like "generate an image", "render a picture", or specifically requests an AI-generated photo.
- **CLUSTERING / LAYOUT RULE:** When asked to group, categorize, tidy, or organize existing notes or shapes on the board, you MUST return an array of `update_node` actions. Calculate a clean, equidistant grid layout (modifying `x` and `y`) for each logical category so the items physically move into neat, categorized clusters.
- Be brief, collaborative, and keep the conversation flowing.

# CAPABILITIES & PROPERTIES
- You can use "rotation" (degrees).
- You can use "opacity" (0.0 to 1.0).
- You can use "fillColor" (hex) for closed shapes.
- For text: "html" (standard HTML tags for formatting), "width" (in pixels for wrapping), "fontSize" (base size), and "color" (base color).

# ACTION SCHEMA
You MUST output your ENTIRE response as a **single valid JSON object**.
{{
  "text": "Your conversational reply here. Be brief and helpful.",
  "actions": [ Array of action objects (optional) ]
}}

ACTION OBJECT TYPES:
1. `draw_shape`: {{ "action": "draw_shape", "shape_type": "rectangle" | "circle" | "triangle" | "polygon", "x": int, "y": int, "width": int, "height": int, "color": hex, "fillColor": hex, "opacity": float, "rotation": int, "points": [int] }}
2. `draw_text`: {{ "action": "draw_text", "html": "...", "x": int, "y": int, "width": int, "fontSize": int, "color": hex, "opacity": float, "rotation": int }}
3. `update_node`: {{ "action": "update_node", "id": "...", "x": int, "y": int }}
4. `generate_image`: {{ "action": "generate_image", "prompt": "...", "x": int, "y": int, "width": int, "height": int }}
5. `sketch_to_image`: {{ "action": "sketch_to_image", "prompt": "Refine this...", "x": int, "y": int }}
6. `structure_to_image`: {{ "action": "structure_to_image", "prompt": "...", "x": int, "y": int }}
7. `clear_board`: {{ "action": "clear_board" }}

To clear the board, return: {{"action": "clear_board"}} inside the actions array.

# EXAMPLES

**User:** "@igor draw a simple house"
**Igor:**
{{
  "text": "I'll build a simple house using some basic shapes!",
  "actions": [
    {{
      "action": "draw_shape",
      "shape_type": "rectangle",
      "fillColor": "#FDE68A",
      "x": 200,
      "y": 300,
      "width": 150,
      "height": 150
    }},
    {{
      "action": "draw_shape",
      "shape_type": "triangle",
      "fillColor": "#EF4444",
      "x": 200,
      "y": 150,
      "width": 150,
      "height": 150
    }},
    {{
      "action": "draw_shape",
      "shape_type": "rectangle",
      "fillColor": "#8B4513",
      "x": 250,
      "y": 375,
      "width": 50,
      "height": 75
    }}
  ]
}}

**User:** "@igor can you draw a yellow star?"
**Igor:**
{{
  "text": "One yellow star coming right up!",
  "actions": [
    {{
      "action": "draw_shape",
      "shape_type": "polygon",
      "fillColor": "#FDE047",
      "points": [150, 50, 170, 100, 220, 100, 180, 130, 190, 180, 150, 150, 110, 180, 120, 130, 80, 100, 130, 100]
    }}
  ]
}}

**User:** "@igor please generate a high-quality picture of a futuristic city."
**Igor:**
{{
  "text": "Rendering a futuristic city for you now!",
  "actions": [
    {{
      "action": "generate_image",
      "prompt": "high-quality picture of a futuristic city",
      "x": 400,
      "y": 100,
      "width": 512,
      "height": 512
    }}
  ]
}}

**User:** "@igor can you write a note about our project mission with a big header?"
**Igor:**
{{
  "text": "Sure! Here is a formatted note for the project mission.",
  "actions": [
    {{
      "action": "draw_text",
      "html": "<h1>Project Mission</h1><p>Our goal is to build the <b>best</b> collaborative whiteboard in the world. <i>Speed</i> and <i>simplicity</i> are key.</p>",
      "x": 500,
      "y": 500,
      "width": 350,
      "fontSize": 24,
      "color": "#FFFFFF"
    }}
  ]
}}
"""


        # Prepend any extra context found in the history or current active state
        is_followup = time.time() < active_conversations.get(board_id, 0)
        system_instruction = system_prompt
        if is_followup:
            system_instruction += "\nNOTE: This is a natural follow-up in an ongoing conversation. You don't need to be tagged."

        user_content = [{"type": "text", "text": prompt}]
        if snapshot:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": snapshot}
            })

        response = await ai_client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"}
        )

        ai_message = response.choices[0].message.content
        
        # Clean up any potential markdown formatting wrapping the JSON
        cleaned_message = ai_message.strip()
        if cleaned_message.startswith("```json"):
            cleaned_message = cleaned_message.replace("```json", "", 1)
            if cleaned_message.endswith("```"):
                cleaned_message = cleaned_message[:-3]
        elif cleaned_message.startswith("```"):
            cleaned_message = cleaned_message.replace("```", "", 1)
            if cleaned_message.endswith("```"):
                cleaned_message = cleaned_message[:-3]
                
        cleaned_message = cleaned_message.strip()
        
        action_payload_raw = None
        text_response = "I couldn't process that properly."
        
        try:
            data = json.loads(cleaned_message)
            text_response = data.get("text", "")
            action_payload_raw = data.get("actions", None)
        except Exception as e:
            logger.error(f"Failed to parse structured JSON from AI: {e}\nRaw output: {ai_message}")
            text_response = "Sorry, I had a logic bug parsing my own JSON! Can you try asking me again?"

        action_payload = []
        if action_payload_raw:
            # Assign stable IDs in the backend so they persist across refreshes
            for act in action_payload_raw:
                if act.get("action") == "draw_shape":
                    act["id"] = f"shape-ai-{uuid.uuid4().hex[:8]}"
                elif act.get("action") == "draw_text":
                    act["id"] = f"text-ai-{uuid.uuid4().hex[:8]}"
                action_payload.append(act)

        # 4. Persist AI Actions to the Canvas (Authoritative Sync)
        if action_payload:
            await apply_ai_actions(board_id, action_payload)

        # Broadcast the final AI response to the room
        payload = {
            "authorId": "ai",
            "authorName": "Igor",
            "text": text_response,
            "isSelf": False,
            "isAi": True,
            "removeIndicator": "ai-typing-indicator",
            "action": action_payload,
            "requesterId": requester_id
        }
        
        # Persist the AI response to the database
        from app import crud
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            crud.update_board_chat(db, board_id=board_id, chat_message=payload)
        finally:
            db.close()

        await manager.broadcast(
            board_id,
            {
                "type": "chat",
                "payload": payload
            }
        )

    except Exception as e:
        logger.error(f"Error calling OpenRouter API: {e}")
        await _send_ai_error(board_id, f"Oops, I hit a snag thinking about that: {str(e)}")

async def apply_ai_actions(board_id: str, actions: list):
    """
    Applies AI actions (clear, draw, etc.) directly to the board's canvas_data in the DB.
    Ensures that AI changes are persistent and authoritative.
    """
    from app import crud
    from app.database import SessionLocal
    
    db = SessionLocal()
    try:
        board = crud.get_board(db, board_id)
        if not board:
            return
            
        canvas_data = board.canvas_data or {"shapes": []}
        if "shapes" not in canvas_data:
            canvas_data["shapes"] = []

        modified = False
        for action in actions:
            act_type = action.get("action")
            
            if act_type == "clear_board":
                canvas_data["shapes"] = []
                modified = True
                # Broadcast real-time clear to all clients
                await manager.broadcast(board_id, {"type": "clear"})
            
            elif act_type == "draw_shape":
                new_shape = {
                    "id": action.get("id"),
                    "tool": "shape",
                    "shapeType": action.get("shape_type", "rectangle"),
                    "x": action.get("x", 100),
                    "y": action.get("y", 100),
                    "width": action.get("width", 100),
                    "height": action.get("height", 100),
                    "color": action.get("color", "#3B82F6"),
                    "fillColor": action.get("fillColor"),
                    "opacity": action.get("opacity", 1),
                    "rotation": action.get("rotation", 0),
                    "points": action.get("points", [])
                }
                canvas_data["shapes"].append(new_shape)
                modified = True
                # Broadcast the new shape to all clients immediately
                await manager.broadcast(board_id, {"type": "stroke", "payload": new_shape})
            
            elif act_type == "draw_text":
                new_text = {
                    "id": action.get("id"),
                    "tool": "text",
                    "text": action.get("text", "Text"),
                    "x": action.get("x", 100),
                    "y": action.get("y", 100),
                    "fontSize": action.get("fontSize", 32),
                    "color": action.get("color", "#1F2937"),
                    "opacity": action.get("opacity", 1),
                    "rotation": action.get("rotation", 0)
                }
                canvas_data["shapes"].append(new_text)
                modified = True
                # Broadcast the new text node
                await manager.broadcast(board_id, {"type": "stroke", "payload": new_text})
            
            elif act_type == "update_node":
                node_id = action.get("id")
                new_x = action.get("x")
                new_y = action.get("y")
                
                if node_id and (new_x is not None or new_y is not None):
                    for shape in canvas_data["shapes"]:
                        if shape.get("id") == node_id:
                            if new_x is not None:
                                shape["x"] = new_x
                            if new_y is not None:
                                shape["y"] = new_y
                            modified = True
                            # Broadcast the update
                            await manager.broadcast(board_id, {
                                "type": "stroke", # Use stroke for updates too, frontend handles it by matching ID
                                "payload": shape
                            })
                            break
                            
        if modified:
            crud.update_board_canvas(db, board_id, canvas_data)
            
    except Exception as e:
        logger.error(f"Failed to apply AI actions to DB: {e}")
    finally:
        db.close()


async def _send_ai_error(board_id: str, message: str):
    payload = {
        "authorId": "ai",
        "authorName": "Igor System",
        "text": message,
        "isSelf": False,
        "isAi": True,
        "removeIndicator": "ai-typing-indicator"
    }

    from app import crud
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        crud.update_board_chat(db, board_id=board_id, chat_message=payload)
    finally:
        db.close()

    await manager.broadcast(
        board_id,
        {
            "type": "chat",
            "payload": payload
        }
    )
