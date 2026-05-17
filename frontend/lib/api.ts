const BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
}

export interface TemplateSection {
  name: string;
  prompt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  structure: TemplateSection[];
}

export interface Transcript {
  id: string;
  project_id: string;
  raw_text: string;
  cleaned_text: string | null;
  word_count: number | null;
  created_at: string;
}

export interface Post {
  id: string;
  generation_run_id: string;
  platform: string;
  content: string;
  quality_score: number;
  reviewed: boolean;
  approved: boolean;
  edited_content: string | null;
}

export interface JobStatus {
  job_id: string;
  persona_id: string;
  state: string;
  progress: number;
  transcript_length: number;
  script_length: number;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
  duration_sec: number | null;
  output_path: string | null;
  download_url: string | null;
  error: { message: string; stage: string } | null;
}

export const api = {
  createProject: (name: string) =>
    request<Project>("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),

  getProject: (id: string) => request<Project>(`/projects/${id}`),

  listTemplates: () => request<Template[]>("/templates"),

  createTranscript: (projectId: string, rawText: string) =>
    request<Transcript>("/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, raw_text: rawText }),
    }),

  getTranscript: (id: string) => request<Transcript>(`/transcripts/${id}`),

  generate: (projectId: string, transcriptId: string, templateId: string, subreddit?: string, platforms?: string[]) =>
    request<{ run_id: string; status: string; posts: Post[] }>("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        transcript_id: transcriptId,
        template_id: templateId,
        subreddit: subreddit || "marketing",
        platforms: platforms,
      }),
    }),

  generateVideo: (transcript: string, personaId?: string) =>
    request<{ job_id: string; state: string }>("/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, persona_id: personaId || "expert_formal" }),
    }),

  getJobStatus: (jobId: string) =>
    request<JobStatus>(`/jobs/${jobId}`),

  listJobs: () => request<JobStatus[]>("/jobs"),

  deleteJob: (jobId: string) =>
    request<{ deleted: string }>(`/jobs/${jobId}`, { method: "DELETE" }),

  listPosts: (runId: string) => request<Post[]>(`/posts?generation_run_id=${runId}`),

  editPost: (postId: string, editedContent: string) =>
    request<Post>(`/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edited_content: editedContent }),
    }),

  approvePost: (postId: string) =>
    request<Post>(`/posts/${postId}/approve`, { method: "POST" }),

  rejectPost: (postId: string) =>
    request<Post>(`/posts/${postId}/reject`, { method: "POST" }),
};