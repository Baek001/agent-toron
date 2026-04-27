"use client";

import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DebateRole, DebateRoleId } from "@/lib/debate/types";

type InterventionTarget = "all" | DebateRoleId;

type InterventionBoxProps = {
  roles: DebateRole[];
  target: InterventionTarget;
  value: string;
  disabled?: boolean;
  onTargetChange: (target: InterventionTarget) => void;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
};

export function InterventionBox({
  roles,
  target,
  value,
  disabled,
  onTargetChange,
  onValueChange,
  onSubmit,
}: InterventionBoxProps) {
  return (
    <form
      className="composer-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        <span className="sr-only">개입 대상</span>
        <select
          className="select"
          disabled={disabled}
          onChange={(event) => onTargetChange(event.target.value as InterventionTarget)}
          value={target}
        >
          <option value="all">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">사람 개입 메시지</span>
        <Textarea
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="중간에 끼어들기: Skeptic에게 더 세게 반박시켜, Product 관점으로 다시 봐줘..."
          value={value}
        />
      </label>
      <Button disabled={disabled || value.trim().length === 0} type="submit">
        <SendHorizontal size={16} />
        Send
      </Button>
    </form>
  );
}
