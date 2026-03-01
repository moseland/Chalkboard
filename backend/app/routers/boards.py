from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import crud, schemas, database
from app.core import security
from app.models import User

router = APIRouter()

@router.post("/", response_model=schemas.BoardResponse)
def create_new_board(
    board_in: schemas.BoardCreate,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user)
):
    """Create a new blank whiteboard."""
    board = crud.create_board(db, owner_id=str(current_user.id), title=board_in.title)
    return board

@router.get("/", response_model=List[schemas.BoardResponse])
def read_boards(
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user)
):
    """Get all boards accessible by the current user."""
    boards = crud.get_boards_for_user(db, user_id=str(current_user.id))
    return boards

@router.get("/{board_id}", response_model=schemas.BoardResponse)
def read_board(
    board_id: str,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user)
):
    """Get a specific board by ID."""
    board = crud.get_board(db, board_id=board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
        
    # Check access
    is_owner = str(board.owner_id) == str(current_user.id)
    has_permission = any(str(p.user_id) == str(current_user.id) for p in board.permissions)
    
    if not is_owner and not has_permission and not board.is_public:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    return board

@router.delete("/{board_id}")
def delete_board(
    board_id: str,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user)
):
    """Delete a board by ID or remove current user's access."""
    board = crud.get_board(db, board_id=board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
        
    # Check if the current user is the owner
    if str(board.owner_id) == str(current_user.id):
        # Only owner can delete
        crud.delete_board(db, board_id=board_id, user_id=str(current_user.id))
        return {"status": "success", "message": "Board deleted"}
    else:
        # Not owner, try to remove permission
        success = crud.remove_board_permission(db, board_id=board_id, user_id=str(current_user.id))
        if success:
            return {"status": "success", "message": "Access removed"}
        else:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

@router.patch("/{board_id}", response_model=schemas.BoardResponse)
def update_board(
    board_id: str,
    board_in: schemas.BoardUpdate,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user)
):
    """Update a board by ID."""
    # Check access before update
    board = crud.get_board(db, board_id=board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
        
    is_owner = str(board.owner_id) == str(current_user.id)
    has_permission = any(str(p.user_id) == str(current_user.id) for p in board.permissions)
    
    if not is_owner and not has_permission:
        raise HTTPException(status_code=403, detail="Not enough permissions to edit")

    updated_board = crud.update_board(db, board_id=board_id, board_in=board_in, user_id=str(board.owner_id)) # bypass crud's own owner check by passing board owner id
    if not updated_board:
        raise HTTPException(status_code=404, detail="Failed to update board")
    return updated_board

@router.get("/{board_id}/permissions", response_model=List[schemas.PermissionResponse])
def get_permissions(
    board_id: str,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user)
):
    """List users with access to this board."""
    board = crud.get_board(db, board_id=board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Only owner or editors can see permissions? Let's say anyone with access.
    is_owner = str(board.owner_id) == str(current_user.id)
    has_permission = any(str(p.user_id) == str(current_user.id) for p in board.permissions)
    if not is_owner and not has_permission:
         raise HTTPException(status_code=403, detail="Access denied")

    permissions = crud.get_board_permissions(db, board_id=board_id)
    
    # Map to schema and include emails
    res = []
    for p in permissions:
        res.append(schemas.PermissionResponse(
            user_id=p.user_id,
            board_id=p.board_id,
            access_level=p.access_level,
            user_email=p.user.email
        ))
    return res

@router.post("/{board_id}/share")
def share_board(
    board_id: str,
    share_in: schemas.BoardShareRequest,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user)
):
    """Grant access to an existing user or invite a new one."""
    board = crud.get_board(db, board_id=board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
        
    # Only owner or existing editor can share
    is_owner = str(board.owner_id) == str(current_user.id)
    is_editor = any(str(p.user_id) == str(current_user.id) and p.access_level == "editor" for p in board.permissions)
    
    if not is_owner and not is_editor:
        raise HTTPException(status_code=403, detail="Insufficient permissions to share")
        
    user = crud.get_user_by_email(db, email=share_in.email)
    if user:
        # Grant permission directly
        crud.add_board_permission(db, board_id=board_id, user_id=str(user.id), access_level=share_in.access_level)
        return {"status": "success", "message": f"Access granted to {share_in.email}"}
    else:
        # User not found, create an invite linked to this board
        invite = crud.create_invite(db, email=share_in.email, board_id=board_id)
        from app.core import email
        email.send_invitation_email(email_to=invite.email, token=invite.token)
        return {"status": "invited", "message": f"Invitation sent to {share_in.email}"}
