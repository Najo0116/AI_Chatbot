from datetime import datetime, timedelta, timezone
from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Annotated
import models
from database import engine, SessionLocal
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.hash import bcrypt
import os

load_dotenv(find_dotenv())

app = FastAPI()
models.Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

DEMO_USERNAME = os.getenv("DEMO_USERNAME")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALG = os.getenv("JWT_ALGORITHM")
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

class ChatIn(BaseModel):
    message: str

class ChatOut(BaseModel):
    id: int
    message: str
    reply: str
    timestamp: datetime  # type only; value comes from DB row
    model_config = {"from_attributes": True}

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

db_dependency = Annotated[Session, Depends(get_db)]

def authenticate_demo_user(username: str, password: str) -> bool:
    return username == DEMO_USERNAME and password == DEMO_PASSWORD

def create_access_token(sub: str, user_id: int) -> str:
    # Aware UTC timestamps to avoid decode failures on some systems
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=JWT_EXPIRES_MIN)
    payload = {
        "sub": sub,
        "user_id": user_id,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict:
    # algorithms must be a list; disable 'aud' verification since we're not setting it
    return jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALG],
        options={"verify_aud": False}
    )

def get_or_create_demo_user(db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.username == DEMO_USERNAME).first()
    if not user:
        user = models.User(username=DEMO_USERNAME, password_hash=bcrypt.hash(DEMO_PASSWORD))
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: db_dependency) -> models.User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        username = payload.get("sub")
        uid = payload.get("user_id")
        if not username or not uid:
            raise cred_exc
    except JWTError:
        raise cred_exc

    user = db.query(models.User).filter(
        models.User.id == uid, models.User.username == username
    ).first()
    if not user:
        user = get_or_create_demo_user(db)
    return user

def call_gemini(user_message: str) -> str:
    # Placeholder; wire real Gemini later
    return "Gemini placeholder response"

@app.post("/login", response_model=TokenOut)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: db_dependency):
    if not authenticate_demo_user(form.username, form.password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    user = get_or_create_demo_user(db)
    token = create_access_token(sub=user.username, user_id=user.id)
    return TokenOut(access_token=token)

@app.post("/test", response_model=ChatOut, status_code=status.HTTP_201_CREATED)
def chat(chatIn: ChatIn, db: db_dependency, current_user: Annotated[models.User, Depends(get_current_user)]):
    user_message = chatIn.message
    ai_reply = call_gemini(user_message=user_message)

    db_message = models.ChatLog(
        message=user_message,
        reply=ai_reply,
        user_id=current_user.id
    )

    try:
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid user_id or FK constraint") from e

    return ChatOut(
        id=db_message.id,
        message=db_message.message,
        reply=db_message.reply,
        timestamp=db_message.timestamp
    )