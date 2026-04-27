"use client";

import { useEffect, useRef } from "react";
import { getRole } from "@/lib/debate/harness";
import type { DebateMessage } from "@/lib/debate/types";

type MessageListProps = {
  messages: DebateMessage[];
};

export function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <h2>역할들이 토론하는 장면을 먼저 봅니다.</h2>
          <p>
            주제를 입력하고 토론을 시작하면 Moderator, Builder, Skeptic,
            Product, Risk가 라운드별로 발언합니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-flow">
      {messages.map((message) => {
        const role = getRole(message.roleId);
        const isHuman = message.roleId === "human";

        return (
          <article
            className={`message-row ${isHuman ? "human-row" : ""}`}
            key={message.id}
          >
            <div className="avatar" style={{ background: role.color }}>
              {role.initials}
            </div>
            <div className="message-bubble">
              <div className="message-meta">
                <span className="message-author">{role.name}</span>
                <span className="message-round">Round {message.round}</span>
              </div>
              <p className="message-content">{message.content}</p>
            </div>
          </article>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
