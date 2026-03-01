import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    email: EmailStr

class UserLogin(UserBase):
    password: str

class UserCreate(UserLogin):
    invite_token: str

class UserResponse(UserBase):
    id: uuid.UUID
    is_active: bool
    role: str | None = None
    display_name: str | None = None
    created_at: datetime
    
    model_config = {"from_attributes": True}

class InviteCreate(BaseModel):
    email: EmailStr
    board_id: uuid.UUID | None = None

class InviteResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    token: str
    is_used: bool
    board_id: uuid.UUID | None = None
    created_at: datetime
    expires_at: datetime
    
    model_config = {"from_attributes": True}

class PermissionResponse(BaseModel):
    user_id: uuid.UUID
    board_id: uuid.UUID
    access_level: str
    user_email: str | None = None

    model_config = {"from_attributes": True}

class BoardShareRequest(BaseModel):
    email: EmailStr
    access_level: str = "editor"

class BoardCreate(BaseModel):
    title: str

class BoardUpdate(BaseModel):
    title: str | None = None
    is_public: bool | None = None

class BoardResponse(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    canvas_data: dict | list | None = None
    chat_history: list | None = None
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
