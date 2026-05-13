"""
PipelineOrchestrator — the application core.

Orchestrates all generation stages through GenerationContext.
FastAPI routes call this, not services directly.

Pipeline flow:
    CREATED → SCRIPT_GENERATED → TTS_GENERATED → ASSETS_READY → CAPTIONS_ALIGNED → RENDERING → COMPLETED
                                                                      ↓
                                                                   FAILED
"""

import logging
import shutil
import time
import traceback
import uuid
from pathlib import Path
from typing import Callable, Optional

from ..personas import PersonaManager, get_persona_manager, Persona
from ..services.minimax import (
    MiniMaxClient,
    JobStorage,
    get_storage,
)
from ..renderer import (
    SceneManifest,
    Scene,
    FFmpegRenderEngine,
    align_audio_to_words,
    CaptionWord,
)
from ..providers.tts import TTSProvider, TTSResult
from ..repositories.jobs import JsonPipelineRepository, PipelineRepository
from .context import GenerationContext
from .states import PipelineState
from .models import PipelineJob


logger = logging.getLogger(__name__)

DEFAULT_OUTPUT_DIR = "/tmp/mediaflow/output"
DEFAULT_STORAGE_ROOT = "/tmp/mediaflow/storage"


def validate_external_dependencies() -> list[str]:
    """
    Check required external tools are available.

    Returns list of missing tools. Empty if all present.
    """
    missing = []
    for tool in ["ffmpeg"]:
        if not shutil.which(tool):
            missing.append(tool)
    return missing


# Declarative stage dispatch table:
# Maps current state → (handler method name, next state after success)
_STAGE_HANDLER_NAMES: dict[PipelineState, tuple[str, PipelineState]] = {
    PipelineState.SCRIPT_GENERATED: ("_generate_tts", PipelineState.TTS_GENERATED),
    PipelineState.TTS_GENERATED: ("_align_captions", PipelineState.CAPTIONS_ALIGNED),
    PipelineState.CAPTIONS_ALIGNED: ("_render", PipelineState.COMPLETED),
}


class PipelineOrchestrator:
    """
    Central orchestration for persona-driven video generation.

    Responsibilities:
    1. Load and validate persona
    2. Manage GenerationContext lifecycle
    3. Execute each pipeline stage in order
    4. Enforce state transitions via repository
    5. Persist context after every stage (checkpoint pattern)
    6. Propagate errors to FAILED state with structured metadata

    Renderer receives ONLY SceneManifest + normalized assets.
    """

    def __init__(
        self,
        output_dir: str = DEFAULT_OUTPUT_DIR,
        persona_manager: Optional[PersonaManager] = None,
        storage: Optional[JobStorage] = None,
        tts_provider: Optional[TTSProvider] = None,
        repo: Optional[PipelineRepository] = None,
    ):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.persona_manager = persona_manager or get_persona_manager()
        self.storage = storage or get_storage()
        self.renderer = FFmpegRenderEngine(workspace_dir=str(self.output_dir))
        self.tts_provider = tts_provider
        self.repo = repo or JsonPipelineRepository(root=DEFAULT_STORAGE_ROOT)

        # Validate external tools at startup
        missing = validate_external_dependencies()
        if missing:
            logger.warning(f"Missing external tools: {missing}")

    def _get_tts_provider(self) -> TTSProvider:
        """Lazy-create TTS provider when needed."""
        if self.tts_provider:
            return self.tts_provider
        from ..providers.tts import MiniMaxTTSProvider
        from ..app.config import settings
        client = MiniMaxClient(
            api_key=settings.minimax_api_key,
            base_url=settings.minimax_base_url,
        )
        return MiniMaxTTSProvider(client=client, storage=self.storage)

    async def create_job(
        self,
        transcript: str,
        persona_id: str,
        job_id: Optional[str] = None,
    ) -> tuple[str, GenerationContext, PipelineJob]:
        """
        Create job record and initial context. Does not execute pipeline stages.

        Returns (job_id, context, job) for immediate response while
        pipeline stages run in background.
        """
        job_id = job_id or str(uuid.uuid4())[:8]

        persona = self.persona_manager.get(persona_id)
        if not persona:
            persona = self.persona_manager.get("expert_formal")

        if not persona:
            raise ValueError(f"Persona {persona_id} not found and no default available")

        context = GenerationContext(
            job_id=job_id,
            persona=persona,
            transcript=transcript,
        )

        job = PipelineJob(
            job_id=job_id,
            persona_id=persona_id,
            state=PipelineState.CREATED,
            created_at=time.time(),
            updated_at=time.time(),
            transcript_length=len(transcript),
            started_at=time.time(),
        )

        await self.repo.create_job(job)
        await self.repo.save_context(context)
        await self.repo.save_artifacts(job_id, context.artifacts)

        return job_id, context, job

    async def run_pipeline(
        self,
        job_id: str,
        context: GenerationContext,
        job: PipelineJob,
    ) -> tuple[GenerationContext, PipelineJob]:
        """
        Execute pipeline stages for an existing job.

        Idempotent — safe to call via BackgroundTasks after create_job().
        """
        # Stage 1: Script generation
        try:
            context = await self._generate_script(context)
            await self._advance_stage(context, job, PipelineState.SCRIPT_GENERATED)
        except Exception as e:
            return await self._finalize_failure(job, context, PipelineState.CREATED, e)

        # Stage 2: TTS generation (idempotent — skip if voice_asset exists)
        try:
            context = await self._generate_tts(context)
            await self._advance_stage(context, job, PipelineState.TTS_GENERATED)
        except Exception as e:
            return await self._finalize_failure(job, context, PipelineState.SCRIPT_GENERATED, e)

        # Stage 3: Caption alignment
        try:
            context = await self._align_captions(context)
            await self._advance_stage(context, job, PipelineState.CAPTIONS_ALIGNED)
        except Exception as e:
            return await self._finalize_failure(job, context, PipelineState.TTS_GENERATED, e)

        # Stage 4: Build manifest + render
        try:
            context = await self._render(context)
            context.output_path = str(self.output_dir / context.job_id / "render.mp4") if context.render_manifest else None
            return await self._finalize_success(job, context)
        except Exception as e:
            return await self._finalize_failure(job, context, PipelineState.CAPTIONS_ALIGNED, e)

    async def resume_job(self, job_id: str) -> tuple[GenerationContext, PipelineJob]:
        """
        Resume a partial job from disk.

        Loads context, inspects state, continues from next valid stage
        using the declarative stage dispatch table.
        """
        job = await self.repo.load_job(job_id)
        context = await self.repo.load_context(job_id)

        state = job.state
        if state == PipelineState.COMPLETED or state == PipelineState.FAILED:
            return context, job

        if state == PipelineState.CREATED:
            # Job exists but stages never ran — run pipeline on existing context
            return await self.run_pipeline(job_id, context, job)

        # Use dispatch table to run all remaining stages
        current_state = state
        while current_state not in (PipelineState.COMPLETED, PipelineState.FAILED):
            entry = STAGE_HANDLERS.get(current_state)
            if not entry:
                raise ValueError(f"No handler configured for state {current_state}")

            handler_name, target_state = entry
            handler = getattr(self, handler_name)
            try:
                context = await handler(context)
            except Exception as e:
                return await self._finalize_failure(job, context, current_state, e)

            if target_state == PipelineState.COMPLETED:
                return await self._finalize_success(job, context)

            await self._advance_stage(context, job, target_state)
            current_state = target_state

        return context, job

    async def _advance_stage(
        self,
        ctx: GenerationContext,
        job: PipelineJob,
        new_state: PipelineState,
    ) -> None:
        """Checkpoint after a successful stage."""
        previous = job.state
        job.state = new_state
        job.script_length = len(ctx.script or "") if ctx.script else 0
        job.updated_at = time.time()
        ctx.log_transition(previous, new_state, time.time())
        await self.repo.save_job(job)
        await self.repo.save_context(ctx)
        await self.repo.save_artifacts(job.job_id, ctx.artifacts)
        logger.info(
            "stage_completed",
            extra={
                "job_id": job.job_id,
                "stage": new_state.name,
                "script_length": job.script_length,
            },
        )

    async def _finalize_success(
        self,
        job: PipelineJob,
        ctx: GenerationContext,
    ) -> tuple[GenerationContext, PipelineJob]:
        """Mark job as COMPLETED with timing metadata and persist."""
        job.state = PipelineState.COMPLETED
        job.completed_at = time.time()
        job.duration_sec = job.completed_at - (job.started_at or job.created_at)
        job.updated_at = time.time()

        await self.repo.save_job(job)
        await self.repo.save_context(ctx)
        await self.repo.save_artifacts(job.job_id, ctx.artifacts)

        return ctx, job

    async def _finalize_failure(
        self,
        job: PipelineJob,
        ctx: GenerationContext,
        from_state: PipelineState,
        exc: Exception,
    ) -> tuple[GenerationContext, PipelineJob]:
        """Transition to FAILED with structured error metadata and timing."""
        error_msg = str(exc)
        stack = traceback.format_exc()

        ctx.error = error_msg
        ctx.last_error = {
            "stage": from_state.name,
            "error_type": type(exc).__name__,
            "message": error_msg,
            "traceback": stack,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        }
        ctx.log_transition(from_state, PipelineState.FAILED, time.time(), error_msg)

        job.state = PipelineState.FAILED
        job.error_message = error_msg
        job.completed_at = time.time()
        if job.started_at:
            job.duration_sec = job.completed_at - job.started_at
        job.updated_at = time.time()

        await self.repo.save_job(job)
        await self.repo.save_context(ctx)
        await self.repo.save_error(job.job_id, ctx.last_error)

        logger.error(
            "stage_failed",
            extra={
                "job_id": job.job_id,
                "stage": from_state.name,
                "error_type": type(exc).__name__,
                "error_message": error_msg,
                "duration_sec": job.duration_sec,
            },
        )

        return ctx, job

    async def _generate_script(self, ctx: GenerationContext) -> GenerationContext:
        """Generate TikTok script from transcript using persona."""
        from ..ai import AnthropicClaudeProvider
        from ..app.config import settings

        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY not configured")

        ai = AnthropicClaudeProvider(api_key=settings.anthropic_api_key)

        hook_prompt = f"""You are a TikTok scriptwriter for a {ctx.persona.speaking_style.value} persona.

Generate 3 hook variants for this transcript. Each hook must:
- Start with a pattern interrupt (visual or auditory disruption)
- Under 15 words
- Create curiosity or emotion in the first second
- No setup — dive straight in

Return ONLY a JSON array of 3 hooks:
["hook1", "hook2", "hook3"]

Transcript:
{ctx.transcript[:500]}"""

        body_prompt = f"""You are a TikTok scriptwriter for a {ctx.persona.speaking_style.value} persona.

Write a 30-45 second TikTok script based on this transcript.

Rules:
- Follow {ctx.persona.hook_style.value} hook style
- Use {ctx.persona.pacing.value} pacing
- Include natural pauses
- End with a question or CTA

Script (output JSON):
{{"script": "...", "emphasis_markers": ["word1", "word2"]}}

Transcript:
{ctx.transcript}"""

        try:
            import json
            hooks_raw = await ai.generate(hook_prompt, max_tokens=500)
            hooks = json.loads(hooks_raw)
            ctx.hook_variant = hooks[0] if isinstance(hooks, list) else hooks[0].get("hook", "")
        except Exception:
            ctx.hook_variant = ctx.transcript[:50] + "..."

        try:
            body_raw = await ai.generate(body_prompt, max_tokens=1500)
            body = json.loads(body_raw)
            ctx.script = ctx.hook_variant + "\n\n" + body.get("script", ctx.transcript[:500])
        except Exception:
            ctx.script = ctx.transcript[:500]

        return ctx

    async def _generate_tts(self, ctx: GenerationContext) -> GenerationContext:
        """
        Generate TTS audio using persona voice profile via TTSProvider.

        Persona fields used:
        - voice.voice_id: MiniMax voice identifier
        - voice.speed: speech rate multiplier
        - voice.pitch: pitch adjustment
        - voice.volume: volume level
        """
        if not ctx.script:
            raise ValueError("No script to speak")

        # Idempotent: skip if voice asset already exists
        if ctx.voice_asset:
            return ctx

        voice = ctx.persona.voice

        tts_provider = self._get_tts_provider()
        result: TTSResult = await tts_provider.generate(
            text=ctx.script,
            voice_id=voice.voice_id,
            speed=voice.speed,
            pitch=voice.pitch,
            volume=voice.volume,
        )

        ctx.voice_asset = str(result.audio_path)
        ctx.artifacts["audio"] = result.audio_path
        if result.raw_response_path:
            ctx.artifacts["raw_tts_response"] = result.raw_response_path

        return ctx

    async def _align_captions(self, ctx: GenerationContext) -> GenerationContext:
        """Align TTS audio with word timestamps via Whisper."""
        if not ctx.voice_asset:
            ctx.captions = self._fallback_captions(ctx.script or ctx.transcript)
            return ctx

        try:
            words = align_audio_to_words(
                audio_path=ctx.voice_asset,
                reference_text=ctx.script or ctx.transcript,
            )
            ctx.captions = words
        except Exception:
            ctx.captions = self._fallback_captions(ctx.script or ctx.transcript)

        return ctx

    def _fallback_captions(self, text: str) -> list[CaptionWord]:
        """Generate even-spaced captions when alignment fails."""
        words = text.split()
        total = len(words)
        if total == 0:
            return []
        duration = max(total * 0.4, 1.0)
        per_word = duration / total
        result = []
        t = 0.0
        for w in words:
            result.append(CaptionWord(word=w, start=t, end=t + per_word, emphasis=False))
            t += per_word
        return result

    async def _render(self, ctx: GenerationContext) -> GenerationContext:
        """Build manifest and render to MP4."""
        duration = sum(w.end for w in ctx.captions) if ctx.captions else 30.0

        scenes = [
            Scene(
                id="avatar_scene",
                type="silence",
                asset=None,
                start=0.0,
                end=duration,
                captions={
                    "enabled": True,
                    "style": ctx.persona.caption_style.style,
                },
            ),
        ]

        manifest = SceneManifest(
            resolution=(1080, 1920),
            fps=30,
            duration=duration,
            timeline=scenes,
            background_color=ctx.persona.avatar.background,
        )

        ctx.render_manifest = manifest

        job = self.renderer.create_job(manifest, str(self.output_dir / ctx.job_id))

        if ctx.voice_asset:
            job.add_asset("avatar_scene", ctx.voice_asset)

        if ctx.captions:
            job.set_caption_words(ctx.get_caption_words())

        output_path, error = self.renderer.render(job)

        if error:
            raise RuntimeError(error)

        return ctx