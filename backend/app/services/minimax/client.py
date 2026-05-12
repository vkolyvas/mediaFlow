"""
MiniMax HTTP client with retry/timeout logic.
"""

import os
import time
import httpx
from typing import Optional, Any

from .exceptions import MiniMaxAPIError, MiniMaxRateLimitError


DEFAULT_BASE_URL = "https://api.minimax.io/v1"


class MiniMaxClient:
    """
    HTTP client for MiniMax API with built-in retry and timeout.

    Handles:
    - API key authentication
    - Automatic retry with exponential backoff
    - Rate limit handling (429 responses)
    - Timeout management
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
        max_retries: int = 3,
    ):
        self.api_key = api_key or os.environ.get("MINIMAX_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self._session: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self._session = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(self.timeout),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        return self

    async def __aexit__(self, *args):
        if self._session:
            await self._session.aclose()
            self._session = None

    async def _request(
        self,
        method: str,
        path: str,
        json: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict[str, Any]:
        if not self._session:
            raise RuntimeError("MiniMaxClient must be used as async context manager")

        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                response = await self._session.request(
                    method=method,
                    url=path,
                    json=json,
                    params=params,
                )

                if response.status_code == 429:
                    retry_after = int(response.headers.get("retry-after", 60))
                    raise MiniMaxRateLimitError(
                        f"Rate limited. Retry after {retry_after}s",
                        status_code=429,
                    )

                if response.status_code >= 400:
                    error_body = response.json() if response.text else {}
                    raise MiniMaxAPIError(
                        message=error_body.get("message", response.text),
                        status_code=response.status_code,
                        error_code=error_body.get("error_code", ""),
                    )

                return response.json()

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    wait = 2 ** attempt
                    time.sleep(wait)
            except MiniMaxRateLimitError:
                if attempt < self.max_retries - 1:
                    time.sleep(60)
            except MiniMaxAPIError:
                raise
            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    wait = 2 ** attempt
                    time.sleep(wait)

        raise MiniMaxAPIError(f"Request failed after {self.max_retries} attempts: {last_error}")

    async def post(self, path: str, json: Optional[dict] = None) -> dict[str, Any]:
        return await self._request("POST", path, json=json)

    async def get(self, path: str, params: Optional[dict] = None) -> dict[str, Any]:
        return await self._request("GET", path, params=params)

    async def get_capabilities(self) -> dict[str, Any]:
        """Query capabilities endpoint. Returns raw response."""
        return await self.get("/capabilities")

    async def submit_avatar_job(self, request: dict[str, Any]) -> dict[str, Any]:
        """Submit an avatar generation job."""
        return await self.post("/video/avatar", json=request)

    async def get_avatar_job_status(self, job_id: str) -> dict[str, Any]:
        """Poll status of an avatar job."""
        return await self.get(f"/video/avatar/{job_id}")

    async def submit_tts_job(self, request: dict[str, Any]) -> dict[str, Any]:
        """Submit a TTS generation job."""
        return await self.post("/t2a", json=request)

    async def get_tts_status(self, job_id: str) -> dict[str, Any]:
        """Poll TTS job status."""
        return await self.get(f"/t2a/{job_id}")
