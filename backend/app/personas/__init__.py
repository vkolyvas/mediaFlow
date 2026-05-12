"""
Persona subsystem — identity configuration for AI persona media pipeline.

Canonical identity model separated from generation jobs.
Supports versioning, voice/avatar profiles, speaking styles.

Submodules:
    models      — Persona, PersonaVersion dataclasses
    storage     — PersonaManager for CRUD operations
    presets     — Predefined persona templates
    validation  — Schema validation for persona fields
"""

from .models import Persona, PersonaVersion, SpeakingStyle, HookStyle, Pacing, EnergyLevel, AvatarProfile, VoiceProfile, CaptionStyle
from .storage import PersonaManager, get_persona_manager
from .presets import DEFAULT_PRESETS, PRESET_REGISTRY, get_preset, list_presets
from .validation import validate_persona, PersonaValidationError

__all__ = [
    "Persona",
    "PersonaVersion",
    "SpeakingStyle",
    "HookStyle",
    "Pacing",
    "EnergyLevel",
    "AvatarProfile",
    "VoiceProfile",
    "CaptionStyle",
    "PersonaManager",
    "get_persona_manager",
    "DEFAULT_PRESETS",
    "PRESET_REGISTRY",
    "get_preset",
    "list_presets",
    "validate_persona",
    "PersonaValidationError",
]
