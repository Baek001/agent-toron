"use client";

import { Check, Circle } from "lucide-react";
import type { DebateRole, DebateRoleId } from "@/lib/debate/types";

type RolePanelProps = {
  roles: DebateRole[];
  selectedRoleIds: DebateRoleId[];
  onToggleRole: (roleId: DebateRoleId) => void;
};

export function RolePanel({ roles, selectedRoleIds, onToggleRole }: RolePanelProps) {
  return (
    <div className="role-list">
      {roles.map((role) => {
        const selected = selectedRoleIds.includes(role.id);
        return (
          <button
            className={`role-toggle ${selected ? "role-toggle-selected" : ""}`}
            key={role.id}
            onClick={() => onToggleRole(role.id)}
            type="button"
          >
            <span className="role-dot" style={{ background: role.color }} />
            <span>
              <span className="role-name">{role.name}</span>
              <span className="role-desc">{role.description}</span>
            </span>
            {selected ? <Check size={16} /> : <Circle size={16} />}
          </button>
        );
      })}
    </div>
  );
}
