from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Command(BaseModel):
    id: str
    action: str
    distance: Optional[int] = None

class RobotProgram(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    commands: List[Command]
    environment: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class RobotProgramCreate(BaseModel):
    name: str
    commands: List[Command]
    environment: str


# Routes
@api_router.get("/")
async def root():
    return {"message": "Robotics Simulator API"}

@api_router.post("/programs", response_model=RobotProgram)
async def create_program(program_input: RobotProgramCreate):
    """
    Save a robot program to the database
    """
    program_dict = program_input.dict()
    program_obj = RobotProgram(**program_dict)
    
    await db.programs.insert_one(program_obj.dict())
    return program_obj

@api_router.get("/programs", response_model=List[RobotProgram])
async def get_programs():
    """
    Get all saved robot programs
    """
    programs = await db.programs.find().sort("created_at", -1).to_list(1000)
    return [RobotProgram(**program) for program in programs]

@api_router.get("/programs/{program_id}", response_model=RobotProgram)
async def get_program(program_id: str):
    """
    Get a specific robot program by ID
    """
    program = await db.programs.find_one({"id": program_id})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return RobotProgram(**program)

@api_router.delete("/programs/{program_id}")
async def delete_program(program_id: str):
    """
    Delete a robot program
    """
    result = await db.programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"message": "Program deleted successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()