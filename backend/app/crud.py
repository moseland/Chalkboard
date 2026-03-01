import uuid
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app import models, schemas
from app.core.security import get_password_hash

def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_users_by_email_search(db: Session, query: str):
    return db.query(models.User).filter(models.User.email.ilike(f"%{query}%")).limit(10).all()

def get_invite_by_token(db: Session, token: str):
    return db.query(models.Invite).filter(models.Invite.token == token).first()

def create_invite(db: Session, email: str, board_id: str | None = None):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    # Check if an invite already exists for this email
    existing_invite = db.query(models.Invite).filter(models.Invite.email == email).first()
    
    if existing_invite:
        # Update existing invite
        existing_invite.token = token
        existing_invite.expires_at = expires_at
        existing_invite.is_used = False
        existing_invite.board_id = board_id
        db.commit()
        db.refresh(existing_invite)
        return existing_invite
    else:
        # Create new invite
        db_invite = models.Invite(
            email=email,
            token=token,
            expires_at=expires_at,
            board_id=board_id
        )
        db.add(db_invite)
        db.commit()
        db.refresh(db_invite)
        return db_invite

def mark_invite_used(db: Session, invite: models.Invite):
    invite.is_used = True
    db.commit()
    db.refresh(invite)
    return invite

def create_board(db: Session, owner_id: str, title: str):
    db_board = models.Board(
        owner_id=owner_id,
        title=title,
        canvas_data={"shapes": []},
        is_public=False
    )
    db.add(db_board)
    db.commit()
    db.refresh(db_board)
    return db_board

def get_boards_for_user(db: Session, user_id: str):
    # Fetch boards owned by the user OR where they have been granted permission
    return db.query(models.Board).outerjoin(models.Permission).filter(
        or_(
            models.Board.owner_id == user_id,
            models.Permission.user_id == user_id
        )
    ).all()

def get_board(db: Session, board_id: str):
    return db.query(models.Board).filter(models.Board.id == board_id).first()

from sqlalchemy.orm.attributes import flag_modified

def update_board_canvas(db: Session, board_id: str, canvas_data: dict):
    db_board = get_board(db, board_id)
    if db_board:
        db_board.canvas_data = canvas_data
        # JSON fields in SQLAlchemy don't track deep mutations automatically
        flag_modified(db_board, "canvas_data")
        db.commit()
        db.refresh(db_board)
    return db_board

def update_board(db: Session, board_id: str, board_in: schemas.BoardUpdate, user_id: str):
    db_board = get_board(db, board_id)
    if db_board and str(db_board.owner_id) == str(user_id):
        update_data = board_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_board, key, value)
        db.commit()
        db.refresh(db_board)
        return db_board
    return None

def update_board_chat(db: Session, board_id: str, chat_message: dict):
    db_board = get_board(db, board_id)
    if db_board:
        if not db_board.chat_history:
            db_board.chat_history = []
        db_board.chat_history.append(chat_message)
        flag_modified(db_board, "chat_history")
        db.commit()
        db.refresh(db_board)
    return db_board

def delete_board(db: Session, board_id: str, user_id: str):
    db_board = get_board(db, board_id)
    if db_board and str(db_board.owner_id) == str(user_id):
        # Manually delete related permissions
        db.query(models.Permission).filter(models.Permission.board_id == board_id).delete()
        # Manually delete related invites
        db.query(models.Invite).filter(models.Invite.board_id == board_id).delete()
        
        db.delete(db_board)
        db.commit()
        return True
    return False

def duplicate_board(db: Session, board_id: str, user_id: str):
    db_board = get_board(db, board_id)
    if db_board:
        # Create a deep copy of the board logic
        new_title = f"{db_board.title} (Copy)"
        new_board = models.Board(
            owner_id=user_id,
            title=new_title,
            canvas_data=db_board.canvas_data,
            chat_history=db_board.chat_history,
            is_public=db_board.is_public
        )
        db.add(new_board)
        db.commit()
        db.refresh(new_board)
        return new_board
    return None

def add_board_permission(db: Session, board_id: str, user_id: str, access_level: str = "editor"):
    db_permission = db.query(models.Permission).filter(
        models.Permission.board_id == board_id,
        models.Permission.user_id == user_id
    ).first()
    
    if db_permission:
        db_permission.access_level = access_level
    else:
        db_permission = models.Permission(
            board_id=board_id,
            user_id=user_id,
            access_level=access_level
        )
        db.add(db_permission)
    
    db.commit()
    db.refresh(db_permission)
    return db_permission

def get_board_permissions(db: Session, board_id: str):
    return db.query(models.Permission).filter(models.Permission.board_id == board_id).all()

def remove_board_permission(db: Session, board_id: str, user_id: str):
    db_permission = db.query(models.Permission).filter(
        models.Permission.board_id == board_id,
        models.Permission.user_id == user_id
    ).first()
    if db_permission:
        db.delete(db_permission)
        db.commit()
        return True
    return False
