const defaultRoles = [
  {
    id: "role-1",
    name: "진행자",
    description: "토론의 흐름을 잡고 쟁점을 정리합니다.",
    instruction: "주제를 선명하게 만들고 다음 발언이 흩어지지 않도록 공개 발언을 짧게 정리합니다.",
    color: "#202624",
  },
  {
    id: "role-2",
    name: "구현자",
    description: "실제로 만들 수 있는 방법과 순서를 제안합니다.",
    instruction: "추상적인 방향보다 지금 만들 수 있는 작은 실행 단위를 우선해서 말합니다.",
    color: "#0b7d68",
  },
  {
    id: "role-3",
    name: "비판자",
    description: "허점, 실패 가능성, 과한 범위를 지적합니다.",
    instruction: "반대만 하지 말고 어떤 조건이면 안전해지는지도 함께 제안합니다.",
    color: "#8a6419",
  },
];

const statusLabels = {
  draft: "초안",
  running: "진행 중",
  paused: "일시 정지",
  completed: "완료",
  failed: "실패",
};

const engineLabels = {
  openclaw: "오픈클로",
  codex: "코덱스",
  claude: "클로드",
  mock: "예비 엔진",
  human: "사람",
};

const roleColors = ["#202624", "#0b7d68", "#8a6419", "#326d8f", "#9b3f38", "#59478b", "#59636e", "#7b5934"];

const state = {
  status: "draft",
  sessionId: null,
  sessionSource: "local",
  topic: "",
  roles: cloneRoles(defaultRoles),
  engineMode: "openclaw",
  serverAvailable: false,
  serverInfo: null,
  sessions: [],
  messages: [],
  liveRoleId: null,
  finalReport: null,
  cancelled: false,
  lastError: "",
};

const el = {
  newButton: document.getElementById("newButton"),
  topicForm: document.getElementById("topicForm"),
  topicInput: document.getElementById("topicInput"),
  stageTitle: document.getElementById("stageTitle"),
  roleEditor: document.getElementById("roleEditor"),
  addRoleButton: document.getElementById("addRoleButton"),
  roleCount: document.getElementById("roleCount"),
  startButton: document.getElementById("startButton"),
  stopButton: document.getElementById("stopButton"),
  resetButton: document.getElementById("resetButton"),
  exportButton: document.getElementById("exportButton"),
  messageList: document.getElementById("messageList"),
  statusBadge: document.getElementById("statusBadge"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  liveRoleText: document.getElementById("liveRoleText"),
  messageCountText: document.getElementById("messageCountText"),
  humanCountText: document.getElementById("humanCountText"),
  engineSelect: document.getElementById("engineSelect"),
  engineStatusText: document.getElementById("engineStatusText"),
  serverDetail: document.getElementById("serverDetail"),
  openclawHint: document.getElementById("openclawHint"),
  sessionList: document.getElementById("sessionList"),
  sessionCountText: document.getElementById("sessionCountText"),
  chatInput: document.getElementById("chatInput"),
  chatForm: document.getElementById("chatForm"),
  sendButton: document.getElementById("sendButton"),
  reportPanel: document.getElementById("reportPanel"),
  reportRefreshButton: document.getElementById("reportRefreshButton"),
};

let messageCounter = 0;
let activeDebateAbortController = null;

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cloneRoles(roles) {
  return roles.map((role) => ({ ...role, initials: makeInitials(role.name) }));
}

function sanitizeRoles(roles) {
  const cleaned = roles
    .map((role, index) => ({
      id: role.id || `role-${index + 1}`,
      name: String(role.name || `역할 ${index + 1}`).trim().slice(0, 32),
      description: String(role.description || "이 관점으로 토론합니다.").trim().slice(0, 140),
      instruction: String(role.instruction || role.description || "이 관점으로 토론합니다.").trim().slice(0, 240),
      color: role.color || roleColors[index % roleColors.length],
      initials: makeInitials(role.name || `역할 ${index + 1}`),
    }))
    .filter((role) => role.name);
  return cleaned.length ? cleaned.slice(0, 8) : cloneRoles(defaultRoles);
}

function makeInitials(name) {
  return Array.from(String(name || "역할").replace(/\s+/g, "")).slice(0, 2).join("") || "역할";
}

function roleFor(id) {
  if (id === "human") {
    return { id: "human", name: "나", color: "#202624", initials: "나" };
  }
  return state.roles.find((role) => role.id === id) || state.roles[0] || defaultRoles[0];
}

function makeMessage(roleId, round, content) {
  messageCounter += 1;
  const role = roleFor(roleId);
  return {
    id: `local-msg-${messageCounter}`,
    sessionId: state.sessionId,
    roleId,
    roleName: role.name,
    round,
    content,
    status: "complete",
    engine: "mock",
    engineLabel: engineLabels.mock,
    createdAt: new Date().toISOString(),
  };
}

function buildScript(topic) {
  const roles = sanitizeRoles(state.roles);
  const rounds = roles.length > 5 ? 1 : 2;
  const messages = [];
  for (let round = 1; round <= rounds; round += 1) {
    for (const role of roles) {
      messages.push(
        makeMessage(
          role.id,
          round,
          `${role.name} 관점에서 "${topic}"을 보겠습니다. ${role.description} 지금 라운드 ${round}에서는 정답을 빨리 내기보다 이 관점이 토론에 어떤 기준을 추가하는지 분명히 하겠습니다.`,
        ),
      );
    }
  }
  return messages;
}

function buildFinalReport(topic) {
  const hasHumanInput = state.messages.some((message) => message.roleId === "human");
  const roleNames = sanitizeRoles(state.roles).map((role) => role.name).join(", ");
  return {
    summary: `"${topic}"에 대해 ${roleNames} 관점으로 토론했습니다. 사람은 대화 중 채팅으로 흐름에 끼어들 수 있습니다.`,
    decision: "역할은 사용자가 직접 만들고, 사람 개입은 대상 선택 없이 같은 대화창에 들어가는 방식이 가장 자연스럽습니다.",
    agreements: [
      "역할은 고정 목록보다 사용자가 직접 정하는 편이 좋습니다.",
      "사람 메시지는 토론 기록 안에 같은 흐름으로 저장되어야 합니다.",
      "끼어든 뒤 다음 역할이 자연스럽게 이어받으면 채팅 서비스처럼 이해하기 쉽습니다.",
    ],
    disagreements: ["사람이 끼어든 뒤 몇 개 역할이 답할지는 이후 설정으로 더 다듬을 수 있습니다."],
    nextActions: [
      "원하는 역할 이름과 설명을 직접 적어 토론을 시작합니다.",
      hasHumanInput ? "사람 채팅이 결론에 반영되는지 다시 정리합니다." : "하단 채팅창으로 한 번 끼어들어 흐름을 확인합니다.",
    ],
    risks: ["역할 설명이 너무 짧으면 발언이 비슷해질 수 있습니다."],
  };
}

function chatResponse(content) {
  const roles = sanitizeRoles(state.roles);
  const lastAgent = [...state.messages].reverse().find((message) => message.roleId !== "human");
  const lastIndex = Math.max(0, roles.findIndex((role) => role.id === lastAgent?.roleId));
  const role = roles[(lastIndex + 1) % roles.length] || roles[0];
  return makeMessage(
    role.id,
    nextRound(),
    `${role.name} 관점에서 사람의 채팅을 이어받겠습니다. "${content}"라는 말 때문에 지금부터는 토론의 결론보다 사용자가 직접 조정한 흐름이 자연스럽게 반영되는지 확인해야 합니다.`,
  );
}

function nextRound() {
  const rounds = state.messages.map((message) => Number(message.round) || 0);
  return rounds.length ? Math.max(...rounds) + 0.5 : 0.5;
}

function renderRoles() {
  el.roleEditor.innerHTML = sanitizeRoles(state.roles)
    .map((role, index) => `
      <article class="role-card" data-role-index="${index}">
        <div class="role-card-head">
          <span class="avatar" style="--role-color:${role.color}">${escapeHtml(role.initials)}</span>
          <input class="role-name-input" data-role-field="name" value="${escapeHtml(role.name)}" aria-label="역할 이름" />
          <button class="icon-button" data-role-action="delete" type="button" aria-label="역할 삭제">×</button>
        </div>
        <textarea data-role-field="description" aria-label="역할 설명">${escapeHtml(role.description)}</textarea>
      </article>
    `)
    .join("");
}

function renderMessages() {
  if (!state.messages.length) {
    const emptyText = state.lastError
      ? `<p class="eyebrow">오류</p><h2>토론을 진행하지 못했습니다.</h2><p>${escapeHtml(state.lastError)}</p>`
      : `<p class="eyebrow">준비됨</p><h2>역할을 정하고 토론을 시작하세요.</h2><p>토론 중에는 아래 채팅창에 그냥 입력하면 전체 흐름에 사람 메시지로 들어갑니다.</p>`;
    el.messageList.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  el.messageList.innerHTML = state.messages
    .map((message) => {
      const role = roleFor(message.roleId);
      const engineLabel = message.engineLabel || engineLabels[message.engine] || "";
      const fallbackLabel = message.fallback ? "대체 실행" : "";
      const meta = [engineLabel, fallbackLabel, formatTime(message.createdAt)].filter(Boolean).join(" · ");
      const humanClass = message.roleId === "human" ? " human-row" : "";
      return `
        <article class="message-row${humanClass}">
          <div class="avatar" style="--role-color:${role.color}">${escapeHtml(role.initials)}</div>
          <div class="message-body">
            <div class="message-meta">
              <strong>${escapeHtml(message.roleName || role.name)}</strong>
              <span>${escapeHtml(meta)}</span>
            </div>
            <p>${escapeHtml(message.content)}</p>
          </div>
        </article>
      `;
    })
    .join("");
  el.messageList.scrollTop = el.messageList.scrollHeight;
}

function renderReport() {
  const report = state.finalReport;
  if (!report) {
    el.reportPanel.innerHTML = '<p class="hint">토론이 끝나면 결론, 합의, 쟁점, 다음 행동이 정리됩니다.</p>';
    return;
  }

  const block = (title, items) => {
    if (!items?.length) return "";
    return `
      <div class="report-block">
        <h3>${escapeHtml(title)}</h3>
        <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    `;
  };

  el.reportPanel.innerHTML = `
    <div class="report-block">
      <h3>요약</h3>
      <p>${escapeHtml(report.summary)}</p>
    </div>
    <div class="report-block">
      <h3>권장 결론</h3>
      <p>${escapeHtml(report.decision)}</p>
    </div>
    ${block("합의", report.agreements)}
    ${block("남은 쟁점", report.disagreements)}
    ${block("다음 행동", report.nextActions)}
    ${block("위험", report.risks)}
  `;
}

function renderSessions() {
  el.sessionCountText.textContent = `${state.sessions.length}개`;
  if (!state.serverAvailable) {
    el.sessionList.innerHTML = '<p class="empty-copy">로컬 서버가 켜져 있을 때 저장된 토론을 불러올 수 있습니다.</p>';
    return;
  }
  if (!state.sessions.length) {
    el.sessionList.innerHTML = '<p class="empty-copy">아직 저장된 토론이 없습니다.</p>';
    return;
  }

  el.sessionList.innerHTML = state.sessions
    .map((session) => `
      <button class="session-item${session.id === state.sessionId ? " active" : ""}" data-session-id="${escapeHtml(session.id)}" type="button">
        <strong>${escapeHtml(cleanDisplayTitle(session.topic))}</strong>
        <span>${escapeHtml(statusLabels[session.status] || session.status)} · 역할 ${session.roleCount || "-"}개 · ${session.messageCount || 0}개 발언</span>
      </button>
    `)
    .join("");
}

function renderStatus() {
  const topic = el.topicInput.value.trim() || "제목 없는 토론";
  const humanCount = state.messages.filter((message) => message.roleId === "human").length;
  const activeEngine = state.serverInfo?.engines?.find((engine) => engine.id === state.engineMode);

  el.stageTitle.textContent = topic;
  el.statusBadge.textContent = statusLabels[state.status] || state.status;
  el.statusBadge.className = `status-pill ${state.status}`;
  el.statusText.textContent = statusLabels[state.status] || state.status;
  el.liveRoleText.textContent = state.liveRoleId ? roleFor(state.liveRoleId).name : "대기";
  el.messageCountText.textContent = `${state.messages.length}개`;
  el.humanCountText.textContent = `${humanCount}회`;
  el.roleCount.textContent = `${sanitizeRoles(state.roles).length}개`;
  el.exportButton.disabled = !state.messages.length;
  el.stopButton.disabled = state.status !== "running";
  el.startButton.disabled = state.status === "running";
  el.chatInput.disabled = !state.messages.length;
  el.sendButton.disabled = !state.messages.length;
  el.reportRefreshButton.disabled = !state.messages.length || !state.serverAvailable;
  el.engineSelect.value = state.engineMode;

  if (state.serverAvailable) {
    el.statusDot.className = "status-dot online";
    el.serverDetail.textContent = "로컬 서버가 연결되어 있습니다.";
    el.engineStatusText.textContent = activeEngine?.ready ? `${activeEngine.label} 준비됨` : "대체 실행 가능";
    el.openclawHint.textContent = state.serverInfo?.openclaw?.setupHint || "오픈클로 상태를 확인했습니다.";
  } else {
    el.statusDot.className = "status-dot";
    el.serverDetail.textContent = "로컬 서버가 없어 브라우저 안의 예비 실행으로만 미리 볼 수 있습니다.";
    el.engineStatusText.textContent = "서버 없음";
    el.openclawHint.textContent = "실제 엔진을 쓰려면 터미널에서 로컬 서버 실행 명령을 실행하세요.";
  }
}

function render() {
  renderRoles();
  renderMessages();
  renderReport();
  renderSessions();
  renderStatus();
}

function escapeHtml(value) {
  const template = document.createElement("template");
  template.textContent = String(value || "");
  return template.innerHTML;
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanDisplayTitle(value) {
  const text = String(value || "").trim();
  if (!text) return "제목 없는 토론";
  const questionMarks = (text.match(/\?/g) || []).length;
  const koreanLetters = (text.match(/[가-힣]/g) || []).length;
  if (questionMarks >= 4 && koreanLetters < 2) return "이전 토론";
  return text;
}

async function refreshServerStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("상태 확인 실패");
    state.serverInfo = await response.json();
    state.serverAvailable = true;
  } catch {
    state.serverAvailable = false;
    state.serverInfo = null;
  }
  render();
}

async function loadSessions() {
  if (!state.serverAvailable) {
    state.sessions = [];
    render();
    return;
  }
  try {
    const response = await fetch("/api/sessions", { cache: "no-store" });
    if (!response.ok) throw new Error("세션 목록을 불러오지 못했습니다.");
    const payload = await response.json();
    state.sessions = payload.sessions || [];
  } catch {
    state.sessions = [];
  }
  render();
}

async function openSession(sessionId) {
  if (!state.serverAvailable || !sessionId) return;
  try {
    const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("세션을 불러오지 못했습니다.");
    const payload = await response.json();
    applySession(payload.session);
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
  }
  render();
}

function applySession(session) {
  state.sessionId = session.id;
  state.sessionSource = session.source || "server";
  state.topic = session.topic || "";
  state.roles = sanitizeRoles(session.roles || defaultRoles);
  state.engineMode = session.engineMode || "openclaw";
  state.status = session.status || "completed";
  state.messages = session.messages || [];
  state.finalReport = session.finalReport || null;
  state.lastError = session.lastError || "";
  state.liveRoleId = null;
  el.topicInput.value = state.topic;
}

async function startDebate() {
  state.topic = el.topicInput.value.trim() || "제목 없는 토론";
  state.roles = sanitizeRoles(state.roles);
  state.engineMode = el.engineSelect.value;
  state.status = "running";
  state.sessionId = null;
  state.sessionSource = state.serverAvailable ? "server" : "local";
  state.messages = [];
  state.finalReport = null;
  state.lastError = "";
  state.cancelled = false;
  render();

  if (state.serverAvailable) {
    await startServerDebate();
  } else {
    await startMockDebate();
  }
}

async function startServerDebate() {
  activeDebateAbortController = new AbortController();
  try {
    const response = await fetch("/api/debate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: state.topic,
        roles: sanitizeRoles(state.roles),
        engineMode: state.engineMode,
      }),
      signal: activeDebateAbortController.signal,
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(text || "토론을 시작하지 못했습니다.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!state.cancelled) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        handleStreamEvent(JSON.parse(trimmed));
      }
    }
  } catch (error) {
    if (!state.cancelled) {
      state.status = "failed";
      state.lastError = error instanceof Error ? error.message : String(error);
    }
  } finally {
    activeDebateAbortController = null;
    if (state.status === "running") state.status = state.cancelled ? "paused" : "completed";
    state.liveRoleId = null;
    await loadSessions();
    render();
  }
}

function handleStreamEvent(event) {
  if (event.type === "session") {
    applySession({ ...event.session, status: "running" });
  }
  if (event.type === "role_start") {
    state.liveRoleId = event.roleId;
  }
  if (event.type === "message") {
    state.messages.push(normalizeServerMessage(event.message));
  }
  if (event.type === "report") {
    state.finalReport = event.report;
  }
  if (event.type === "done") {
    applySession(event.session);
  }
  if (event.type === "error") {
    state.status = "failed";
    state.lastError = event.error || "토론 중 오류가 발생했습니다.";
    if (event.session) applySession(event.session);
  }
  render();
}

function normalizeServerMessage(message) {
  return {
    ...message,
    roleName: message.roleName || roleFor(message.roleId).name,
    engineLabel: message.engineLabel || engineLabels[message.engine] || message.engine,
  };
}

async function startMockDebate() {
  state.sessionId = `local-${Date.now()}`;
  const script = buildScript(state.topic);

  for (const message of script) {
    if (state.cancelled) break;
    state.liveRoleId = message.roleId;
    render();
    await sleep(380);
    state.messages.push(message);
    render();
  }

  state.finalReport = buildFinalReport(state.topic);
  state.status = state.cancelled ? "paused" : "completed";
  state.liveRoleId = null;
  render();
}

function resetDebate() {
  if (activeDebateAbortController) activeDebateAbortController.abort();
  state.status = "draft";
  state.sessionId = null;
  state.sessionSource = "local";
  state.messages = [];
  state.finalReport = null;
  state.liveRoleId = null;
  state.lastError = "";
  state.cancelled = false;
  render();
}

async function submitChat(event) {
  event.preventDefault();
  const content = el.chatInput.value.trim();
  if (!content) return;
  el.chatInput.value = "";

  if (state.serverAvailable && state.sessionId && !state.sessionId.startsWith("local-")) {
    await submitServerChat(content);
  } else {
    const human = makeMessage("human", nextRound(), content);
    human.engine = "human";
    human.engineLabel = engineLabels.human;
    state.messages.push(human);
    state.messages.push(chatResponse(content));
    state.finalReport = buildFinalReport(state.topic || el.topicInput.value.trim());
  }
  render();
}

async function submitServerChat(content) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        content,
        engineMode: state.engineMode,
      }),
    });
    if (!response.ok) throw new Error("채팅을 보내지 못했습니다.");
    const payload = await response.json();
    applySession(payload.session);
    await loadSessions();
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
  }
}

async function refreshReport() {
  if (!state.serverAvailable || !state.sessionId || state.sessionId.startsWith("local-")) {
    state.finalReport = buildFinalReport(state.topic || el.topicInput.value.trim());
    render();
    return;
  }

  try {
    el.reportRefreshButton.disabled = true;
    const response = await fetch("/api/session/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: state.sessionId,
        engineMode: state.engineMode,
      }),
    });
    if (!response.ok) throw new Error("보고서를 다시 정리하지 못했습니다.");
    const payload = await response.json();
    applySession(payload.session);
    await loadSessions();
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
  }
  render();
}

function exportDebate() {
  if (!state.messages.length) return;
  if (state.serverAvailable && state.sessionId && !state.sessionId.startsWith("local-")) {
    window.location.href = `/api/sessions/${encodeURIComponent(state.sessionId)}/export.md`;
    return;
  }

  const payload = {
    topic: state.topic || el.topicInput.value.trim(),
    roles: sanitizeRoles(state.roles),
    messages: state.messages,
    finalReport: state.finalReport,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "agent-debate-session.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

el.topicForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startDebate();
});

el.newButton.addEventListener("click", resetDebate);
el.resetButton.addEventListener("click", resetDebate);
el.stopButton.addEventListener("click", () => {
  state.cancelled = true;
  state.status = "paused";
  if (activeDebateAbortController) activeDebateAbortController.abort();
  render();
});
el.exportButton.addEventListener("click", exportDebate);
el.engineSelect.addEventListener("change", () => {
  state.engineMode = el.engineSelect.value;
  renderStatus();
});
el.chatForm.addEventListener("submit", submitChat);
el.reportRefreshButton.addEventListener("click", refreshReport);
el.sessionList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-session-id]");
  if (button) openSession(button.getAttribute("data-session-id"));
});
el.addRoleButton.addEventListener("click", () => {
  const index = state.roles.length;
  if (index >= 8) return;
  state.roles.push({
    id: `role-${Date.now()}`,
    name: `새 역할 ${index + 1}`,
    description: "이 역할이 토론에서 맡을 관점을 적어주세요.",
    instruction: "역할 설명에 맞춰 짧고 분명하게 말합니다.",
    color: roleColors[index % roleColors.length],
  });
  render();
});
el.roleEditor.addEventListener("input", (event) => {
  const card = event.target.closest("[data-role-index]");
  const field = event.target.getAttribute("data-role-field");
  if (!card || !field) return;
  const index = Number(card.getAttribute("data-role-index"));
  if (!state.roles[index]) return;
  state.roles[index][field] = event.target.value;
  if (field === "name") state.roles[index].initials = makeInitials(event.target.value);
  renderStatus();
});
el.roleEditor.addEventListener("click", (event) => {
  const action = event.target.getAttribute("data-role-action");
  if (action !== "delete") return;
  const card = event.target.closest("[data-role-index]");
  const index = Number(card?.getAttribute("data-role-index"));
  if (state.roles.length <= 1) return;
  state.roles.splice(index, 1);
  render();
});

refreshServerStatus()
  .then(loadSessions)
  .finally(render);
