"use client";
import { useState } from "react";
import { Template } from "@/lib/api";

interface Props {
  templates: Template[];
  selected: string;
  onSelect: (id: string) => void;
}

interface TemplateMeta {
  archetype: string;
  bestFor: string[];
  example: string;
  psychologicalTrigger: string;
}

const TEMPLATE_META: Record<string, TemplateMeta> = {
  transformation: {
    archetype: "Journey / Transformation",
    bestFor: ["Personal branding", "Trust building", "Founder narratives"],
    example: "\"I wasted 3 years doing X wrong. Here's what I learned...\"",
    psychologicalTrigger: "Aspiration + Identification + Social proof",
  },
  story: {
    archetype: "Story-Based Emotional",
    bestFor: ["Emotional engagement", "Memorability", "Audience affinity"],
    example: "\"A manager once told me something I'll never forget...\"",
    psychologicalTrigger: "Empathy + Suspense + Emotional immersion",
  },
  pas: {
    archetype: "PAS (Problem → Agitate → Solve)",
    bestFor: ["Persuasion", "Behavior change", "CTA acceleration"],
    example: "\"Most creators ignore this problem. Here's why it costs them...\"",
    psychologicalTrigger: "Loss aversion + Anxiety + Future regret",
  },
  contrast: {
    archetype: "Comparison / Contrast",
    bestFor: ["Educational clarity", "Positioning", "Simplifying abstractions"],
    example: "\"Amateurs do X. Experts do Y. Here's the difference...\"",
    psychologicalTrigger: "Cognitive simplification + Categorization + Insight clarity",
  },
  credibility: {
    archetype: "Authority / Credibility Borrowing",
    bestFor: ["Educational authority", "Trust acceleration", "B2B credibility"],
    example: "\"Morgan Housel says this better than I ever could...\"",
    psychologicalTrigger: "Trust transfer + Status association + Legitimacy",
  },
 aida: {
    archetype: "AIDA (Attention → Interest → Desire → Action)",
    bestFor: ["Sales", "Launch sequencing", "Direct response"],
    example: "\"Stop scrolling. This changed how I think about... [builds desire] → Click below.\"",
    psychologicalTrigger: "Progressive commitment + Emotional escalation",
  },
  slippery_slide: {
    archetype: "Curiosity / Open-Loop",
    bestFor: ["Hook optimization", "Virality", "Maximizing read-through"],
    example: "\"My secret? Nobody talks about this. [incomplete info] → Reveal...\"",
    psychologicalTrigger: "Curiosity gap + Suspense + Incompletion bias",
  },
};

function getMeta(templateId: string, templateName: string): TemplateMeta {
  const id = templateId.toLowerCase();
  if (TEMPLATE_META[id]) return TEMPLATE_META[id];

  // Match by name keywords
  const name = templateName.toLowerCase();
  if (name.includes("story") || name.includes("narrative"))
    return TEMPLATE_META["story"];
  if (name.includes("problem") || name.includes("pas"))
    return TEMPLATE_META["pas"];
  if (name.includes("contrast") || name.includes("comparison") || name.includes("vs"))
    return TEMPLATE_META["contrast"];
  if (name.includes("credibility") || name.includes("expert") || name.includes("authority"))
    return TEMPLATE_META["credibility"];
  if (name.includes("transformation") || name.includes("journey") || name.includes("before"))
    return TEMPLATE_META["transformation"];
  if (name.includes("curiosity") || name.includes("loop") || name.includes("secret"))
    return TEMPLATE_META["slippery_slide"];

  return {
    archetype: "Generic",
    bestFor: ["Content creation", "Engagement", "Reach"],
    example: `"${templateName} works best when you lead with a strong hook..."`,
    psychologicalTrigger: "Pattern interruption + Value delivery",
  };
}

export function TemplateSelector({ templates, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  function handleMouseEnter(e: React.MouseEvent, id: string) {
    setHovered(id);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left, y: rect.bottom + 8 });
  }

  function handleMouseLeave() {
    setHovered(null);
    setTooltipPos(null);
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {templates.map((t) => {
          const meta = getMeta(t.id, t.name);
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              onMouseEnter={(e) => handleMouseEnter(e, t.id)}
              onMouseLeave={handleMouseLeave}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                selected === t.id
                  ? "border-blue-500 bg-blue-950 ring-1 ring-blue-500"
                  : "border-gray-700 bg-gray-900 hover:border-gray-500"
              }`}
            >
              <div className={`font-semibold text-sm ${selected === t.id ? "text-blue-300" : "text-gray-100"}`}>
                {t.name}
              </div>
              <div className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description}</div>
              <div className="mt-2 flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">?</span>
                <span className="text-[10px] text-gray-600">Hover for example</span>
              </div>
            </button>
          );
        })}
      </div>

      {hovered && tooltipPos && (() => {
        const template = templates.find((t) => t.id === hovered);
        if (!template) return null;
        const meta = getMeta(template.id, template.name);
        return (
          <div
            className="fixed z-50 w-72 bg-gray-950 border border-gray-700 rounded-xl shadow-2xl p-4"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className="text-sm font-semibold text-blue-300 mb-1">{meta.archetype}</div>
            <div className="text-xs text-gray-400 mb-3">{meta.psychologicalTrigger}</div>

            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Example</div>
              <div className="text-xs text-gray-300 italic bg-gray-900 rounded-lg p-2 border border-gray-800">
                {meta.example}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Best For</div>
              <div className="flex flex-wrap gap-1">
                {meta.bestFor.map((b) => (
                  <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}