"""
Persona storage and management.

PersonaManager provides CRUD operations for personas.
All personas are stored in a dedicated directory, separate from job artifacts.
"""

import json
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Optional

from .models import (
    Persona,
    PersonaVersion,
    SpeakingStyle,
    HookStyle,
    Pacing,
    EnergyLevel,
    AvatarProfile,
    VoiceProfile,
    CaptionStyle,
)


DEFAULT_PERSONA_ROOT = "/tmp/mediaflow/personas"


class PersonaManager:
    """
    Manages persona lifecycle — create, read, update, delete, version.

    All personas are stored in a dedicated directory tree:
        storage/personas/
            <persona_id>/
                metadata.json    — Persona dataclass as JSON
                versions/        — Historical version snapshots
                assets/
                    avatar/      — Avatar image files
                    voice/       — Voice sample files
                    prompts/     — Custom prompt templates

    Personas are NEVER mixed with transient job artifacts.
    """

    def __init__(self, root: str = DEFAULT_PERSONA_ROOT):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _persona_dir(self, persona_id: str) -> Path:
        return self.root / persona_id

    def _metadata_path(self, persona_id: str) -> Path:
        return self._persona_dir(persona_id) / "metadata.json"

    def _versions_dir(self, persona_id: str) -> Path:
        return self._persona_dir(persona_id) / "versions"

    def _assets_dir(self, persona_id: str) -> Path:
        return self._persona_dir(persona_id) / "assets"

    def _avatar_dir(self, persona_id: str) -> Path:
        d = self._assets_dir(persona_id) / "avatar"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _voice_dir(self, persona_id: str) -> Path:
        d = self._assets_dir(persona_id) / "voice"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _prompts_dir(self, persona_id: str) -> Path:
        d = self._assets_dir(persona_id) / "prompts"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _serialize(self, persona: Persona) -> dict:
        """Convert Persona to JSON-serializable dict."""
        def voice_to_dict(v: VoiceProfile) -> dict:
            return {
                "voice_id": v.voice_id,
                "voice_name": v.voice_name,
                "speed": v.speed,
                "pitch": v.pitch,
                "volume": v.volume,
                "trained": v.trained,
            }

        def avatar_to_dict(a: AvatarProfile) -> dict:
            return {
                "avatar_id": a.avatar_id,
                "image_path": a.image_path,
                "resolution": list(a.resolution),
                "background": a.background,
                "framing": a.framing,
                "show_shoulders": a.show_shoulders,
            }

        def caption_to_dict(c: CaptionStyle) -> dict:
            return {
                "style": c.style,
                "font_size": c.font_size,
                "bold": c.bold,
                "color": c.color,
                "outline": c.outline,
                "shadow": c.shadow,
                "position": c.position,
                "margin_bottom": c.margin_bottom,
                "karaoke_effect": c.karaoke_effect,
                "punch_word_highlight": c.punch_word_highlight,
            }

        return {
            "persona_id": persona.persona_id,
            "name": persona.name,
            "description": persona.description,
            "voice": voice_to_dict(persona.voice),
            "avatar": avatar_to_dict(persona.avatar),
            "caption_style": caption_to_dict(persona.caption_style),
            "speaking_style": persona.speaking_style.value,
            "pacing": persona.pacing.value,
            "energy_level": persona.energy_level.value,
            "hook_style": persona.hook_style.value,
            "intro_template": persona.intro_template,
            "current_version": persona.current_version,
            "version_history": [
                {
                    "version": v.version,
                    "created_at": v.created_at,
                    "voice_profile": {"voice_id": v.voice_profile.voice_id},
                    "avatar_profile": {"avatar_id": v.avatar_profile.avatar_id},
                    "changelog": v.changelog,
                }
                for v in persona.version_history
            ],
            "created_at": persona.created_at,
            "updated_at": persona.updated_at,
            "is_active": persona.is_active,
        }

    def _deserialize(self, data: dict) -> Persona:
        """Reconstruct Persona from dict."""
        voice_data = data.get("voice", {})
        avatar_data = data.get("avatar", {})
        caption_data = data.get("caption_style", {})

        version_history = []
        for v in data.get("version_history", []):
            vp = v.get("voice_profile", {})
            ap = v.get("avatar_profile", {})
            version_history.append(PersonaVersion(
                version=v["version"],
                created_at=v["created_at"],
                voice_profile=VoiceProfile(voice_id=vp.get("voice_id", "")),
                avatar_profile=AvatarProfile(avatar_id=ap.get("avatar_id", "")),
                changelog=v.get("changelog", ""),
            ))

        return Persona(
            persona_id=data["persona_id"],
            name=data["name"],
            description=data.get("description", ""),
            voice=VoiceProfile(
                voice_id=voice_data.get("voice_id", "mx_001"),
                voice_name=voice_data.get("voice_name", "default"),
                speed=voice_data.get("speed", 1.0),
                pitch=voice_data.get("pitch", 0.0),
                volume=voice_data.get("volume", 1.0),
                trained=voice_data.get("trained", False),
            ),
            avatar=AvatarProfile(
                avatar_id=avatar_data.get("avatar_id", "default"),
                image_path=avatar_data.get("image_path"),
                resolution=tuple(avatar_data.get("resolution", [1080, 1920])),
                background=avatar_data.get("background", "#000000"),
                framing=avatar_data.get("framing", "centered"),
                show_shoulders=avatar_data.get("show_shoulders", True),
            ),
            caption_style=CaptionStyle(
                style=caption_data.get("style", "tiktok_bold"),
                font_size=caption_data.get("font_size", 48),
                bold=caption_data.get("bold", True),
                color=caption_data.get("color", "&H00FFFFFF"),
                outline=caption_data.get("outline", 2),
                shadow=caption_data.get("shadow", 1),
                position=caption_data.get("position", "bottom"),
                margin_bottom=caption_data.get("margin_bottom", 0.15),
                karaoke_effect=caption_data.get("karaoke_effect", True),
                punch_word_highlight=caption_data.get("punch_word_highlight", True),
            ),
            speaking_style=SpeakingStyle(data.get("speaking_style", "expert")),
            pacing=Pacing(data.get("pacing", "moderate")),
            energy_level=EnergyLevel(data.get("energy_level", "medium")),
            hook_style=HookStyle(data.get("hook_style", "pattern_interrupt")),
            intro_template=data.get("intro_template", ""),
            current_version=data.get("current_version", "v1"),
            version_history=version_history,
            created_at=data.get("created_at", 0.0),
            updated_at=data.get("updated_at", 0.0),
            is_active=data.get("is_active", True),
        )

    def create(self, persona: Persona) -> Persona:
        """Create a new persona. Raises if persona_id already exists."""
        if self._metadata_path(persona.persona_id).exists():
            raise ValueError(f"Persona {persona.persona_id} already exists")

        persona.created_at = time.time()
        persona.updated_at = persona.created_at

        persona_dir = self._persona_dir(persona.persona_id)
        persona_dir.mkdir(parents=True, exist_ok=True)
        self._versions_dir(persona.persona_id).mkdir(parents=True, exist_ok=True)
        self._assets_dir(persona.persona_id).mkdir(parents=True, exist_ok=True)

        with open(self._metadata_path(persona.persona_id), "w") as f:
            json.dump(self._serialize(persona), f, indent=2)

        return persona

    def get(self, persona_id: str) -> Optional[Persona]:
        """Load a persona by ID. Returns None if not found."""
        path = self._metadata_path(persona_id)
        if not path.exists():
            return None

        with open(path) as f:
            data = json.load(f)
        return self._deserialize(data)

    def update(self, persona: Persona) -> Persona:
        """Update an existing persona. Raises if not found."""
        if not self._metadata_path(persona.persona_id).exists():
            raise ValueError(f"Persona {persona.persona_id} not found")

        persona.updated_at = time.time()

        with open(self._metadata_path(persona.persona_id), "w") as f:
            json.dump(self._serialize(persona), f, indent=2)

        return persona

    def delete(self, persona_id: str):
        """Delete a persona and all its assets."""
        shutil.rmtree(self._persona_dir(persona_id), ignore_errors=True)

    def list_all(self) -> list[Persona]:
        """List all personas."""
        personas = []
        for subdir in self.root.iterdir():
            if subdir.is_dir():
                p = self.get(subdir.name)
                if p:
                    personas.append(p)
        return personas

    def list_active(self) -> list[Persona]:
        """List only active personas."""
        return [p for p in self.list_all() if p.is_active]

    def add_version_snapshot(self, persona_id: str) -> PersonaVersion:
        """
        Create a version snapshot of current state.

        Call before making changes to preserve history.
        """
        persona = self.get(persona_id)
        if not persona:
            raise ValueError(f"Persona {persona_id} not found")

        snapshot = PersonaVersion(
            version=persona.current_version,
            created_at=time.time(),
            voice_profile=persona.voice,
            avatar_profile=persona.avatar,
            changelog="",
        )

        version_file = self._versions_dir(persona_id) / f"{snapshot.version}.json"
        with open(version_file, "w") as f:
            json.dump(self._serialize(persona), f)

        return snapshot

    def store_avatar_asset(self, persona_id: str, filename: str, content: bytes) -> str:
        """Store an avatar image asset."""
        path = self._avatar_dir(persona_id) / filename
        path.write_bytes(content)
        return str(path)

    def store_voice_asset(self, persona_id: str, filename: str, content: bytes) -> str:
        """Store a voice sample asset."""
        path = self._voice_dir(persona_id) / filename
        path.write_bytes(content)
        return str(path)

    def store_prompt_template(self, persona_id: str, filename: str, content: str) -> str:
        """Store a custom prompt template."""
        path = self._prompts_dir(persona_id) / filename
        path.write_text(content)
        return str(path)


_manager = None


def get_persona_manager(root: Optional[str] = None) -> PersonaManager:
    global _manager
    if _manager is None or root is not None:
        _manager = PersonaManager(root or DEFAULT_PERSONA_ROOT)
    return _manager
