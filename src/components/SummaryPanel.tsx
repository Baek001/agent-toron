"use client";

import { Activity, FileText, MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getRole } from "@/lib/debate/harness";
import type { DebateMessage, DebateRoleId, DebateStatus, FinalReport } from "@/lib/debate/types";

type SummaryPanelProps = {
  status: DebateStatus;
  round: number;
  liveRoleId: DebateRoleId | null;
  messages: DebateMessage[];
  finalReport: FinalReport | null;
};

export function SummaryPanel({
  status,
  round,
  liveRoleId,
  messages,
  finalReport,
}: SummaryPanelProps) {
  const humanCount = messages.filter((message) => message.roleId === "human").length;
  const roleCount = new Set(
    messages
      .filter((message) => message.roleId !== "human" && message.roleId !== "system")
      .map((message) => message.roleId),
  ).size;
  const liveRole = liveRoleId ? getRole(liveRoleId) : null;

  return (
    <>
      <section className="panel-section">
        <div className="section-heading">
          <h3>Run Status</h3>
          <Badge variant={status === "running" ? "accent" : "default"}>{status}</Badge>
        </div>
        <div className="insight-list">
          <div className="insight-item">
            <span className="insight-label">Current round</span>
            <p className="insight-value">{round}</p>
          </div>
          <div className="insight-item">
            <span className="insight-label">Speaking role</span>
            <p className="insight-value">{liveRole?.name ?? "Idle"}</p>
          </div>
          <div className="insight-item">
            <span className="insight-label">Messages</span>
            <p className="insight-value">{messages.length} total</p>
          </div>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h3>Debate Inspector</h3>
          <MessagesSquare size={16} />
        </div>
        <div className="insight-list">
          <div className="insight-item">
            <span className="insight-label">Current issue</span>
            <p className="insight-value">
              MVP의 첫 검증 대상을 UI 경험으로 둘지, OpenClaw 연결로 둘지.
            </p>
          </div>
          <div className="insight-item">
            <span className="insight-label">Emerging agreement</span>
            <p className="insight-value">
              Mock engine으로 토론방 경험을 먼저 만들고, OpenClaw는 adapter로
              붙입니다.
            </p>
          </div>
          <div className="insight-item">
            <span className="insight-label">Human interventions</span>
            <p className="insight-value">{humanCount} inserted</p>
          </div>
          <div className="insight-item">
            <span className="insight-label">Active AI roles</span>
            <p className="insight-value">{roleCount} roles have spoken</p>
          </div>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h3>Final Report</h3>
          {finalReport ? <FileText size={16} /> : <Activity size={16} />}
        </div>
        {finalReport ? (
          <div className="report">
            <div className="report-block">
              <h4>Conclusion</h4>
              <p>{finalReport.conclusion}</p>
            </div>
            <div className="report-block">
              <h4>Evidence</h4>
              <p>{finalReport.evidence}</p>
            </div>
            <div className="report-block">
              <h4>Objections</h4>
              <p>{finalReport.objections}</p>
            </div>
            <div className="report-block">
              <h4>Open Questions</h4>
              <p>{finalReport.openQuestions}</p>
            </div>
            <div className="report-block">
              <h4>Next Actions</h4>
              <p>{finalReport.nextActions}</p>
            </div>
          </div>
        ) : (
          <p className="section-note">
            토론이 완료되면 Synthesizer가 결론과 다음 액션을 정리합니다.
          </p>
        )}
      </section>
    </>
  );
}
