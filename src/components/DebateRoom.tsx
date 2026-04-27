"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bot,
  CircleStop,
  FileDown,
  Play,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InterventionBox } from "@/components/InterventionBox";
import { MessageList } from "@/components/MessageList";
import { RolePanel } from "@/components/RolePanel";
import { SummaryPanel } from "@/components/SummaryPanel";
import { debateRoles, defaultRoleIds } from "@/lib/debate/harness";
import {
  buildFinalReport,
  buildInterventionResponse,
  buildMockDebateScript,
  sleep,
} from "@/lib/debate/mockDebateEngine";
import type {
  DebateMessage,
  DebateRoleId,
  DebateStatus,
  FinalReport,
} from "@/lib/debate/types";

type InterventionTarget = "all" | DebateRoleId;

const defaultTopic = "OpenClaw 위에 사람이 볼 수 있는 AI 토론방을 어떻게 만들까?";

function makeSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

export function DebateRoom() {
  const [topic, setTopic] = useState(defaultTopic);
  const [selectedRoleIds, setSelectedRoleIds] = useState<DebateRoleId[]>(defaultRoleIds);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [status, setStatus] = useState<DebateStatus>("draft");
  const [round, setRound] = useState(0);
  const [liveRoleId, setLiveRoleId] = useState<DebateRoleId | null>(null);
  const [sessionId, setSessionId] = useState("session-draft");
  const [interventionTarget, setInterventionTarget] =
    useState<InterventionTarget>("all");
  const [interventionText, setInterventionText] = useState("");
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const cancelRef = useRef(false);

  const activeRoles = useMemo(
    () => debateRoles.filter((role) => selectedRoleIds.includes(role.id)),
    [selectedRoleIds],
  );

  function toggleRole(roleId: DebateRoleId) {
    setSelectedRoleIds((current) => {
      if (current.includes(roleId)) {
        return current.length === 1 ? current : current.filter((id) => id !== roleId);
      }

      return [...current, roleId];
    });
  }

  async function startDebate() {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic || status === "running") {
      return;
    }

    const nextSessionId = makeSessionId();
    const script = buildMockDebateScript(nextSessionId, trimmedTopic, selectedRoleIds);

    cancelRef.current = false;
    setSessionId(nextSessionId);
    setStatus("running");
    setMessages([]);
    setFinalReport(null);
    setRound(0);
    setLiveRoleId(null);

    for (const message of script) {
      if (cancelRef.current) {
        setStatus("paused");
        setLiveRoleId(null);
        return;
      }

      setRound(message.round);
      setLiveRoleId(
        message.roleId === "human" || message.roleId === "system" ? null : message.roleId,
      );
      await sleep(420);
      setMessages((current) => [...current, message]);
    }

    setLiveRoleId(null);
    setStatus("completed");
    setFinalReport(buildFinalReport(trimmedTopic, script));
  }

  function pauseDebate() {
    cancelRef.current = true;
  }

  function resetDebate() {
    cancelRef.current = true;
    setMessages([]);
    setFinalReport(null);
    setStatus("draft");
    setRound(0);
    setLiveRoleId(null);
    setSessionId("session-draft");
  }

  async function submitIntervention() {
    const content = interventionText.trim();
    if (!content || messages.length === 0) {
      return;
    }

    const humanMessage: DebateMessage = {
      id: `human-${Date.now()}`,
      sessionId,
      roleId: "human",
      round: Math.max(round, 1),
      content,
      status: "complete",
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, humanMessage]);
    setInterventionText("");
    await sleep(360);

    const response = buildInterventionResponse(sessionId, interventionTarget, content);
    setRound(response.round);
    setMessages((current) => [...current, response]);
    setFinalReport((current) => current ?? buildFinalReport(topic, [...messages, humanMessage, response]));
  }

  function exportDebate() {
    const report = finalReport ?? buildFinalReport(topic, messages);
    const payload = {
      sessionId,
      topic,
      selectedRoleIds,
      messages,
      finalReport: report,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agent-debate-${sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Bot size={18} />
          </div>
          <div className="brand-copy">
            <span className="brand-title">Agent Debate Room</span>
            <span className="brand-subtitle">Mock harness now, OpenClaw adapter next</span>
          </div>
        </div>
        <Badge variant={status === "running" ? "accent" : "default"}>
          {status === "running" ? "Live debate" : "Local MVP"}
        </Badge>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <section className="panel-section">
            <div className="section-heading">
              <h2>Debate Setup</h2>
              <Settings2 size={16} />
            </div>
            <label>
              <span className="section-note">Topic</span>
              <Input
                onChange={(event) => setTopic(event.target.value)}
                placeholder="토론 주제를 입력하세요"
                value={topic}
              />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                disabled={status === "running" || topic.trim().length === 0}
                onClick={startDebate}
                type="button"
              >
                <Play size={16} />
                Start
              </Button>
              <Button
                disabled={status !== "running"}
                onClick={pauseDebate}
                type="button"
                variant="danger"
              >
                <CircleStop size={16} />
                Stop
              </Button>
              <Button onClick={resetDebate} type="button" variant="secondary">
                <RefreshCw size={16} />
                Reset
              </Button>
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <h2>Roles</h2>
              <Badge>{selectedRoleIds.length} active</Badge>
            </div>
            <RolePanel
              onToggleRole={toggleRole}
              roles={debateRoles}
              selectedRoleIds={selectedRoleIds}
            />
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <h2>Engine</h2>
              <Badge>Mock</Badge>
            </div>
            <p className="section-note">
              이 MVP는 OpenClaw를 아직 호출하지 않습니다. 같은 화면 구조에
              OpenClaw Gateway adapter를 다음 단계에서 연결합니다.
            </p>
          </section>
        </aside>

        <section className="main-stage">
          <div className="stage-header">
            <div className="stage-title">
              <h1>{topic || "Untitled debate"}</h1>
              <p>
                {activeRoles.map((role) => role.name).join(", ")} 역할이 라운드별로
                발언합니다.
              </p>
            </div>
            <Button
              disabled={messages.length === 0}
              onClick={exportDebate}
              type="button"
              variant="secondary"
            >
              <FileDown size={16} />
              Export
            </Button>
          </div>

          <div className="message-list">
            <MessageList messages={messages} />
          </div>

          <div className="composer">
            <InterventionBox
              disabled={messages.length === 0}
              onSubmit={submitIntervention}
              onTargetChange={setInterventionTarget}
              onValueChange={setInterventionText}
              roles={debateRoles}
              target={interventionTarget}
              value={interventionText}
            />
          </div>
        </section>

        <aside className="inspector">
          <SummaryPanel
            finalReport={finalReport}
            liveRoleId={liveRoleId}
            messages={messages}
            round={round}
            status={status}
          />
        </aside>
      </div>
    </main>
  );
}
