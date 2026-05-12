"""
Persona schema validation.

Validates persona configuration against business rules.
"""

from .models import Persona, VoiceProfile, AvatarProfile


class PersonaValidationError(Exception):
    """Raised when persona configuration is invalid."""
    pass


def validate_persona(persona: Persona) -> list[str]:
    """
    Validate a persona configuration.

    Returns list of validation errors (empty if valid).
    """
    errors = []

    if not persona.persona_id:
        errors.append("persona_id is required")
    elif len(persona.persona_id) > 64:
        errors.append("persona_id must be 64 characters or less")
    elif not persona.persona_id.replace("_", "").replace("-", "").isalnum():
        errors.append("persona_id must be alphanumeric (underscores/dashes allowed)")

    if not persona.name:
        errors.append("name is required")
    elif len(persona.name) > 128:
        errors.append("name must be 128 characters or less")

    # Voice validation
    if persona.voice.speed < 0.5 or persona.voice.speed > 2.0:
        errors.append("voice.speed must be between 0.5 and 2.0")

    if persona.voice.pitch < -10 or persona.voice.pitch > 10:
        errors.append("voice.pitch must be between -10 and 10")

    if persona.voice.volume < 0.0 or persona.voice.volume > 1.0:
        errors.append("voice.volume must be between 0.0 and 1.0")

    # Avatar validation
    w, h = persona.avatar.resolution
    if w < 256 or h < 256:
        errors.append("avatar resolution must be at least 256x256")

    if persona.avatar.framing not in ("centered", "upper-third", "lower-third"):
        errors.append("avatar.framing must be one of: centered, upper-third, lower-third")

    # Caption validation
    if persona.caption_style.font_size < 16 or persona.caption_style.font_size > 128:
        errors.append("caption_style.font_size must be between 16 and 128")

    if persona.caption_style.margin_bottom < 0.0 or persona.caption_style.margin_bottom > 0.5:
        errors.append("caption_style.margin_bottom must be between 0.0 and 0.5")

    return errors


def validate_voice_profile(voice: VoiceProfile) -> list[str]:
    """Validate a voice profile."""
    errors = []
    if voice.speed < 0.5 or voice.speed > 2.0:
        errors.append("speed must be between 0.5 and 2.0")
    if voice.pitch < -10 or voice.pitch > 10:
        errors.append("pitch must be between -10 and 10")
    if voice.volume < 0.0 or voice.volume > 1.0:
        errors.append("volume must be between 0.0 and 1.0")
    if not voice.voice_id:
        errors.append("voice_id is required")
    return errors


def validate_avatar_profile(avatar: AvatarProfile) -> list[str]:
    """Validate an avatar profile."""
    errors = []
    w, h = avatar.resolution
    if w < 256 or h < 256:
        errors.append("resolution must be at least 256x256")
    if avatar.framing not in ("centered", "upper-third", "lower-third"):
        errors.append("framing must be one of: centered, upper-third, lower-third")
    return errors
