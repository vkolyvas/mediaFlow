"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, JobStatus } from "@/lib/api";

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleString();
}

function formatDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return "";
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
}

const STATE_COLORS: Record<string, string> = {
  CREATED: "bg-gray-700",
  SCRIPT_GENERATED: "bg-blue-700",
  TTS_GENERATED: "bg-purple-700",
  CAPTIONS_ALIGNED: "bg-yellow-700",
  RENDERING: "bg-orange-700",
  COMPLETED: "bg-green-700",
  FAILED: "bg-red-700",
};

export default function HomePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function createProject() {
    setCreating(true);
    try {
      const project = await api.createProject(`Project ${new Date().toLocaleDateString()}`);
      router.push(`/project/${project.id}`);
    } catch {
      setCreating(false);
    }
  }

  async function loadJobs() {
    setLoadingJobs(true);
    try {
      const allJobs = await api.listJobs();
      setJobs(allJobs);
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }

  async function deleteJob(jobId: string) {
    if (!confirm("Delete this job and all its data?")) return;
    setDeleting(jobId);
    try {
      await api.deleteJob(jobId);
      setJobs(jobs.filter(j => j.job_id !== jobId));
    } catch {
      alert("Failed to delete job");
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    if (showJobs && jobs.length === 0) {
      loadJobs();
    }
  }, [showJobs]);

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-screen gap-6">
      <img src="/assets/mediaflow_logo.svg" alt="mediaFlow" className="w-64 h-64" />
      <div className="text-center">
        <h1 className="text-4xl font-bold">mediaFlow</h1>
        <p className="text-gray-400 mt-2">Turn transcripts into platform-ready content</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={createProject}
          disabled={creating}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-xl font-semibold text-lg transition-colors"
        >
          {creating ? "Creating..." : "New Project"}
        </button>
        <button
          onClick={() => { setShowJobs(!showJobs); if (!showJobs) loadJobs(); }}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold text-lg transition-colors"
        >
          {showJobs ? "Hide Jobs" : "View Jobs"}
        </button>
      </div>

      {showJobs && (
        <div className="w-full flex flex-col gap-4 mt-4">
          <h2 className="text-xl font-bold text-gray-200">Video Generation Jobs</h2>
          {loadingJobs ? (
            <div className="text-gray-400 text-center py-8">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No jobs yet</div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map(job => (
                <div key={job.job_id} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${STATE_COLORS[job.state] || "bg-gray-700"}`}>
                          {job.state}
                        </span>
                        <span className="text-sm text-gray-400">#{job.job_id}</span>
                        <span className="text-xs text-gray-500">{job.persona_id}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>{formatDate(job.created_at)}</span>
                        {job.completed_at && <span>Duration: {formatDuration(job.duration_sec)}</span>}
                        <span>{job.transcript_length} chars</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {job.state === "COMPLETED" && (
                        <a
                          href={`/video/${job.job_id}`}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium"
                        >
                          View
                        </a>
                      )}
                      {job.state !== "COMPLETED" && job.state !== "FAILED" && job.state !== "CREATED" && (
                        <a
                          href={`/video/${job.job_id}`}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
                        >
                          Resume
                        </a>
                      )}
                      {job.state === "CREATED" && (
                        <button
                          onClick={() => router.push(`/video/${job.job_id}`)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
                        >
                          Go
                        </button>
                      )}
                      <button
                        onClick={() => deleteJob(job.job_id)}
                        disabled={deleting === job.job_id}
                        className="px-3 py-1.5 bg-red-900 hover:bg-red-800 border border-red-700 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {deleting === job.job_id ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}