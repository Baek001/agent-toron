import harnessJson from "../../../debate-harness.json";
import type { DebateRole, DebateRoleId } from "./types";

type HarnessRole = {
  id: DebateRoleId;
  name: string;
  description: string;
};

const roleTheme: Record<DebateRoleId, Pick<DebateRole, "color" | "initials">> = {
  moderator: { color: "#1f2a29", initials: "MO" },
  builder: { color: "#0f8b6f", initials: "BU" },
  skeptic: { color: "#9a6b14", initials: "SK" },
  product: { color: "#3b6f8f", initials: "PR" },
  risk: { color: "#a6463d", initials: "RI" },
  synthesizer: { color: "#604b8f", initials: "SY" },
};

export const debateHarness = harnessJson;

export const debateRoles: DebateRole[] = (harnessJson.roles as HarnessRole[]).map(
  (role) => ({
    ...role,
    provider: "mock",
    ...roleTheme[role.id],
  }),
);

export const defaultRoleIds: DebateRoleId[] = [
  "moderator",
  "builder",
  "skeptic",
  "product",
  "risk",
  "synthesizer",
];

export function getRole(roleId: DebateRoleId | "human" | "system") {
  if (roleId === "human") {
    return {
      id: "human" as const,
      name: "Human",
      description: "User intervention",
      color: "#1f2a29",
      initials: "HU",
      provider: "mock" as const,
    };
  }

  if (roleId === "system") {
    return {
      id: "system" as const,
      name: "System",
      description: "Runtime event",
      color: "#68716d",
      initials: "ST",
      provider: "mock" as const,
    };
  }

  return debateRoles.find((role) => role.id === roleId) ?? debateRoles[0];
}
