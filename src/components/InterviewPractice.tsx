"use client";

import { useState } from "react";

interface Answer {
  id: string;
  answerText: string;
  relevanceScore: number;
  technicalAccuracyScore: number;
  structureScore: number;
  evidenceScore: number;
  clarityScore: number;
  completenessScore: number;
  overallScore: number;
  feedback: string;
  improvedAnswerGuidance: string;
  aiModel: string;
}

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  orderIndex: number;
  latestAnswer: Answer | null;
}

const TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  SITUATIONAL: "Situational",
  STAR: "STAR",
  ROLE_SPECIFIC: "Role-specific",
  GAP_BASED: "Addressing a gap",
};

export function InterviewPractice({
  sessionId,
  initialQuestions,
}: {
  sessionId: string;
  initialQuestions: Question[];
}) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);

  return (
    <div className="mt-6 space-y-4">
      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          sessionId={sessionId}
          question={q}
          onAnswered={(answer) =>
            setQuestions((prev) =>
              prev.map((x) => (x.id === q.id ? { ...x, latestAnswer: answer } : x))
            )
          }
        />
      ))}
    </div>
  );
}

function QuestionCard({
  sessionId,
  question,
  onAnswered,
}: {
  sessionId: string;
  question: Question;
  onAnswered: (a: Answer) => void;
}) {
  const [answerText, setAnswerText] = useState(question.latestAnswer?.answerText ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!answerText.trim()) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/interview-sessions/${sessionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answerText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to score answer.");
        setStatus("error");
        return;
      }
      onAnswered(data.answer);
      setStatus("idle");
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  const answer = question.latestAnswer;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {TYPE_LABELS[question.questionType] ?? question.questionType}
        </span>
      </div>
      <p className="mt-2 font-medium text-slate-900">{question.questionText}</p>

      <textarea
        value={answerText}
        onChange={(e) => setAnswerText(e.target.value)}
        rows={4}
        placeholder="Type your practice answer…"
        className="mt-3 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={status === "submitting" || !answerText.trim()}
        className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {status === "submitting" ? "Scoring…" : answer ? "Re-submit answer" : "Submit answer"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {answer && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          {answer.aiModel.includes("mock") && (
            <div className="mb-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              Scored by a deterministic development placeholder, not a real AI model.
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900">{answer.overallScore}</span>
            <span className="text-xs text-slate-500">overall score</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              ["Relevance", answer.relevanceScore],
              ["Technical", answer.technicalAccuracyScore],
              ["Structure", answer.structureScore],
              ["Evidence", answer.evidenceScore],
              ["Clarity", answer.clarityScore],
              ["Complete", answer.completenessScore],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded border border-slate-100 p-1.5 text-center">
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-medium">Feedback: </span>
            {answer.feedback}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium">How to strengthen this: </span>
            {answer.improvedAnswerGuidance}
          </p>
        </div>
      )}
    </div>
  );
}
