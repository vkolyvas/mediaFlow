"""
Async job polling with exponential backoff.

MiniMax video generation is async — this module handles:
- Job submission
- Polling with configurable interval and timeout
- Completion detection
- Error propagation
"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable

from .exceptions import MiniMaxTimeoutError, MiniMaxAPIError


@dataclass
class PollingConfig:
    """
    Configuration for job polling behavior.
    """
    initial_interval: float = 2.0
    max_interval: float = 30.0
    backoff_multiplier: float = 1.5
    timeout: float = 300.0
    max_attempts: Optional[int] = None

    def next_interval(self, current: float) -> float:
        return min(current * self.backoff_multiplier, self.max_interval)


async def poll_until_done(
    submit_fn: Callable[[], Awaitable[dict]],
    status_fn: Callable[[str], Awaitable[dict]],
    job_id: str,
    config: Optional[PollingConfig] = None,
    on_progress: Optional[Callable[[float], None]] = None,
) -> dict:
    """
    Poll a MiniMax job until completion or timeout.

    Args:
        submit_fn:  Async function to submit job (returns job_id dict)
        status_fn:  Async function to poll job status (returns status dict)
        job_id:     The job ID to poll
        config:     PollingConfig with timing parameters
        on_progress: Optional callback with progress fraction (0.0-1.0)

    Returns:
        Final status dict from the provider

    Raises:
        MiniMaxTimeoutError: If job doesn't complete within timeout
        MiniMaxAPIError: If job enters failed/error state
    """
    cfg = config or PollingConfig()
    start_time = time.monotonic()
    interval = cfg.initial_interval
    attempts = 0

    while True:
        elapsed = time.monotonic() - start_time
        if elapsed > cfg.timeout:
            raise MiniMaxTimeoutError(
                f"Job {job_id} timed out after {elapsed:.1f}s"
            )

        if cfg.max_attempts and attempts >= cfg.max_attempts:
            raise MiniMaxTimeoutError(
                f"Job {job_id} exceeded max attempts ({cfg.max_attempts})"
            )

        await asyncio.sleep(interval)

        status = await status_fn(job_id)
        attempts += 1

        job_status = status.get("status", status.get("status_code", ""))
        progress = status.get("progress", status.get("data", {}).get("progress", 0.0))

        if on_progress and progress:
            on_progress(float(progress))

        if job_status in ("completed", "success", "done"):
            return status
        elif job_status in ("failed", "error"):
            error_msg = status.get("message", status.get("error_message", "Unknown error"))
            raise MiniMaxAPIError(f"Job {job_id} failed: {error_msg}")
        elif job_status == "processing":
            interval = cfg.next_interval(interval)
        else:
            interval = cfg.next_interval(interval)

    return status


async def poll_tts_until_done(
    client,
    job_id: str,
    config: Optional[PollingConfig] = None,
) -> dict:
    """
    Specialized TTS polling — MiniMax TTS is often sync/short.

    Polls until audio_url is present in response.
    """
    cfg = config or PollingConfig(timeout=60.0)

    async def status_fn(jid: str) -> dict:
        return await client.get_tts_status(jid)

    status = await poll_until_done(
        submit_fn=lambda: {"job_id": job_id},
        status_fn=status_fn,
        job_id=job_id,
        config=cfg,
    )

    return status
