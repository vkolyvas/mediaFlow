from anthropic import AsyncAnthropic
from .base import LLMProvider


class AnthropicClaudeProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.client = AsyncAnthropic(api_key=api_key)

    async def generate(self, prompt: str, **kwargs) -> str:
        response = await self.client.messages.create(
            model=kwargs.get("model", "claude-sonnet-4-20250514"),
            max_tokens=kwargs.get("max_tokens", 1024),
            messages=[{"role": "user", "content": prompt}],
            thinking={"type": "disabled"},
        )
        block = response.content[0]
        return block.text if hasattr(block, "text") else str(block)