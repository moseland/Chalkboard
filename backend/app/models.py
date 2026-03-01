import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # New columns for Phase 2
    google_id = Column(String, unique=True, index=True, nullable=True)
    display_name = Column(String, nullable=True)
    role = Column(String, default="user", nullable=False)  # admin | user

    # Relationships
    boards_owned = relationship("Board", back_populates="owner")
    permissions = relationship("Permission", back_populates="user")
    invites_created = relationship("Invite", back_populates="creator")

class Invite(Base):
    __tablename__ = "invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id"), nullable=True)
    
    # New columns for Phase 2
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    creator = relationship("User", back_populates="invites_created")

class Board(Base):
    __tablename__ = "boards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, default="Untitled Board", nullable=False)
    canvas_data = Column(JSONB, default=dict) # Serialized Konva JSON
    chat_history = Column(JSONB, default=list) # Array of chat message objects
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    owner = relationship("User", back_populates="boards_owned")
    permissions = relationship("Permission", back_populates="board")

class Permission(Base):
    __tablename__ = "permissions"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    board_id = Column(UUID(as_uuid=True), ForeignKey("boards.id"), primary_key=True)
    access_level = Column(String, default="editor", nullable=False) # editor | viewer
    
    # Relationships
    user = relationship("User", back_populates="permissions")
    board = relationship("Board", back_populates="permissions")
