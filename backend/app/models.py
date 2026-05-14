from pydantic import BaseModel
from typing import Optional


class ProjectCreate(BaseModel):
    name: str


class ProjectResponse(BaseModel):
    id: str
    name: str
    created_at: str


class TranscriptCreate(BaseModel):
    project_id: str
    raw_text: str


class TranscriptResponse(BaseModel):
    id: str
    project_id: str
    raw_text: str
    cleaned_text: Optional[str]
    word_count: Optional[int]
    created_at: str


class ChunkResponse(BaseModel):
    id: str
    transcript_id: str
    chunk_type: str
    content: str
    confidence_score: Optional[float]


class TemplateSection(BaseModel):
    name: str
    prompt: str


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    structure: list[TemplateSection]


class GenerateRequest(BaseModel):
    project_id: str
    transcript_id: str
    template_id: str
    subreddit: Optional[str] = "marketing"
    platforms: Optional[list[str]] = None  # If not provided, generates for all platforms


class GenerationRunResponse(BaseModel):
    run_id: str
    status: str
    posts: list["PostResponse"]


class PostResponse(BaseModel):
    id: str
    generation_run_id: str
    platform: str
    content: str
    quality_score: float
    reviewed: bool
    approved: bool
    edited_content: Optional[str]


class PostEdit(BaseModel):
    edited_content: str


GenerationRunResponse.model_rebuild()