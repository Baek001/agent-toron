import type { DebateMessage, DebateRoleId, FinalReport } from "./types";

let messageCounter = 0;

function makeMessage(
  sessionId: string,
  roleId: DebateMessage["roleId"],
  round: number,
  content: string,
): DebateMessage {
  messageCounter += 1;

  return {
    id: `msg-${messageCounter}`,
    sessionId,
    roleId,
    round,
    content,
    status: "complete",
    createdAt: new Date().toISOString(),
  };
}

export function buildMockDebateScript(
  sessionId: string,
  topic: string,
  activeRoleIds: DebateRoleId[],
): DebateMessage[] {
  const selected = new Set(activeRoleIds);
  const messages: DebateMessage[] = [];

  if (selected.has("moderator")) {
    messages.push(
      makeMessage(
        sessionId,
        "moderator",
        0,
        `"${topic}"를 토론 주제로 고정하겠습니다. 오늘의 목표는 멋진 아이디어를 오래 말하는 것이 아니라, 첫 MVP에서 무엇을 만들고 무엇을 미룰지 결정하는 것입니다.`,
      ),
    );
  }

  if (selected.has("builder")) {
    messages.push(
      makeMessage(
        sessionId,
        "builder",
        1,
        "가장 작은 출발점은 실제 OpenClaw 연결이 아니라 mock 토론방입니다. 역할, 라운드, 사람 개입, 최종 요약이 한 화면에서 자연스럽게 보이면 다음 단계의 연결 지점이 선명해집니다.",
      ),
    );
  }

  if (selected.has("skeptic")) {
    messages.push(
      makeMessage(
        sessionId,
        "skeptic",
        1,
        "위험한 부분은 처음부터 멀티 에이전트 실행 엔진을 붙이다가 UI 판단을 못 하는 겁니다. 사용자가 보고 싶은 건 내부 구조가 아니라 토론의 흐름과 개입 가능성입니다.",
      ),
    );
  }

  if (selected.has("product")) {
    messages.push(
      makeMessage(
        sessionId,
        "product",
        1,
        "첫 화면은 설정 마법사가 아니라 이미 살아 있는 회의실이어야 합니다. 사용자는 주제를 넣고 바로 역할들이 말하는 장면을 봐야 제품의 이유를 이해합니다.",
      ),
    );
  }

  if (selected.has("risk")) {
    messages.push(
      makeMessage(
        sessionId,
        "risk",
        1,
        "로그 저장과 인증은 나중에 반드시 설계해야 합니다. 지금은 mock 데이터만 쓰고, OpenClaw Gateway와 provider 인증은 adapter 계층 뒤로 미뤄야 안전합니다.",
      ),
    );
  }

  if (selected.has("builder")) {
    messages.push(
      makeMessage(
        sessionId,
        "builder",
        2,
        "Skeptic 의견에 동의합니다. 그래서 UI와 엔진 사이에 `DebateEngine` 인터페이스를 두고, mock engine을 OpenClaw engine으로 교체할 수 있게 만들겠습니다.",
      ),
    );
  }

  if (selected.has("skeptic")) {
    messages.push(
      makeMessage(
        sessionId,
        "skeptic",
        2,
        "그렇다면 다음 검증 기준은 명확합니다. 사람이 중간에 끼어든 뒤에도 대화가 흐트러지지 않고, 어떤 역할에게 지시했는지 로그에 남아야 합니다.",
      ),
    );
  }

  if (selected.has("product")) {
    messages.push(
      makeMessage(
        sessionId,
        "product",
        2,
        "오른쪽 인스펙터에는 단순 상태보다 현재 쟁점, 합의된 내용, 남은 질문이 보여야 합니다. 이 제품은 채팅 앱이 아니라 판단을 돕는 도구입니다.",
      ),
    );
  }

  if (selected.has("risk")) {
    messages.push(
      makeMessage(
        sessionId,
        "risk",
        2,
        "나중에 실제 AI를 붙일 때는 숨은 추론을 노출하려고 하면 안 됩니다. 공개 가능한 역할 발언과 실행 이벤트만 보여주는 선을 유지해야 합니다.",
      ),
    );
  }

  if (selected.has("moderator")) {
    messages.push(
      makeMessage(
        sessionId,
        "moderator",
        3,
        "현재 합의는 `mock 토론방 먼저`, `OpenClaw는 adapter로 나중에`, `사람 개입은 1급 기능으로`입니다. 이제 Synthesizer가 실행 가능한 결론으로 정리합니다.",
      ),
    );
  }

  if (selected.has("synthesizer")) {
    messages.push(
      makeMessage(
        sessionId,
        "synthesizer",
        3,
        "결론: 첫 MVP는 OpenClaw 연결 전의 로컬 Debate Room입니다.\n근거: 화면 경험이 먼저 검증되어야 실행 엔진 교체가 의미 있습니다.\n다음 액션: mock engine, 역할 선택, 사람 개입, 최종 요약 패널을 완성합니다.",
      ),
    );
  }

  return messages;
}

export function buildInterventionResponse(
  sessionId: string,
  target: "all" | DebateRoleId,
  content: string,
): DebateMessage {
  const roleId: DebateRoleId =
    target === "all" ? "moderator" : target === "synthesizer" ? "synthesizer" : target;

  const responseByRole: Record<DebateRoleId, string> = {
    moderator: `개입을 반영하겠습니다. "${content}"를 다음 라운드의 제약으로 두고 각 역할의 발언을 더 짧게 정리하겠습니다.`,
    builder: `구현 관점에서 반영하면, "${content}"는 MVP 범위를 더 작게 자르는 기준으로 쓰는 게 좋습니다.`,
    skeptic: `좋은 개입입니다. "${content}" 때문에 기존 가정 하나를 다시 확인해야 합니다. 특히 실패했을 때 사용자가 무엇을 보게 되는지 정의해야 합니다.`,
    product: `사용자 관점에서는 "${content}"가 화면에서 행동으로 보여야 합니다. 단순 설명보다 입력, 상태, 결과로 드러나는 편이 좋습니다.`,
    risk: `리스크 관점에서는 "${content}"를 로그, 인증, provider 호출 비용과 연결해서 검토해야 합니다.`,
    synthesizer: `개입 내용을 최종 정리에 반영하겠습니다. "${content}"는 남은 질문과 다음 액션에 포함되어야 합니다.`,
  };

  return makeMessage(sessionId, roleId, 4, responseByRole[roleId]);
}

export function buildFinalReport(topic: string, messages: DebateMessage[]): FinalReport {
  const hasHumanInput = messages.some((message) => message.roleId === "human");

  return {
    conclusion: `"${topic}"의 첫 MVP는 실제 OpenClaw 연결보다 먼저, 사람이 볼 수 있는 토론 경험을 완성하는 방향이 적절합니다.`,
    evidence:
      "역할별 발언, 라운드 구조, 사람 개입, 최종 요약이 제품의 핵심 가치입니다. 이 네 가지가 확인되면 OpenClaw adapter를 붙이는 판단이 쉬워집니다.",
    objections:
      "OpenClaw 연결을 늦추면 실제 에이전트 품질 검증도 늦어질 수 있습니다. 다만 현재 가장 큰 불확실성은 실행 엔진이 아니라 화면 경험입니다.",
    openQuestions: hasHumanInput
      ? "사람 개입을 다음 라운드 전체에 반영할지, 특정 역할의 응답으로만 둘지 결정해야 합니다."
      : "실제 OpenClaw 연결 시 역할별 session을 오래 유지할지, 라운드마다 새로 만들지 결정해야 합니다.",
    nextActions:
      "1. mock 토론방을 브라우저에서 확인한다. 2. OpenClaw Gateway adapter 인터페이스를 정의한다. 3. Codex ACP 역할을 별도 Phase로 추가한다.",
  };
}

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
