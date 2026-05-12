"""
MiniMax TTS provider implementation.
"""

import time
from pathlib import Path
from typing import Optional

from ...services.minimax import (
    MiniMaxClient,
    JobStorage,
    get_storage,
    poll_until_done,
    PollingConfig,
)
from .base import TTSProvider, TTSResult
from ...services.minimax.exceptions import MiniMaxError, MiniMaxTimeoutError


class MiniMaxTTSProvider:
    """
    MiniMax TTS via the t2a endpoint.

    Transforms voice_id/speed/pitch into MiniMax request format,
    downloads audio, and returns a canonical TTSResult.
    """

    def __init__(
        self,
        client: MiniMaxClient,
        storage: Optional[JobStorage] = None,
        poll_config: Optional[PollingConfig] = None,
    ):
        self.client = client
        self.storage = storage or get_storage()
        self.poll_config = poll_config or PollingConfig(timeout=120)

    async def generate(
        self,
        text: str,
        voice_id: str = "mx_001",
        speed: float = 1.0,
        pitch: float = 0.0,
        volume: float = 1.0,
    ) -> TTSResult:
        """
        Generate TTS via MiniMax t2a endpoint.

        Submits job, polls until done, downloads audio, persists raw response.
        """
        request = {
            "model": "speech-01",
            "text": text,
            "voice_setting": {
                "voice_id": voice_id,
                "speed": speed,
                "pitch": pitch,
                "volume": volume,
            },
            "output_format": "aac",
        }

        response = await self.client.submit_tts_job(request)
        job_id = response.get("job_id") or response.get("data", {}).get("job_id", "")
        raw_path = Path(self.storage.job_dir(job_id)) / "raw" / "tts_response.json"
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        import json
        raw_path.write_text(json.dumps(response, indent=2))

        status_response = await poll_until_done(
            self.client.get_tts_status,
            job_id,
            config=self.poll_config,
        )

        audio_url = status_response.get("audio_url") or status_response.get("data", {}).get("audio_url")
        if not audio_url:
            raise MiniMaxError(f"No audio_url in response: {status_response}")

        audio_path = Path(self.storage.job_dir(job_id)) / "normalized" / "audio.aac"
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        await self._download_audio(audio_url, audio_path)

        duration = status_response.get("duration_seconds") or status_response.get("data", {}).get("duration", 0.0)

        return TTSResult(
            audio_path=audio_path,
            duration_sec=float(duration),
            raw_response_path=raw_path,
            text=text,
        )

    async def _download_audio(self, url: str, dest: Path) -> None:
        """Download audio file from URL."""
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            dest.write_bytes(response.content)
