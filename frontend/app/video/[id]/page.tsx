"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api, JobStatus } from "@/lib/api";

const STAGES = [
  { key: "CREATED", label: "Created", description: "Initializing pipeline" },
  { key: "SCRIPT_GENERATED", label: "Script", description: "Generating TikTok script" },
  { key: "TTS_GENERATED", label: "Voice", description: "Converting script to audio" },
  { key: "CAPTIONS_ALIGNED", label: "Captions", description: "Aligning captions to audio" },
  { key: "RENDERING", label: "Rendering", description: "Building video file" },
  { key: "COMPLETED", label: "Done", description: "Video ready" },
  { key: "FAILED", label: "Failed", description: "Pipeline failed" },
];

function getStageIndex(state: string): number {
  const idx = STAGES.findIndex((s) => s.key === state);
  return idx >= 0 ? idx : 0;
}

function formatDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return "";
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
}

export default function VideoPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getJobStatus(jobId);
      setStatus(data);
      if (data.state === "COMPLETED" || data.state === "FAILED") {
        setPolling(false);
      }
    } catch {
      setPolling(false);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
    if (!polling) return;
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load, polling]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading job status...
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-3xl mx-auto p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <img src="/assets/mediaflow_logo.svg" alt="mediaFlow" className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Video Generation</h1>
            <p className="text-gray-400 text-sm mt-1">Job not found</p>
          </div>
        </div>
        <div className="text-red-400 bg-red-950 border border-red-900 rounded-lg p-4">
          Could not load job status. Make sure the backend is running.
        </div>
      </div>
    );
  }

  const currentIdx = getStageIndex(status.state);
  const isFailed = status.state === "FAILED";
  const isCompleted = status.state === "COMPLETED";

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <img src="/assets/mediaflow_logo.svg" alt="mediaFlow" className="w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold">Video Generation</h1>
          <p className="text-gray-400 text-sm mt-1">Job #{jobId}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{status.progress}%</span>
          <span>{status.state.replace("_", " ")}</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFailed ? "bg-red-500" : isCompleted ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${isFailed ? 100 : status.progress}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-300">Pipeline Stages</h2>
        <div className="grid grid-cols-1 gap-2">
          {STAGES.filter((s) => s.key !== "FAILED").map((stage, idx) => {
            const isDone = idx < currentIdx;
            const isActive = idx === currentIdx;
            const isPending = idx > currentIdx;
            return (
              <div
                key={stage.key}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                  isDone
                    ? "border-green-600 bg-green-950 text-green-300"
                    : isActive
                    ? "border-blue-500 bg-blue-950 text-blue-300"
                    : "border-gray-700 bg-gray-900 text-gray-500"
                }`}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full border text-sm font-bold">
                  {isDone ? "✓" : isActive ? idx + 1 : idx + 1}
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{stage.label}</span>
                  <span className="text-xs opacity-70">{stage.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Script preview */}
      {status.script_length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-300">Script</h2>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm text-gray-300">
            Script ({status.script_length} chars) — ready for voice generation
          </div>
        </div>
      )}

      {/* Duration */}
      {status.duration_sec !== null && (
        <div className="text-sm text-gray-400">
          Duration: {formatDuration(status.duration_sec)}
        </div>
      )}

      {/* Error */}
      {isFailed && status.error && (
        <div className="bg-red-950 border border-red-900 rounded-lg p-4">
          <p className="text-red-400 font-semibold">Pipeline Failed</p>
          <p className="text-red-300 text-sm mt-1">{status.error.message}</p>
          <p className="text-gray-400 text-xs mt-2">Stage: {status.error.stage}</p>
        </div>
      )}

      {/* Download */}
      {isCompleted && status.download_url && (
        <div className="flex flex-col gap-3">
          <div className="bg-green-950 border border-green-800 rounded-lg p-4">
            <p className="text-green-400 font-semibold">Video Ready</p>
            <p className="text-gray-400 text-sm mt-1">Your TikTok video is ready to download.</p>
          </div>
          <a
            href={status.download_url}
            download
            className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-center"
          >
            Download MP4
          </a>
        </div>
      )}
    </div>
  );
}