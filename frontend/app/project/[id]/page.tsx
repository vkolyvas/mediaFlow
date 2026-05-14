"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, Template } from "@/lib/api";
import { TemplateSelector } from "@/components/TemplateSelector";
import { TranscriptInput } from "@/components/TranscriptInput";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [transcript, setTranscript] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["linkedin", "x", "tiktok", "reddit"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const platformOptions = [
    { id: "linkedin", label: "LinkedIn" },
    { id: "x", label: "X/Twitter" },
    { id: "tiktok", label: "TikTok" },
    { id: "reddit", label: "Reddit" },
  ];

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  useEffect(() => {
    api.getProject(projectId).then((p) => setProjectName(p.name)).catch(() => {});
    api.listTemplates().then((t) => {
      setTemplates(t);
      if (t.length > 0) setSelectedTemplate(t[0].id);
    });
  }, [projectId]);

  async function handleGenerate() {
    if (!transcript.trim()) return;
    if (selectedPlatforms.length === 0) {
      setError("Select at least one platform");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const t = await api.createTranscript(projectId, transcript);
      const result = await api.generate(projectId, t.id, selectedTemplate, undefined, selectedPlatforms);
      router.push(`/review/${result.run_id}`);
    } catch (e: any) {
      setError(e.message || "Generation failed");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{projectName || "New Project"}</h1>
        <p className="text-gray-400 text-sm mt-1">Select a template and paste your transcript</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-300">Template Style</h2>
        <TemplateSelector
          templates={templates}
          selected={selectedTemplate}
          onSelect={setSelectedTemplate}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-300">Platforms</h2>
        <div className="flex flex-wrap gap-2">
          {platformOptions.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectedPlatforms.includes(p.id)
                  ? "border-blue-500 bg-blue-950 text-blue-400"
                  : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-300">Transcript</h2>
        <TranscriptInput
          value={transcript}
          onChange={setTranscript}
          onSubmit={handleGenerate}
          loading={loading}
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-950 border border-red-900 rounded-lg p-3">
          {error}
        </div>
      )}
    </div>
  );
}