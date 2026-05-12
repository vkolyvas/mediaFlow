"""
Predefined persona templates.

These are ready-to-use persona configurations for common use cases.
Use as-is or fork and customize with PersonaManager.
"""

from .models import (
    Persona,
    SpeakingStyle,
    HookStyle,
    Pacing,
    EnergyLevel,
    AvatarProfile,
    VoiceProfile,
    CaptionStyle,
)


def _expert_persona(
    persona_id: str,
    name: str,
    description: str,
) -> Persona:
    """Base expert persona — calm, authoritative, measured pacing."""
    return Persona(
        persona_id=persona_id,
        name=name,
        description=description,
        voice=VoiceProfile(voice_id="mx_001", speed=0.95, pitch=0.0),
        avatar=AvatarProfile(framing="centered", show_shoulders=True),
        caption_style=CaptionStyle(style="tiktok_bold", bold=True, karaoke_effect=True),
        speaking_style=SpeakingStyle.EXPERT,
        pacing=Pacing.MODERATE,
        energy_level=EnergyLevel.MEDIUM,
        hook_style=HookStyle.AUTHORITY,
    )


def _casual_explainer_persona(
    persona_id: str,
    name: str,
    description: str,
) -> Persona:
    """Casual, friendly explainer — conversational, relatable."""
    return Persona(
        persona_id=persona_id,
        name=name,
        description=description,
        voice=VoiceProfile(voice_id="mx_001", speed=1.05, pitch=0.0),
        avatar=AvatarProfile(framing="centered", show_shoulders=True),
        caption_style=CaptionStyle(style="tiktok_bold", bold=True, karaoke_effect=True),
        speaking_style=SpeakingStyle.CASUAL,
        pacing=Pacing.MODERATE,
        energy_level=EnergyLevel.MEDIUM,
        hook_style=HookStyle.CURIOSITY,
    )


DEFAULT_PRESETS = [
    _expert_persona(
        persona_id="expert_formal",
        name="Dr. Formal",
        description="Authoritative expert — formal tone, deep credibility",
    ),
    _expert_persona(
        persona_id="expert_technical",
        name="The Technician",
        description="Technical deep-dive expert — precise, detail-heavy",
    ),
    _casual_explainer_persona(
        persona_id="friendly_guide",
        name="Friendly Guide",
        description="Approachable explainer — conversational and relatable",
    ),
    _casual_explainer_persona(
        persona_id="tech_savvy",
        name="Tech Savvy",
        description="Modern tech explainer — energetic, trend-aware",
    ),
]


PRESET_REGISTRY = {p.persona_id: p for p in DEFAULT_PRESETS}


def get_preset(persona_id: str) -> Persona | None:
    """Get a preset persona by ID."""
    return PRESET_REGISTRY.get(persona_id)


def list_presets() -> list[Persona]:
    """List all available preset personas."""
    return list(DEFAULT_PRESETS)
