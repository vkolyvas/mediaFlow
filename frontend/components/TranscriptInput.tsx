"use client";
import { useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}

export function TranscriptInput({ value, onChange, onSubmit, loading }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <textarea
        className="w-full h-64 bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500"
        placeholder="Paste your transcript here..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        onClick={onSubmit}
        disabled={loading || !value.trim()}
        className="self-start px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
      >
        {loading ? "Processing..." : "Generate Drafts"}
      </button>
    </div>
  );
}