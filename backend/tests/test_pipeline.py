"""
Tests for pipeline state machine and context.
"""

import pytest
from app.pipeline import PipelineState, GenerationContext, PipelineJob
from app.personas import Persona, SpeakingStyle


class TestPipelineState:
    def test_created_is_initial(self):
        assert PipelineState.CREATED.value == 1

    def test_forward_transitions(self):
        assert PipelineState.CREATED.can_transition_to(PipelineState.SCRIPT_GENERATED)
        assert PipelineState.SCRIPT_GENERATED.can_transition_to(PipelineState.TTS_GENERATED)
        assert PipelineState.TTS_GENERATED.can_transition_to(PipelineState.ASSETS_READY)
        assert PipelineState.ASSETS_READY.can_transition_to(PipelineState.CAPTIONS_ALIGNED)
        assert PipelineState.CAPTIONS_ALIGNED.can_transition_to(PipelineState.RENDERING)
        assert PipelineState.RENDERING.can_transition_to(PipelineState.COMPLETED)

    def test_backward_transitions_blocked(self):
        assert not PipelineState.TTS_GENERATED.can_transition_to(PipelineState.SCRIPT_GENERATED)
        assert not PipelineState.RENDERING.can_transition_to(PipelineState.CREATED)

    def test_failed_can_transition_to_nothing(self):
        assert not PipelineState.FAILED.can_transition_to(PipelineState.COMPLETED)
        assert not PipelineState.FAILED.can_transition_to(PipelineState.CREATED)

    def test_any_state_can_transition_to_failed(self):
        assert PipelineState.CREATED.can_transition_to(PipelineState.FAILED)
        assert PipelineState.TTS_GENERATED.can_transition_to(PipelineState.FAILED)
        assert PipelineState.RENDERING.can_transition_to(PipelineState.FAILED)

    def test_terminal_states(self):
        assert PipelineState.COMPLETED.is_terminal()
        assert PipelineState.FAILED.is_terminal()
        assert not PipelineState.CREATED.is_terminal()
        assert not PipelineState.RENDERING.is_terminal()


class TestGenerationContext:
    def test_basic_context(self):
        p = Persona(persona_id="test", name="Test")
        ctx = GenerationContext(job_id="j1", persona=p, transcript="Hello world")
        assert ctx.job_id == "j1"
        assert ctx.transcript == "Hello world"
        assert ctx.script is None
        assert ctx.voice_asset is None
        assert not ctx.is_failed()

    def test_failed_context(self):
        p = Persona(persona_id="test", name="Test")
        ctx = GenerationContext(job_id="j1", persona=p, error="Something broke")
        assert ctx.is_failed()
        assert ctx.error == "Something broke"

    def test_get_caption_words_empty(self):
        p = Persona(persona_id="test", name="Test")
        ctx = GenerationContext(job_id="j1", persona=p)
        words = ctx.get_caption_words()
        assert words == []


class TestPipelineJob:
    def test_job_to_dict(self):
        job = PipelineJob(
            job_id="j1",
            persona_id="expert_formal",
            state=PipelineState.CREATED,
            created_at=1000.0,
            updated_at=1000.0,
            transcript_length=500,
        )
        d = job.to_dict()
        assert d["job_id"] == "j1"
        assert d["state"] == "CREATED"
        assert d["transcript_length"] == 500

    def test_job_from_dict(self):
        d = {
            "job_id": "j1",
            "persona_id": "expert_formal",
            "state": "COMPLETED",
            "created_at": 1000.0,
            "updated_at": 2000.0,
            "transcript_length": 500,
            "script_length": 300,
        }
        job = PipelineJob.from_dict(d)
        assert job.job_id == "j1"
        assert job.state == PipelineState.COMPLETED
        assert job.script_length == 300

    def test_job_roundtrip(self):
        job = PipelineJob(
            job_id="roundtrip",
            persona_id="friendly_guide",
            state=PipelineState.TTS_GENERATED,
            created_at=1000.0,
            updated_at=1500.0,
        )
        restored = PipelineJob.from_dict(job.to_dict())
        assert restored.job_id == job.job_id
        assert restored.state == job.state
        assert restored.persona_id == job.persona_id
