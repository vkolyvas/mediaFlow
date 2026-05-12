"use client";
import { useState } from "react";
import { Post } from "@/lib/api";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X / Twitter",
  tiktok: "TikTok",
  reddit: "Reddit",
};

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "text-blue-400",
  x: "text-cyan-400",
  tiktok: "text-pink-400",
  reddit: "text-orange-400",
};

interface Props {
  post: Post;
  onEdit: (id: string, content: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function DraftCard({ post, onEdit, onApprove, onReject }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(post.edited_content || post.content);

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 ${
        post.approved ? "border-green-500 bg-green-950" : "border-gray-700 bg-gray-900"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-semibold ${PLATFORM_COLORS[post.platform]}`}>
          {PLATFORM_LABELS[post.platform] || post.platform}
        </span>
        <span className="text-xs bg-gray-800 px-2 py-1 rounded">
          {Math.round(post.quality_score * 100)}% quality
        </span>
      </div>

      {editing ? (
        <textarea
          className="w-full h-40 bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm text-gray-100 resize-none focus:outline-none focus:border-blue-500"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <p className="text-sm text-gray-300 whitespace-pre-wrap">{post.edited_content || post.content}</p>
      )}

      <div className="flex gap-2">
        {editing ? (
          <>
            <button
              onClick={() => { onEdit(post.id, value); setEditing(false); }}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm"
            >
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setValue(post.edited_content || post.content); }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Edit
          </button>
        )}
        {!post.reviewed && (
          <>
            <button
              onClick={() => onApprove(post.id)}
              className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(post.id)}
              className="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-sm"
            >
              Reject
            </button>
          </>
        )}
        {post.reviewed && (
          <span className="text-xs text-gray-500 self-center">
            {post.approved ? "Approved" : "Rejected"}
          </span>
        )}
      </div>
    </div>
  );
}