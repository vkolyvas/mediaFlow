"""
Tests for persona subsystem.
"""

import pytest
import time
from app.personas import (
    Persona,
    PersonaVersion,
    SpeakingStyle,
    HookStyle,
    Pacing,
    EnergyLevel,
    AvatarProfile,
    VoiceProfile,
    CaptionStyle,
    PersonaManager,
    get_persona_manager,
    validate_persona,
    PersonaValidationError,
    DEFAULT_PRESETS,
    PRESET_REGISTRY,
    get_preset,
    list_presets,
)


class TestPersonaModels:
    def test_persona_defaults(self):
        p = Persona(persona_id="test", name="Test Persona")
        assert p.persona_id == "test"
        assert p.name == "Test Persona"
        assert p.speaking_style == SpeakingStyle.EXPERT
        assert p.pacing == Pacing.MODERATE
        assert p.energy_level == EnergyLevel.MEDIUM
        assert p.hook_style == HookStyle.PATTERN_INTERRUPT
        assert p.is_active is True

    def test_persona_versions(self):
        p = Persona(
            persona_id="vtest",
            name="Version Test",
            voice=VoiceProfile(voice_id="v1_voice"),
            avatar=AvatarProfile(avatar_id="v1_avatar"),
        )
        snapshot = p.snapshot_version()
        assert snapshot.version == "v1"
        assert snapshot.voice_profile.voice_id == "v1_voice"
        assert snapshot.avatar_profile.avatar_id == "v1_avatar"

    def test_speaking_styles(self):
        assert SpeakingStyle.EXPERT.value == "expert"
        assert SpeakingStyle.CASUAL.value == "casual"
        assert SpeakingStyle.ENERGETIC.value == "energetic"

    def test_avatar_profile_defaults(self):
        ap = AvatarProfile()
        assert ap.avatar_id == "default"
        assert ap.resolution == (1080, 1920)
        assert ap.background == "#000000"
        assert ap.show_shoulders is True


class TestPersonaManager:
    def test_create_and_get(self, tmp_path):
        mgr = PersonaManager(root=str(tmp_path))
        p = Persona(persona_id="test1", name="Test One")
        created = mgr.create(p)
        assert created.persona_id == "test1"
        assert created.created_at > 0

        loaded = mgr.get("test1")
        assert loaded is not None
        assert loaded.name == "Test One"
        assert loaded.persona_id == "test1"

    def test_create_duplicate_raises(self, tmp_path):
        mgr = PersonaManager(root=str(tmp_path))
        p = Persona(persona_id="dup", name="Duplicate")
        mgr.create(p)
        with pytest.raises(ValueError, match="already exists"):
            mgr.create(p)

    def test_update(self, tmp_path):
        mgr = PersonaManager(root=str(tmp_path))
        p = Persona(persona_id="update_test", name="Before")
        mgr.create(p)

        p.name = "After"
        mgr.update(p)

        loaded = mgr.get("update_test")
        assert loaded.name == "After"

    def test_delete(self, tmp_path):
        mgr = PersonaManager(root=str(tmp_path))
        p = Persona(persona_id="delete_me", name="Delete Me")
        mgr.create(p)
        assert mgr.get("delete_me") is not None

        mgr.delete("delete_me")
        assert mgr.get("delete_me") is None

    def test_list_all(self, tmp_path):
        mgr = PersonaManager(root=str(tmp_path))
        mgr.create(Persona(persona_id="a", name="A"))
        mgr.create(Persona(persona_id="b", name="B"))

        all_personas = mgr.list_all()
        assert len(all_personas) == 2

    def test_version_snapshot(self, tmp_path):
        mgr = PersonaManager(root=str(tmp_path))
        p = Persona(persona_id="snap_test", name="Snap Test")
        mgr.create(p)

        snapshot = mgr.add_version_snapshot("snap_test")
        assert snapshot.version == "v1"
        assert snapshot.created_at > 0

    def test_store_avatar_asset(self, tmp_path):
        mgr = PersonaManager(root=str(tmp_path))
        p = Persona(persona_id="asset_test", name="Asset Test")
        mgr.create(p)

        path = mgr.store_avatar_asset("asset_test", "face.png", b"fake_image_data")
        import os
        assert os.path.exists(path)
        assert open(path, "rb").read() == b"fake_image_data"

    def test_store_voice_asset(self, tmp_path):
        mgr = PersonaManager(root=str(tmp_path))
        p = Persona(persona_id="voice_test", name="Voice Test")
        mgr.create(p)

        path = mgr.store_voice_asset("voice_test", "sample.wav", b"fake_audio_data")
        import os
        assert os.path.exists(path)


class TestPresets:
    def test_default_presets_exist(self):
        assert len(DEFAULT_PRESETS) >= 2
        for p in DEFAULT_PRESETS:
            assert p.persona_id
            assert p.name
            assert p.description

    def test_preset_registry(self):
        for p in DEFAULT_PRESETS:
            assert PRESET_REGISTRY[p.persona_id] == p

    def test_get_preset(self):
        p = get_preset("expert_formal")
        assert p is not None
        assert p.name == "Dr. Formal"

    def test_get_preset_not_found(self):
        assert get_preset("nonexistent") is None

    def test_list_presets(self):
        presets = list_presets()
        assert len(presets) == len(DEFAULT_PRESETS)


class TestValidation:
    def test_validate_persona_valid(self):
        p = Persona(persona_id="valid_test", name="Valid Test")
        errors = validate_persona(p)
        assert len(errors) == 0

    def test_validate_persona_invalid_id(self):
        p = Persona(persona_id="", name="No ID")
        errors = validate_persona(p)
        assert any("persona_id" in e for e in errors)

    def test_validate_voice_speed_out_of_range(self):
        p = Persona(persona_id="test", name="Test", voice=VoiceProfile(speed=5.0))
        errors = validate_persona(p)
        assert any("speed" in e for e in errors)

    def test_validate_caption_font_size(self):
        p = Persona(
            persona_id="test",
            name="Test",
            caption_style=CaptionStyle(font_size=200),
        )
        errors = validate_persona(p)
        assert any("font_size" in e for e in errors)
