"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createProject() {
    setCreating(true);
    try {
      const project = await api.createProject(`Project ${new Date().toLocaleDateString()}`);
      router.push(`/project/${project.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-screen gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold">mediaFlow</h1>
        <p className="text-gray-400 mt-2">Turn transcripts into platform-ready content</p>
      </div>
      <button
        onClick={createProject}
        disabled={creating}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-xl font-semibold text-lg transition-colors"
      >
        {creating ? "Creating..." : "New Project"}
      </button>
    </div>
  );
}