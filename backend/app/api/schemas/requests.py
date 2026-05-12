"""
Request DTOs — external input shapes.
"""

from pydantic import BaseModel, Field


class GenerateVideoRequest(BaseModel):
    """Transport DTO for video generation request."""

    transcript: str = Field(..., min_length=1, description="Raw transcript text")
    persona_id: str = Field(default="expert_formal", description="Persona identifier")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "transcript": "Your video content goes here...",
                    "persona_id": "expert_formal",
                }
            ]
        }
    }