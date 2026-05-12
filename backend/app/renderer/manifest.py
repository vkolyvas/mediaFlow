"""
Scene manifest schema — the orchestration language for the renderer.

Semantic timing is separate from render timing.
Scene types: avatar, broll, image, video, text, silence
"""

from pydantic import BaseModel
from typing import Optional


class Layout(BaseModel):
    x: float = 0
    y: float = 0
    width: float = 1080
    height: float = 1920
    z_index: int = 0


class CaptionStyle(BaseModel):
    enabled: bool = True
    style: str = "tiktok_bold"
    position: str = "bottom"
    margin_bottom: float = 0.15


class CaptionWord(BaseModel):
    word: str
    start: float
    end: float
    emphasis: bool = False


class Scene(BaseModel):
    id: str
    type: str
    asset: Optional[str] = None
    start: float
    end: float
    layout: Layout = Layout()
    captions: Optional[dict] = None
    audio: Optional[str] = None
    volume: float = 1.0
    fade_in: float = 0.0
    fade_out: float = 0.0
    speed: float = 1.0


class SceneManifest(BaseModel):
    version: str = "1.0"
    resolution: tuple[int, int] = (1080, 1920)
    fps: int = 30
    duration: float
    timeline: list[Scene]
    background_color: str = "#000000"

    def total_duration(self) -> float:
        if not self.timeline:
            return 0.0
        return max(s.end for s in self.timeline)

    def get_scene_at(self, timestamp: float) -> list[Scene]:
        return [s for s in self.timeline if s.start <= timestamp < s.end]

    def get_scene_by_id(self, scene_id: str) -> Optional[Scene]:
        for s in self.timeline:
            if s.id == scene_id:
                return s
        return None
