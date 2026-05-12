"use client";
import { Template } from "@/lib/api";

interface Props {
  templates: Template[];
  selected: string;
  onSelect: (id: string) => void;
}

export function TemplateSelector({ templates, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`p-4 rounded-xl border text-left transition-all ${
            selected === t.id
              ? "border-blue-500 bg-blue-950"
              : "border-gray-700 bg-gray-900 hover:border-gray-500"
          }`}
        >
          <div className="font-semibold text-sm">{t.name}</div>
          <div className="text-xs text-gray-400 mt-1">{t.description}</div>
        </button>
      ))}
    </div>
  );
}