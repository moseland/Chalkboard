from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any
from app import crud, schemas, database, models
from app.core import security, email

router = APIRouter()

@router.post("/invites", response_model=schemas.InviteResponse)
def create_invitation(
    invite_in: schemas.InviteCreate,
    db: Session = Depends(database.get_db)
) -> Any:
    """Create a new invite and send an email."""
    # Check if user already exists
    user = crud.get_user_by_email(db, email=invite_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    invite = crud.create_invite(db, email=invite_in.email)
    email.send_invitation_email(email_to=invite.email, token=invite.token)
    return invite


@router.post("/register", response_model=schemas.UserResponse)
def register(
    user_in: schemas.UserCreate,
    db: Session = Depends(database.get_db)
) -> Any:
    """Register a new user using an invite token."""
    invite = crud.get_invite_by_token(db, token=user_in.invite_token)
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
        
    if invite.is_used:
        raise HTTPException(status_code=400, detail="Invite already used")
        
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite expired")
        
    if invite.email != user_in.email:
        raise HTTPException(status_code=400, detail="Email does not match invite")
        
    user = crud.get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(status_code=400, detail="User already registered")
        
    user = crud.create_user(db, user=user_in)
    crud.mark_invite_used(db, invite)
    
    # If this invite was for a specific board, grant access
    if invite.board_id:
        crud.add_board_permission(db, board_id=str(invite.board_id), user_id=str(user.id))
    
    return user

from typing import List

@router.get("/users/search", response_model=List[schemas.UserResponse])
def search_users(
    q: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """Search for users by email."""
    if len(q) < 3:
        return []
    users = crud.get_users_by_email_search(db, query=q)
    return users

from fastapi import Response, Request

@router.post("/login")
def login(
    response: Response,
    request: schemas.UserLogin, 
    db: Session = Depends(database.get_db)
):
    """Login endpoint returning JWT and HttpOnly refresh cookie."""
    user = crud.get_user_by_email(db, email=request.email)
    if not user or not security.verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = security.create_access_token(data={"sub": str(user.id)})
    refresh_token = security.create_refresh_token(data={"sub": str(user.id)})
    
    # Set Refresh Token in HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False, # Set to True in prod with HTTPS
        samesite="lax",
        max_age=7 * 24 * 60 * 60 # 7 days
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user_id": str(user.id)}

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user = Depends(security.get_current_user)):
    """Fetch the currently authenticated user's profile."""
    return current_user

@router.post("/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(database.get_db)):
    """Use the HttpOnly refresh token to get a new access token."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
        
    try:
        from app.core.config import settings
        from jose import jwt
        payload = jwt.decode(refresh_token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if payload.get("type") != "refresh" or not user_id:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
            
        user = crud.get_user(db, user_id=user_id)
        if not user:
             raise HTTPException(status_code=401, detail="User not found")
             
        new_access_token = security.create_access_token(data={"sub": str(user.id)})
        return {"access_token": new_access_token, "token_type": "bearer"}
    except Exception:
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

@router.post("/logout")
def logout(response: Response):
    """Clear the refresh token cookie."""
    response.delete_cookie("refresh_token")
    return {"detail": "Successfully logged out"}
