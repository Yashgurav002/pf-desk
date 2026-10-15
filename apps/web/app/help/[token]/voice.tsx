"use client";
import { createElement, useEffect, useState } from "react";

// ElevenLabs voice widget (PRD §16). Shown only when the API has ELEVENLABS_AGENT_ID set.
// The agent's LLM is PF Desk's /v1/voice/llm endpoint; the help token reaches it as a dynamic variable.
const SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed@0.18.3";

export default function Voice({ token }: { token: string }) {
  const [agent, setAgent] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/v1/voice/config").then((r) => r.json()).then((d) => setAgent(d.agent_id)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!agent || document.querySelector(`script[src="${SRC}"]`)) return;
    const s = document.createElement("script");
    Object.assign(s, { src: SRC, async: true, type: "text/javascript" });
    document.body.appendChild(s);
  }, [agent]);
  if (!agent) return null;
  return createElement("elevenlabs-convai", { "agent-id": agent, "dynamic-variables": JSON.stringify({ help_token: token }) });
}
