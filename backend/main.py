import datetime
from fastapi import FastAPI, HTTPException, Depends, status
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import List, Annotated
import models
from database import engine, SessionLocal
from sqlalchemy.orm import Session

app = FastAPI()
models.Base.metadata.create_all(bind=engine)


class ChatIn(BaseModel):
    message: str

class ChatOut(BaseModel):
    id: int
    message: str
    reply: str
    timestamp: datetime.datetime
    model_config = {"from_attributes": True}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


db_dependency = Annotated[Session, Depends(get_db)]

def call_gemini(user_message: str) -> str:
    #Currently test phase
    
    return f"Gemini placeholder response"

#switch to async def after changing engine to async
@app.post('/test', response_model=ChatOut, status_code = status.HTTP_201_CREATED)
def chat(chatIn: ChatIn, db: db_dependency):
    user_message = chatIn.message
    ai_reply = call_gemini(user_message=user_message)
    test_user_id = 1

    db_message = models.ChatLog(
        message = user_message, 
        reply = ai_reply, 
        user_id = test_user_id
        )
    
    try:
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail='Invalid user_id or FK constraint') from e

    return ChatOut(
        id = db_message.id,
        message = db_message.message,
        reply=db_message.reply,
        timestamp=db_message.timestamp
    )


