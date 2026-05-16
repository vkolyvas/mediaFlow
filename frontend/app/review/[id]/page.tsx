"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api, Post } from "@/lib/api";
import { DraftCard } from "@/components/DraftCard";

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.listPosts(runId);
      setPosts(data);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { load(); }, [load]);

  async function handleEdit(id: string, content: string) {
    const updated = await api.editPost(id, content);
    setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  async function handleApprove(id: string) {
    const updated = await api.approvePost(id);
    setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  async function handleReject(id: string) {
    const updated = await api.rejectPost(id);
    setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading drafts...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <img src="/assets/mediaflow_logo.svg" alt="mediaFlow" className="w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold">Draft Review</h1>
          <p className="text-gray-400 text-sm mt-1">Edit and approve your content drafts</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {posts.map((post) => (
          <DraftCard
            key={post.id}
            post={post}
            onEdit={handleEdit}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}
      </div>
    </div>
  );
}