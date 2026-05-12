"""
Persona data models — canonical identity configuration.

All persona state is stored in these dataclasses.
Provider-specific fields (voice_id, avatar_id) are stored here,
NOT in the generation job or renderer.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class SpeakingStyle(str, Enum):
    EXPERT = "expert"          # Calm, measured, authoritative
    CASUAL = "casual"          # Conversational, friendly
    ENERGETIC = "energetic"    # High energy, punchy
    TECHNICAL = "technical"    # Deep detail, precise
    STORYTELLER = "storyteller" # Narrative flow, emotional


class HookStyle(str, Enum):
    PATTERN_INTERRUPT = "pattern_interrupt"  # Visual/auditory disruption
    PROVOCATION = "provocation"              # Challenging claim
    CURIOSITY = "curiosity"                  # Mystery gap
    AUTHORITY = "authority"                 # Expert positioning
    RELATABILITY = "relatability"           # Personal connection


class Pacing(str, Enum):
    SLOW = "slow"           # Deliberate, emphasis on clarity
    MODERATE = "moderate"  # Balanced delivery
    FAST = "fast"          # Quick, urgent, TikTok-native


class EnergyLevel(str, Enum):
    LOW = "low"      # Calm, grounded
    MEDIUM = "medium"  # Natural
    HIGH = "high"    # Dynamic, engaging


@dataclass
class AvatarProfile:
    """
    Avatar visual configuration.
    """
    avatar_id: str = "default"
    image_path: Optional[str] = None
    resolution: tuple[int, int] = (1080, 1920)
    background: str = "#000000"
    framing: str = "centered"  # centered, upper-third, lower-third
    show_shoulders: bool = True


@dataclass
class VoiceProfile:
    """
    Voice synthesis configuration.
    """
    voice_id: str = "mx_001"      # MiniMax voice ID
    voice_name: str = "default"
    speed: float = 1.0           # 0.5 - 2.0
    pitch: float = 0.0           # -10 to 10
    volume: float = 1.0          # 0.0 - 1.0
    trained: bool = False        # True if custom voice cloned


@dataclass
class CaptionStyle:
    """
    Caption styling for this persona.
    """
    style: str = "tiktok_bold"
    font_size: int = 48
    bold: bool = True
    color: str = "&H00FFFFFF"
    outline: int = 2
    shadow: int = 1
    position: str = "bottom"
    margin_bottom: float = 0.15
    karaoke_effect: bool = True
    punch_word_highlight: bool = True


@dataclass
class PersonaVersion:
    """
    Versioned snapshot of a persona.

    Personas are versioned so media remains consistent
    even after voice retraining or avatar changes.
    """
    version: str  # e.g. "v1", "v2"
    created_at: float  # Unix timestamp
    voice_profile: VoiceProfile
    avatar_profile: AvatarProfile
    changelog: str = ""


@dataclass
class Persona:
    """
    Canonical identity configuration for AI persona media.

    This is the primary identity object.
    All generation derives from this configuration.
    NEVER pass generation params directly to renderer.
    """
    persona_id: str
    name: str
    description: str = ""

    # Core profiles
    voice: VoiceProfile = field(default_factory=VoiceProfile)
    avatar: AvatarProfile = field(default_factory=AvatarProfile)
    caption_style: CaptionStyle = field(default_factory=CaptionStyle)

    # Behavioral configuration
    speaking_style: SpeakingStyle = SpeakingStyle.EXPERT
    pacing: Pacing = Pacing.MODERATE
    energy_level: EnergyLevel = EnergyLevel.MEDIUM

    # Content style
    hook_style: HookStyle = HookStyle.PATTERN_INTERRUPT
    intro_template: str = ""

    # Versioning
    current_version: str = "v1"
    version_history: list[PersonaVersion] = field(default_factory=list)

    # Metadata
    created_at: float = 0.0
    updated_at: float = 0.0
    is_active: bool = True

    def get_voice_profile(self) -> VoiceProfile:
        """Get the current voice profile."""
        return self.voice

    def get_avatar_profile(self) -> AvatarProfile:
        """Get the current avatar profile."""
        return self.avatar

    def get_caption_style(self) -> CaptionStyle:
        """Get the current caption style."""
        return self.caption_style

    def snapshot_version(self) -> PersonaVersion:
        """Create a version snapshot of current configuration."""
        return PersonaVersion(
            version=self.current_version,
            created_at=self.updated_at or self.created_at,
            voice_profile=self.voice,
            avatar_profile=self.avatar,
            changelog="",
        )

    def apply_version(self, version: PersonaVersion):
        """
        Apply a version snapshot, restoring that configuration.
        """
        self.current_version = version.version
        self.voice = version.voice_profile
        self.avatar = version.avatar_profile
