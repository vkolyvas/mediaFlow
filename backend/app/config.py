from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = "127.0.0.1"
    port: int = 8040
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    minimax_api_key: str = ""
    minimax_base_url: str = "https://api.minimax.io/v1"
    default_model: str = "claude-sonnet-4-20250514"
    max_tokens_per_call: int = 2000

    class Config:
        env_prefix = ""
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()