"""
Repositories — data access layer for pipeline persistence.

repositories/
  jobs/
    base.py   — PipelineRepository protocol
    json.py   — JsonPipelineRepository implementation
    paths.py  — JobPaths for deterministic directory layout
    error.py  — PipelineError structured error metadata
"""

from .jobs.base import PipelineRepository
from .jobs.json import JsonPipelineRepository
from .jobs.paths import JobPaths, get_job_paths
from .jobs.error import PipelineError

__all__ = [
    "PipelineRepository",
    "JsonPipelineRepository",
    "JobPaths",
    "get_job_paths",
    "PipelineError",
]
