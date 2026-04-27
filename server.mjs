import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.PORT || "4187", 10);
const HOST = process.env.HOST || "127.0.0.1";
const STATIC_DIR = path.join(__dirname, "mvp");
const DATA_DIR = path.join(__dirname, "data");
const SESSION_DIR = path.join(DATA_DIR, "sessions");
const CLI_OUTPUT_DIR = path.join(__dirname, "output", "cli");
const RUNTIME_WORKSPACE = path.join(DATA_DIR, "runtime-workspace");
const OPENCLAW_PROFILE = process.env.OPENCLAW_PROFILE || "debate";
const ENGINE_TIMEOUT_MS = Number.parseInt(process.env.DEBATE_ENGINE_TIMEOUT_MS || "90000", 10);
const OPENCLAW_TIMEOUT_MS = Number.parseInt(process.env.OPENCLAW_TIMEOUT_MS || String(ENGINE_TIMEOUT_MS), 10);
const OPENCLAW_THINKING = process.env.OPENCLAW_THINKING || "low";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const OPENAI_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_TIMEOUT_MS || "45000", 10);
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-5.5";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3";
const DEFAULT_CODEX_MODEL = process.env.CODEX_MODEL || "gpt-5.4-mini";
const CODEX_TIMEOUT_MS = Number.parseInt(process.env.CODEX_TIMEOUT_MS || process.env.DEBATE_ENGINE_TIMEOUT_MS || "120000", 10);
const CODEX_TEST_TIMEOUT_MS = Number.parseInt(process.env.CODEX_TEST_TIMEOUT_MS || "45000", 10);
const AI_API_TIMEOUT_MS = Number.parseInt(process.env.AI_API_TIMEOUT_MS || "45000", 10);
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const CODEX_WRAPPER = process.env.CODEX_WRAPPER || "D:\\bin\\codex-wrapper.ps1";
const NPM_GLOBAL_DIR = process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : "";
const OPENCLAW_ENTRY = NPM_GLOBAL_DIR
  ? path.join(NPM_GLOBAL_DIR, "node_modules", "openclaw", "openclaw.mjs")
  : "";
const CLAUDE_ENTRY = NPM_GLOBAL_DIR
  ? path.join(NPM_GLOBAL_DIR, "node_modules", "@anthropic-ai", "claude-code", "cli.js")
  : "";
const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), `.openclaw-${OPENCLAW_PROFILE}`, "openclaw.json");

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

const engineLabels = {
  openai: "OpenAI API",
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  openclaw: "오픈클로",
  codex: "코덱스",
  claude: "클로드",
  mock: "예비 엔진",
  human: "사람",
};

const directApiProviders = new Set(["openai", "anthropic", "gemini", "openrouter"]);

const providerEnvKeys = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const providerDefaultModels = {
  openai: DEFAULT_OPENAI_MODEL,
  anthropic: DEFAULT_ANTHROPIC_MODEL,
  gemini: DEFAULT_GEMINI_MODEL,
  openrouter: DEFAULT_OPENROUTER_MODEL,
  ollama: DEFAULT_OLLAMA_MODEL,
  codex: DEFAULT_CODEX_MODEL,
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

await ensureRuntimeDirs();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (req.method === "GET" && url.pathname === "/api/status") {
      return sendJson(res, 200, await getStatus());
    }

    if (req.method === "GET" && url.pathname === "/api/debate-lite/runtime/options") {
      return sendJson(res, 200, await getDebateLiteRuntimeOptions());
    }

    if (req.method === "POST" && url.pathname === "/api/debate-lite/runtime/test") {
      return await testDebateLiteRuntime(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/debate-lite/agenda") {
      return await handleDebateLiteAgenda(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/debate-lite/stream") {
      return await streamDebateLite(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/debate-lite/intervention") {
      return await handleDebateLiteIntervention(req, res);
    }

    if (req.method === "GET" && url.pathname === "/api/sessions") {
      return sendJson(res, 200, { sessions: await listSessions() });
    }

    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (req.method === "GET" && sessionMatch) {
      const session = await loadSession(sessionMatch[1]);
      return sendJson(res, 200, { session: publicSession(session) });
    }

    const exportMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/export\.md$/);
    if (req.method === "GET" && exportMatch) {
      const session = await loadSession(exportMatch[1]);
      const markdown = buildMarkdownExport(session);
      res.writeHead(200, {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${session.id}.md"`,
      });
      res.end(markdown);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/debate/stream") {
      return await streamDebate(req, res);
    }

    if (req.method === "POST" && (url.pathname === "/api/chat" || url.pathname === "/api/intervention")) {
      return await handleChat(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/session/report") {
      return await handleReportRefresh(req, res);
    }

    return await serveStatic(url.pathname, res);
  } catch (error) {
    const status = error?.statusCode || 500;
    return sendJson(res, status, {
      error: status === 404 ? "요청한 항목을 찾을 수 없습니다." : "서버 오류가 발생했습니다.",
      detail: error instanceof Error ? trimForError(error.message) : trimForError(String(error)),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`에이전트 토론방 서버: http://${HOST}:${PORT}`);
});

async function ensureRuntimeDirs() {
  await mkdir(SESSION_DIR, { recursive: true });
  await mkdir(CLI_OUTPUT_DIR, { recursive: true });
  await mkdir(RUNTIME_WORKSPACE, { recursive: true });
  await writeFile(
    path.join(RUNTIME_WORKSPACE, "README.md"),
    [
      "# Agent Debate Runtime Workspace",
      "",
      "이 폴더는 에이전트 토론방이 로컬 명령줄 엔진을 실행할 때 쓰는 작업 공간입니다.",
      "토론 엔진은 파일 수정을 요청받지 않으며, 공개 가능한 발언만 생성해야 합니다.",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(RUNTIME_WORKSPACE, "AGENTS.md"),
    [
      "# Agent Debate Runtime",
      "",
      "You are invoked by Agent Debate Room as a text-only agenda interviewer, debate participant, or report writer.",
      "This workspace is not a coding task. Do not inspect files, modify files, run commands, or reveal hidden reasoning.",
      "For agenda prompts, behave like a Korean conversational LLM helping the user clarify their issue. Return only the requested JSON object, and put any helpful follow-up question inside the JSON reply field.",
      "For debate prompts, return only the requested Korean debate utterance. For report prompts, return only the requested JSON report.",
      "Do not merely confirm your role, output format, or instructions.",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function getStatus() {
  const [openclawAvailable, codexAvailable, claudeAvailable, openclawConfigExists, sessionCount] =
    await Promise.all([
      commandExists("openclaw"),
      commandExists("codex"),
      commandExists("claude"),
      fileExists(OPENCLAW_CONFIG_PATH),
      countSessions(),
    ]);

  return {
    ok: true,
    app: "에이전트 토론방",
    version: "0.3.0",
    defaultEngine: "openclaw",
    profile: OPENCLAW_PROFILE,
    timeoutMs: ENGINE_TIMEOUT_MS,
    storage: path.relative(__dirname, SESSION_DIR),
    sessionCount,
    openclaw: {
      profile: OPENCLAW_PROFILE,
      localMode: true,
      configReady: openclawConfigExists,
      configPath: maskHome(OPENCLAW_CONFIG_PATH),
      setupHint:
        openclawAvailable && openclawConfigExists
          ? "토론 전용 프로필 설정 파일을 찾았습니다. 모델 인증이 준비되어 있으면 오픈클로가 1순위로 실행됩니다."
          : "오픈클로 토론 전용 프로필이 아직 준비되지 않았습니다. README의 설정 명령을 실행한 뒤 다시 시도하세요.",
    },
    engines: [
      {
        id: "openclaw",
        label: engineLabels.openclaw,
        available: openclawAvailable,
        ready: openclawAvailable && openclawConfigExists,
        detail: openclawAvailable
          ? openclawConfigExists
            ? "로컬 오픈클로 명령줄 도구와 토론 전용 프로필이 감지되었습니다."
            : "오픈클로 명령줄 도구는 있지만 토론 전용 프로필 설정 파일이 없습니다."
          : "오픈클로 명령줄 도구를 찾지 못했습니다.",
      },
      {
        id: "codex",
        label: engineLabels.codex,
        available: codexAvailable,
        ready: codexAvailable,
        detail: codexAvailable ? "코덱스 명령줄 도구를 보조 엔진으로 사용할 수 있습니다." : "코덱스 명령줄 도구를 찾지 못했습니다.",
      },
      {
        id: "claude",
        label: engineLabels.claude,
        available: claudeAvailable,
        ready: claudeAvailable,
        detail: claudeAvailable ? "클로드 명령줄 도구를 보조 엔진으로 사용할 수 있습니다." : "클로드 명령줄 도구를 찾지 못했습니다.",
      },
      {
        id: "mock",
        label: engineLabels.mock,
        available: true,
        ready: true,
        detail: "실제 엔진이 모두 실패할 때만 쓰는 예비 응답 엔진입니다.",
      },
    ],
  };
}

async function getDebateLiteRuntimeOptions() {
  const [openclawAvailable, codexAvailable, openclawConfigExists, ollamaReady] = await Promise.all([
    commandExists("openclaw"),
    commandExists("codex"),
    fileExists(OPENCLAW_CONFIG_PATH),
    checkOllamaReady(),
  ]);

  const defaultProvider = process.env.OPENAI_API_KEY
    ? "openai"
    : process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : process.env.OPENROUTER_API_KEY
          ? "openrouter"
          : ollamaReady
            ? "ollama"
            : openclawAvailable && openclawConfigExists
              ? "openclaw"
              : "mock";

  return {
    ok: true,
    defaultProvider,
    defaultOpenAIModel: DEFAULT_OPENAI_MODEL,
    defaultModels: providerDefaultModels,
    defaultBaseUrls: {
      ollama: OLLAMA_BASE_URL,
    },
    providers: {
      openai: {
        id: "openai",
        label: engineLabels.openai,
        ready: Boolean(process.env.OPENAI_API_KEY),
        available: true,
        model: DEFAULT_OPENAI_MODEL,
        auth: process.env.OPENAI_API_KEY ? "env" : "api-key",
        detail: process.env.OPENAI_API_KEY
          ? "서버 환경변수 OPENAI_API_KEY가 감지되었습니다."
          : "브라우저에서 OpenAI API 키를 입력하면 이 세션의 요청에만 사용합니다.",
      },
      anthropic: {
        id: "anthropic",
        label: engineLabels.anthropic,
        ready: Boolean(process.env.ANTHROPIC_API_KEY),
        available: true,
        model: DEFAULT_ANTHROPIC_MODEL,
        auth: process.env.ANTHROPIC_API_KEY ? "env" : "api-key",
        detail: process.env.ANTHROPIC_API_KEY
          ? "서버 환경변수 ANTHROPIC_API_KEY가 감지되었습니다."
          : "Claude API 키를 브라우저 세션에 넣어 Anthropic Messages API로 실행합니다.",
      },
      gemini: {
        id: "gemini",
        label: engineLabels.gemini,
        ready: Boolean(process.env.GEMINI_API_KEY),
        available: true,
        model: DEFAULT_GEMINI_MODEL,
        auth: process.env.GEMINI_API_KEY ? "env" : "api-key",
        detail: process.env.GEMINI_API_KEY
          ? "서버 환경변수 GEMINI_API_KEY가 감지되었습니다."
          : "Google AI Studio의 Gemini API 키를 브라우저 세션에 넣어 실행합니다.",
      },
      openrouter: {
        id: "openrouter",
        label: engineLabels.openrouter,
        ready: Boolean(process.env.OPENROUTER_API_KEY),
        available: true,
        model: DEFAULT_OPENROUTER_MODEL,
        auth: process.env.OPENROUTER_API_KEY ? "env" : "api-key",
        detail: process.env.OPENROUTER_API_KEY
          ? "서버 환경변수 OPENROUTER_API_KEY가 감지되었습니다."
          : "OpenRouter API 키를 브라우저 세션에 넣고 선택한 라우팅 모델로 실행합니다.",
      },
      ollama: {
        id: "ollama",
        label: engineLabels.ollama,
        ready: ollamaReady,
        available: true,
        model: DEFAULT_OLLAMA_MODEL,
        baseUrl: OLLAMA_BASE_URL,
        auth: "local-http",
        detail: ollamaReady
          ? `Ollama 로컬 서버가 ${OLLAMA_BASE_URL}에서 응답합니다.`
          : `Ollama가 아직 ${OLLAMA_BASE_URL}에서 응답하지 않습니다. Ollama 앱 또는 서버를 먼저 켜세요.`,
      },
      codex: {
        id: "codex",
        label: engineLabels.codex,
        available: codexAvailable,
        ready: false,
        model: DEFAULT_CODEX_MODEL,
        auth: "oauth-cli",
        detail: codexAvailable
          ? "코덱스 CLI가 감지되었습니다. 연결 테스트로 로그인 상태를 확인하세요."
          : "코덱스 명령줄 도구를 찾지 못했습니다.",
      },
      openclaw: {
        id: "openclaw",
        label: engineLabels.openclaw,
        available: openclawAvailable,
        ready: openclawAvailable && openclawConfigExists,
        auth: "local-profile",
        detail:
          openclawAvailable && openclawConfigExists
            ? `오픈클로 명령줄 도구와 ${OPENCLAW_PROFILE} 프로필이 준비되었습니다.`
            : `오픈클로 명령줄 도구 또는 ${maskHome(OPENCLAW_CONFIG_PATH)} 설정 파일이 필요합니다.`,
      },
      mock: {
        id: "mock",
        label: engineLabels.mock,
        available: true,
        ready: true,
        auth: "none",
        detail: "API 키 없이 제품 흐름만 확인하는 예비 엔진입니다.",
      },
    },
  };
}

async function testDebateLiteRuntime(req, res) {
  const body = await readJsonBody(req);
  const runtime = normalizeDebateLiteRuntime(body.runtime || body);
  const startedAt = Date.now();

  try {
    if (directApiProviders.has(runtime.provider) || runtime.provider === "ollama") {
      const text = await runDirectProvider(runtime.provider, "한국어로 ok 한 단어만 답하세요.", {
        runtime,
        timeoutMs: Math.min(AI_API_TIMEOUT_MS, 20000),
      });
      return sendJson(res, 200, {
        ok: true,
        provider: runtime.provider,
        label: engineLabels[runtime.provider],
        model: runtime.model,
        baseUrl: runtime.provider === "ollama" ? runtime.baseUrl || OLLAMA_BASE_URL : undefined,
        durationMs: Date.now() - startedAt,
        detail: `${engineLabels[runtime.provider]} 응답을 확인했습니다: ${clip(cleanAssistantText(text), 32) || "ok"}`,
      });
    }

    if (runtime.provider === "codex") {
      const status = await getCodexLoginStatus();
      if (!status.ok) {
        return sendJson(res, 400, {
          ok: false,
          provider: runtime.provider,
          label: engineLabels.codex,
          detail: status.message,
          setup: "codex login 또는 codex login --device-auth를 먼저 실행하세요.",
        });
      }
      const text = await runCodex("한국어로 ok 한 단어만 답하세요.", {
        sessionId: "runtime-test",
        roleId: "codex",
        kind: "test",
        runtime,
        timeoutMs: Math.min(CODEX_TEST_TIMEOUT_MS, CODEX_TIMEOUT_MS),
      });
      return sendJson(res, 200, {
        ok: true,
        provider: runtime.provider,
        label: engineLabels.codex,
        model: runtime.model || DEFAULT_CODEX_MODEL,
        durationMs: Date.now() - startedAt,
        detail: `Codex OAuth와 실제 응답을 확인했습니다: ${clip(cleanAssistantText(text), 32) || "ok"}`,
      });
    }

    if (runtime.provider === "openclaw") {
      const openclawAvailable = await commandExists("openclaw");
      const profileReady = await fileExists(OPENCLAW_CONFIG_PATH);
      if (!openclawAvailable || !profileReady) {
        return sendJson(res, 400, {
          ok: false,
          provider: runtime.provider,
          label: engineLabels.openclaw,
          detail: openclawAvailable
            ? `${OPENCLAW_PROFILE} 프로필 설정 파일이 없습니다.`
            : "오픈클로 명령줄 도구를 찾지 못했습니다.",
          setup: `OPENCLAW_PROFILE=${OPENCLAW_PROFILE} 기준 설정 파일: ${maskHome(OPENCLAW_CONFIG_PATH)}`,
        });
      }
      return sendJson(res, 200, {
        ok: true,
        provider: runtime.provider,
        label: engineLabels.openclaw,
        durationMs: Date.now() - startedAt,
        detail: `오픈클로 ${OPENCLAW_PROFILE} 프로필을 사용할 수 있습니다.`,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      provider: "mock",
      label: engineLabels.mock,
      durationMs: Date.now() - startedAt,
      detail: "예비 엔진은 항상 사용할 수 있습니다.",
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      provider: runtime.provider,
      label: engineLabels[runtime.provider] || runtime.provider,
      detail: error instanceof Error ? trimForError(error.message) : trimForError(String(error)),
    });
  }
}

function normalizeDebateLiteRuntime(value = {}) {
  const rawProvider = normalizeText(value.provider || value.engineMode || value.mode).toLowerCase();
  const aliases = new Map([
    ["api", "openai"],
    ["openai-api", "openai"],
    ["claude-api", "anthropic"],
    ["anthropic-api", "anthropic"],
    ["google", "gemini"],
    ["google-gemini", "gemini"],
    ["gemini-api", "gemini"],
    ["openrouter-api", "openrouter"],
    ["ollama-local", "ollama"],
    ["oauth", "codex"],
    ["codex-oauth", "codex"],
    ["openclaw-local", "openclaw"],
  ]);
  const provider = aliases.get(rawProvider) || rawProvider;
  const safeProvider = ["openai", "anthropic", "gemini", "openrouter", "ollama", "codex", "openclaw", "claude", "mock"].includes(provider)
    ? provider
    : "mock";
  return {
    provider: safeProvider,
    model: clip(normalizeText(value.model) || defaultModelForProvider(safeProvider), 120),
    baseUrl: clip(normalizeText(value.baseUrl) || (safeProvider === "ollama" ? OLLAMA_BASE_URL : ""), 180),
    apiKey: normalizeText(value.apiKey),
  };
}

function sanitizeDebateLiteRuntime(runtime) {
  return {
    provider: runtime.provider,
    model: providerDefaultModels[runtime.provider] ? runtime.model : "",
    baseUrl: runtime.provider === "ollama" ? runtime.baseUrl || OLLAMA_BASE_URL : "",
    auth: runtimeAuthState(runtime),
  };
}

function defaultModelForProvider(provider) {
  return providerDefaultModels[provider] || "";
}

function runtimeAuthState(runtime) {
  if (directApiProviders.has(runtime.provider)) {
    const envKey = providerEnvKeys[runtime.provider];
    return runtime.apiKey ? "browser-session" : process.env[envKey] ? "env" : "missing";
  }
  if (runtime.provider === "ollama") return "local-http";
  return "local";
}

async function getCodexLoginStatus() {
  if (!(await commandExists("codex"))) {
    return { ok: false, message: "코덱스 명령줄 도구를 찾지 못했습니다." };
  }

  const invocation =
    process.platform === "win32" && (await fileExists(CODEX_WRAPPER))
      ? {
          command: "powershell.exe",
          args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", CODEX_WRAPPER, "login", "status"],
        }
      : {
          command: "codex",
          args: ["login", "status"],
        };

  const result = await runCommand({
    ...invocation,
    cwd: __dirname,
    timeoutMs: 10000,
    env: { NO_COLOR: "1", FORCE_COLOR: "0" },
  });

  if (result.exitCode === 0) {
    return { ok: true, message: "코덱스 OAuth/API 로그인 상태를 확인했습니다." };
  }

  return {
    ok: false,
    message: trimForError(result.stderr || result.stdout || "codex login status가 실패했습니다."),
  };
}

async function runOpenAIResponse(
  prompt,
  { apiKey, model = DEFAULT_OPENAI_MODEL, timeoutMs = OPENAI_TIMEOUT_MS, instructions = debateApiSystemPrompt(), textFormat } = {},
) {
  const key = normalizeText(apiKey) || process.env.OPENAI_API_KEY || "";
  if (!key) {
    throw new Error("OpenAI API 키가 없습니다. 화면에 API 키를 입력하거나 OPENAI_API_KEY 환경변수를 설정하세요.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs).unref();
  try {
    const modelName = normalizeText(model) || DEFAULT_OPENAI_MODEL;
    const requestPayload = {
      model: modelName,
      instructions,
      input: prompt,
      store: false,
      max_output_tokens: 900,
    };
    if (/^(gpt-5|o\d|o[134])/i.test(modelName)) requestPayload.reasoning = { effort: "low" };
    if (/^gpt-5/i.test(modelName)) requestPayload.text = { verbosity: "low" };
    if (textFormat) requestPayload.text = { ...(requestPayload.text || {}), format: textFormat };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    const raw = await response.text();
    const responsePayload = parseJsonFromOutput(raw);
    if (!response.ok) {
      const message = extractOpenAIError(responsePayload) || raw || `OpenAI API 요청이 실패했습니다. status=${response.status}`;
      throw new Error(message);
    }

    const text = extractOpenAIText(responsePayload);
    if (!text) throw new Error("OpenAI API에서 텍스트 응답을 찾지 못했습니다.");
    return text;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`OpenAI API 응답 시간이 ${Math.ceil(timeoutMs / 1000)}초를 넘었습니다.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractOpenAIText(payload) {
  if (!payload) return "";
  if (typeof payload.output_text === "string") return payload.output_text;
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      if (typeof content.text === "string" && !parts.includes(content.text)) parts.push(content.text);
    }
  }
  return parts.join("\n").trim() || extractText(payload);
}

function extractOpenAIError(payload) {
  if (!payload) return "";
  return normalizeText(payload.error?.message || payload.error?.type || payload.message);
}

async function runDirectProvider(provider, prompt, context = {}) {
  if (provider === "openai") {
    return runOpenAIResponse(prompt, {
      apiKey: context.runtime?.apiKey,
      model: context.runtime?.model,
      timeoutMs: context.timeoutMs || OPENAI_TIMEOUT_MS,
      instructions: context.instructions || context.systemPrompt || debateApiSystemPrompt(),
      textFormat: context.textFormat,
    });
  }
  if (provider === "anthropic") {
    return runAnthropicResponse(prompt, {
      apiKey: context.runtime?.apiKey,
      model: context.runtime?.model,
      timeoutMs: context.timeoutMs || AI_API_TIMEOUT_MS,
      systemPrompt: context.systemPrompt || context.instructions || debateApiSystemPrompt(),
    });
  }
  if (provider === "gemini") {
    return runGeminiResponse(prompt, {
      apiKey: context.runtime?.apiKey,
      model: context.runtime?.model,
      timeoutMs: context.timeoutMs || AI_API_TIMEOUT_MS,
      systemPrompt: context.systemPrompt || context.instructions || debateApiSystemPrompt(),
    });
  }
  if (provider === "openrouter") {
    return runOpenRouterResponse(prompt, {
      apiKey: context.runtime?.apiKey,
      model: context.runtime?.model,
      timeoutMs: context.timeoutMs || AI_API_TIMEOUT_MS,
      systemPrompt: context.systemPrompt || context.instructions || debateApiSystemPrompt(),
    });
  }
  if (provider === "ollama") {
    return runOllamaResponse(prompt, {
      model: context.runtime?.model,
      baseUrl: context.runtime?.baseUrl,
      timeoutMs: context.timeoutMs || AI_API_TIMEOUT_MS,
      systemPrompt: context.systemPrompt || context.instructions || debateApiSystemPrompt(),
    });
  }
  throw new Error(`지원하지 않는 API 공급자입니다: ${provider}`);
}

async function runAnthropicResponse(
  prompt,
  { apiKey, model = DEFAULT_ANTHROPIC_MODEL, timeoutMs = AI_API_TIMEOUT_MS, systemPrompt = debateApiSystemPrompt() } = {},
) {
  const key = apiKeyForProvider("anthropic", apiKey);
  const modelName = normalizeText(model) || DEFAULT_ANTHROPIC_MODEL;
  const { response, payload, raw } = await fetchJsonWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 900,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    timeoutMs,
    "Anthropic Claude",
  );

  if (!response.ok) {
    throw new Error(extractProviderError(payload) || raw || `Anthropic API 요청이 실패했습니다. status=${response.status}`);
  }

  const text = extractAnthropicText(payload);
  if (!text) throw new Error("Anthropic API에서 텍스트 응답을 찾지 못했습니다.");
  return text;
}

async function runGeminiResponse(
  prompt,
  { apiKey, model = DEFAULT_GEMINI_MODEL, timeoutMs = AI_API_TIMEOUT_MS, systemPrompt = debateApiSystemPrompt() } = {},
) {
  const key = apiKeyForProvider("gemini", apiKey);
  const modelName = normalizeText(model) || DEFAULT_GEMINI_MODEL;
  const modelPath = modelName.startsWith("models/") ? modelName : `models/${modelName}`;
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`);
  url.searchParams.set("key", key);

  const { response, payload, raw } = await fetchJsonWithTimeout(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 900, temperature: 0.35 },
      }),
    },
    timeoutMs,
    "Google Gemini",
  );

  if (!response.ok) {
    throw new Error(extractProviderError(payload) || raw || `Gemini API 요청이 실패했습니다. status=${response.status}`);
  }

  const text = extractGeminiText(payload);
  if (!text) throw new Error("Gemini API에서 텍스트 응답을 찾지 못했습니다.");
  return text;
}

async function runOpenRouterResponse(
  prompt,
  { apiKey, model = DEFAULT_OPENROUTER_MODEL, timeoutMs = AI_API_TIMEOUT_MS, systemPrompt = debateApiSystemPrompt() } = {},
) {
  const key = apiKeyForProvider("openrouter", apiKey);
  const modelName = normalizeText(model) || DEFAULT_OPENROUTER_MODEL;
  const { response, payload, raw } = await fetchJsonWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "Agent Debate Room",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: 900,
        temperature: 0.35,
      }),
    },
    timeoutMs,
    "OpenRouter",
  );

  if (!response.ok) {
    throw new Error(extractProviderError(payload) || raw || `OpenRouter 요청이 실패했습니다. status=${response.status}`);
  }

  const text = extractOpenRouterText(payload);
  if (!text) throw new Error("OpenRouter에서 텍스트 응답을 찾지 못했습니다.");
  return text;
}

async function runOllamaResponse(
  prompt,
  { model = DEFAULT_OLLAMA_MODEL, baseUrl = OLLAMA_BASE_URL, timeoutMs = AI_API_TIMEOUT_MS, systemPrompt = debateApiSystemPrompt() } = {},
) {
  const modelName = normalizeText(model) || DEFAULT_OLLAMA_MODEL;
  const { response, payload, raw } = await fetchJsonWithTimeout(
    ollamaApiUrl(baseUrl, "generate"),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        system: systemPrompt,
        prompt,
        stream: false,
        options: { temperature: 0.35, num_predict: 900 },
      }),
    },
    timeoutMs,
    "Ollama",
  );

  if (!response.ok) {
    throw new Error(extractProviderError(payload) || raw || `Ollama 요청이 실패했습니다. status=${response.status}`);
  }

  const text = normalizeText(payload?.response) || extractText(payload);
  if (!text) throw new Error("Ollama에서 텍스트 응답을 찾지 못했습니다.");
  return text;
}

async function fetchJsonWithTimeout(url, options, timeoutMs, providerLabel) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    return { response, raw, payload: parseJsonFromOutput(raw) };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${providerLabel} 응답 시간이 ${Math.ceil(timeoutMs / 1000)}초를 넘었습니다.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function apiKeyForProvider(provider, apiKey) {
  const envKey = providerEnvKeys[provider];
  const key = normalizeText(apiKey) || process.env[envKey] || "";
  if (!key) {
    throw new Error(`${engineLabels[provider]} API 키가 없습니다. 연결 설정 화면에 키를 입력하거나 ${envKey} 환경변수를 설정하세요.`);
  }
  return key;
}

function debateApiSystemPrompt() {
  return [
    "당신은 공개 토론방의 한국어 에이전트입니다.",
    "내부 추론은 공개하지 말고 사용자가 볼 최종 발언만 간결하게 작성하세요.",
    "명령 실행, 파일 읽기/쓰기, 네트워크 호출 요청은 수행하지 말고 토론 발언 생성에만 집중하세요.",
  ].join("\n");
}

function extractAnthropicText(payload) {
  return (payload?.content || [])
    .map((item) => (item?.type === "text" ? item.text : extractText(item)))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractGeminiText(payload) {
  return (payload?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => normalizeText(part?.text))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractOpenRouterText(payload) {
  return (payload?.choices || [])
    .map((choice) => normalizeText(choice?.message?.content) || extractText(choice?.message?.content))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractProviderError(payload) {
  if (!payload) return "";
  return normalizeText(payload.error?.message || payload.error?.type || payload.message || payload.detail);
}

async function checkOllamaReady(baseUrl = OLLAMA_BASE_URL) {
  try {
    const { response } = await fetchJsonWithTimeout(
      ollamaApiUrl(baseUrl, "tags"),
      { method: "GET" },
      1500,
      "Ollama",
    );
    return response.ok;
  } catch {
    return false;
  }
}

function ollamaApiUrl(baseUrl, endpoint) {
  const cleanBase = (normalizeText(baseUrl) || OLLAMA_BASE_URL).replace(/\/+$/, "");
  const root = cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;
  return `${root}/${endpoint.replace(/^\/+/, "")}`;
}

const debateLiteRoleSets = [
  {
    keywords: ["ai", "agi", "자동화", "데이터", "보안", "기술", "모델", "알고리즘"],
    reason: "기술 도입 이슈로 판단해 리스크, 구현, 사용자 영향을 분리했습니다.",
    roles: [
      {
        id: "agent1",
        name: "리스크 검토자",
        purpose: "보안, 오작동, 책임 소재를 먼저 확인합니다.",
        lens: "도입 전에 막아야 할 실패 조건",
        color: "#8a6419",
      },
      {
        id: "agent2",
        name: "구현 전략가",
        purpose: "지금 만들 수 있는 작은 실험과 기술 경로를 제안합니다.",
        lens: "작게 검증할 수 있는 실행안",
        color: "#0b7d68",
      },
      {
        id: "agent3",
        name: "사용자 영향 분석가",
        purpose: "실제 사용자가 겪을 불편, 신뢰, 수용성을 따집니다.",
        lens: "사용자 경험과 신뢰",
        color: "#326d8f",
      },
    ],
  },
  {
    keywords: ["법", "규제", "정책", "윤리", "공공", "책임", "금지"],
    reason: "규범과 책임이 큰 의제로 판단해 윤리, 실행, 공익 관점을 배정했습니다.",
    roles: [
      {
        id: "agent1",
        name: "윤리 감시자",
        purpose: "피해 가능성, 공정성, 책임 소재를 점검합니다.",
        lens: "넘지 말아야 할 선",
        color: "#8a6419",
      },
      {
        id: "agent2",
        name: "현실 실행가",
        purpose: "규칙을 지키면서 가능한 운영 방식을 찾습니다.",
        lens: "현장에서 굴러가는 대안",
        color: "#0b7d68",
      },
      {
        id: "agent3",
        name: "공익 조율자",
        purpose: "이해관계자 사이의 균형점과 합의 조건을 정리합니다.",
        lens: "사회적 수용성",
        color: "#326d8f",
      },
    ],
  },
  {
    keywords: ["사업", "수익", "가격", "시장", "고객", "제품", "mvp", "서비스", "투자"],
    reason: "사업 판단 의제로 보고 시장성, 실행성, 고객 가치를 나눠 보겠습니다.",
    roles: [
      {
        id: "agent1",
        name: "시장 회의론자",
        purpose: "고객이 정말 돈과 시간을 쓸 이유가 있는지 따집니다.",
        lens: "수요와 경쟁 리스크",
        color: "#8a6419",
      },
      {
        id: "agent2",
        name: "실행 설계자",
        purpose: "가장 작은 출시 범위와 검증 순서를 제안합니다.",
        lens: "MVP와 운영 흐름",
        color: "#0b7d68",
      },
      {
        id: "agent3",
        name: "고객 대변자",
        purpose: "사용자의 실제 맥락과 반복 사용 이유를 확인합니다.",
        lens: "고객 가치",
        color: "#326d8f",
      },
    ],
  },
  {
    keywords: ["시험", "변호사", "로스쿨", "자격증", "진로", "커리어", "취업", "이직", "공부", "합격", "수험"],
    reason: "개인 진로와 시험 선택 문제로 보고, 현실 조건, 장기 커리어, 지속 가능성을 나누어 검토합니다.",
    roles: [
      {
        id: "agent1",
        name: "현실 조건 검토자",
        purpose: "시간, 비용, 체력, 합격 가능성, 기회비용을 차갑게 점검합니다.",
        lens: "지금 감당 가능한 조건과 실패 비용",
        color: "#8a6419",
      },
      {
        id: "agent2",
        name: "커리어 전략가",
        purpose: "시험 이후의 경력 경로, 대안 선택지, 장기 수익을 비교합니다.",
        lens: "장기 진로와 대안 경로",
        color: "#0b7d68",
      },
      {
        id: "agent3",
        name: "지속 가능성 조율자",
        purpose: "동기, 후회 가능성, 생활 균형, 멘탈 부담을 함께 봅니다.",
        lens: "버틸 수 있는 이유와 삶의 균형",
        color: "#326d8f",
      },
    ],
  },
  {
    keywords: [],
    reason: "일반 의제로 보고 반대, 대안, 조율 관점을 기본 배정했습니다.",
    roles: [
      {
        id: "agent1",
        name: "비판적 검토자",
        purpose: "숨은 가정과 실패 가능성을 날카롭게 지적합니다.",
        lens: "리스크와 반례",
        color: "#8a6419",
      },
      {
        id: "agent2",
        name: "대안 제안자",
        purpose: "반대 의견을 피하지 않고 다른 선택지를 제시합니다.",
        lens: "가능한 해법",
        color: "#0b7d68",
      },
      {
        id: "agent3",
        name: "합의 조율자",
        purpose: "논점을 묶고 다음 결정을 위한 기준을 정리합니다.",
        lens: "판단 기준과 결론",
        color: "#326d8f",
      },
    ],
  },
];

async function handleDebateLiteAgenda(req, res) {
  const body = await readJsonBody(req);
  const runtime = normalizeDebateLiteRuntime(body.runtime || body);
  const messages = normalizeAgendaMessages(body.messages);
  const topic =
    normalizeText(body.topic) ||
    normalizeText(messages.find((message) => message.role === "user")?.content);
  const agendaState = buildAgendaState({
    topic,
    messages,
    providedState: body.agendaState || body.state,
  });

  if (!topic) {
    return sendJson(res, 400, { error: "메인 에이전트와 논의할 의제를 입력하세요." });
  }

  const result = await runAgendaTurn({ topic, messages, runtime, agendaState });
  result.agendaState = result.agendaState || agendaState;
  if (result.ready) {
    const agenda = normalizeAgendaContext({
      messages,
      summary: result.summary,
      topicDraft: result.topicDraft || topic,
      transcript: renderAgendaTranscript(messages),
      agendaState: result.agendaState,
    });
    result.rolePlan = await planDebateLiteRolesForAgenda({
      topic: result.topicDraft || topic,
      agenda,
      runtime,
    });
  }
  return sendJson(res, 200, result);
}

function normalizeAgendaMessages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((message) => ({
      role: message?.role === "main" || message?.role === "assistant" ? "main" : "user",
      content: clip(normalizeText(message?.content), 900),
    }))
    .filter((message) => message.content)
    .slice(-16);
}

function normalizeAgendaContext(value = {}) {
  value = value || {};
  const messages = normalizeAgendaMessages(value.messages);
  const summary = clip(normalizeText(value.summary), 1400);
  const topicDraft = clip(normalizeText(value.topicDraft), 280);
  const transcript = clip(normalizeText(value.transcript) || renderAgendaTranscript(messages), 1800);
  const agendaState = normalizeAgendaState(value.agendaState || value.state);
  return { summary, topicDraft, transcript, messages, agendaState };
}

async function runAgendaTurn({ topic, messages, runtime, agendaState }) {
  if (runtime.provider === "mock") {
    return buildMockAgendaTurn({ topic, messages, agendaState, source: "mock" });
  }

  const prompt = buildAgendaPrompt({ topic, messages, agendaState });
  try {
    const text = await runEngine(runtime.provider, prompt, {
      sessionId: `agenda-${crypto.randomUUID()}`,
      roleId: "main",
      kind: "agenda",
      runtime,
      timeoutMs: runtime.provider === "codex" ? Math.min(CODEX_TIMEOUT_MS, 90000) : AI_API_TIMEOUT_MS,
      instructions: agendaSystemPrompt(),
      systemPrompt: agendaSystemPrompt(),
      textFormat: runtime.provider === "openai" ? { type: "json_object" } : undefined,
    });
    return normalizeAgendaResult(text, { topic, messages, agendaState, source: runtime.provider });
  } catch (error) {
    return {
      ...buildMockAgendaTurn({ topic, messages, agendaState, source: "local" }),
      fallback: true,
      error: error instanceof Error ? trimForError(error.message) : trimForError(String(error)),
    };
  }
}

function buildAgendaPrompt({ topic, messages, agendaState }) {
  const transcript = renderAgendaTranscript(messages);
  const userMessages = messages.filter((message) => message.role === "user");
  const latestUser = userMessages[userMessages.length - 1]?.content || topic;
  const state = agendaState || buildAgendaState({ topic, messages });
  const decisionTrack = state.track || detectAgendaDecisionTrack(topic, messages);
  const trackInstruction = agendaDecisionTrackInstruction(decisionTrack);
  return [
    "사용자는 메인 AI와 편하게 대화하면서 '무엇을 토론하면 좋을지'를 같이 좁히고 있습니다.",
    "당신은 접수 양식 담당자가 아니라, 사용자의 말을 먼저 이해하고 토론 가능한 질문으로 다듬어주는 한국어 대화 파트너입니다.",
    "메인 에이전트는 답변을 바로 생성하지 않고, 내부적으로 아래 순서로 동작합니다: 1) 최신 발화 의도 분류, 2) 의제 메모리 업데이트, 3) 다음 행동 결정, 4) 사용자에게 보일 답변 작성.",
    "",
    "현재 내부 상태:",
    JSON.stringify(state, null, 2),
    "",
    "반드시 지킬 것:",
    "- 현재 turnIntent를 최우선으로 따르세요. correction/understanding_check면 새 주제 질문을 하지 말고, 사용자가 실제로 물은 내용을 먼저 다시 잡으세요.",
    "- agendaMemory에 이미 있는 facts, candidates, criteria를 모르는 척하지 마세요.",
    "- 사용자의 최신 발화에 먼저 답하세요. 질문을 받았으면 질문에 답하고, 불만을 말했으면 그 불만을 먼저 처리하세요.",
    "- 사용자가 이미 말한 내용을 모르는 척하지 마세요.",
    "- 이미 아래 대화 내용이 보입니다. '사전 대화가 보이지 않는다', '의제와 상황을 보내달라' 같은 말은 절대 하지 마세요.",
    "- 사용자가 방금 말한 구체 정보 1~2개를 짧게 반영하세요.",
    "- 사용자가 '내 고민을 이해했냐', '내가 뭐라고 했냐', '말했는데 왜 모르냐'처럼 확인하거나 불만을 말하면 먼저 사과하고 지금까지 이해한 내용을 요약하세요. 절대 새 주제를 처음부터 묻지 마세요.",
    "- 사용자가 '왜 이런 식으로 답변하냐', '내가 물은 건 그게 아니다'처럼 말하면 제품/메인 에이전트 답변에 대한 정정으로 해석하세요.",
    "- 주제가 넓으면 2~3개의 좁힌 토론 후보를 제안하고, 가장 좋아 보이는 후보 하나를 추천하세요.",
    "- 충분히 판단이 끝났으면 ready를 true로 두되, reply에서는 사용자가 직접 시작하거나 버튼을 누르면 서브 에이전트 역할을 배정하겠다고 말하세요.",
    "- 아직 토론을 시작하지 마세요. 사용자가 명확히 시작하겠다고 하거나 별도 시작 버튼을 누르기 전까지는 계속 대화합니다.",
    "- 질문은 한 번에 하나만 하세요. 사용자가 답하기 쉬운 질문이어야 합니다.",
    "- '판단 기준', '얻고 싶은 것/피하고 싶은 손실' 같은 양식 문구를 반복하지 말고 자연스럽게 말하세요.",
    "- 역할 확인, 자기소개, 출력 형식 설명, Main Agent로서 응답 같은 내부 말투를 쓰지 마세요.",
    trackInstruction ? `- 현재 선택된 방향은 "${trackInstruction.label}"입니다. ${trackInstruction.rule}` : "",
    trackInstruction ? `- 이번 방향에서 좋은 다음 질문 예시: ${trackInstruction.question}` : "",
    trackInstruction ? "- 사용자의 말을 개인 진로/심리 상담 문제가 아니라, 선택한 사업 의사결정 맥락으로 해석하세요." : "",
    "",
    "응답 우선순위:",
    "1. 사용자의 감정, 의도, 질문에 직접 반응",
    "2. 지금까지 이해한 맥락 반영",
    "3. 가능한 토론 질문 제안",
    "4. 부족한 정보가 있으면 다음에 물어볼 질문 하나",
    "",
    "ready 판단:",
    "- agendaState.readiness.ready가 false면 ready=false로 두세요.",
    "- agendaState.readiness.ready가 true면 ready=true가 될 수 있습니다.",
    "- 아직 사용자의 질문에 답하는 중이거나 핵심 맥락이 거의 없으면 ready=false입니다.",
    "",
    "반드시 JSON 객체 하나만 출력하세요.",
    '{"reply":"사용자에게 보여줄 자연스러운 한국어 답변","ready":false,"topicDraft":"현재 대화 기준으로 가장 좋은 토론 질문 한 문장","summary":"지금까지 이해한 사용자 상황과 좁힌 토론 후보 요약","missing":["더 알면 좋은 것 1","더 알면 좋은 것 2"],"nextAction":"ask_one_question|offer_start|answer_correction|answer_guidance"}',
    "",
    `처음 사용자가 던진 말: ${topic}`,
    `방금 사용자 발화: ${latestUser}`,
    "",
    "지금까지의 실제 대화:",
    transcript || "(아직 대화가 거의 없습니다.)",
  ].join("\n");
  return [
    "아래는 사용자가 토론 전에 의제와 자기 상황을 설명하는 사전 대화입니다.",
    "가장 최근 사용자 발화에 자연스럽게 답하세요.",
    "사용자가 답변 방법이나 예시를 물으면, 토론을 시작하지 말고 어떤 정보를 말하면 좋은지 템플릿과 짧은 예시를 주세요.",
    "사용자가 '무슨 소리야', '이해가 안 된다'처럼 반응하면, 역할 설명을 하지 말고 사과한 뒤 일반 LLM 대화처럼 다시 쉽게 안내하세요.",
    "사용자가 명확히 토론 시작을 요청하지 않았다면 reply에서 계속 대화를 이어가세요.",
    "역할 확인, 자기소개, 'Main Agent로서 응답하겠습니다' 같은 문장은 절대 쓰지 마세요.",
    "반드시 JSON 객체 하나만 출력하세요. JSON 외 텍스트를 붙이지 마세요.",
    '{"reply":"사용자에게 보여줄 한국어 응답","ready":false,"summary":"지금까지 이해한 의제와 사용자 상황 요약","missing":["더 알아야 할 것 1","더 알아야 할 것 2"]}',
    "",
    `초기 의제: ${topic}`,
    "",
    "지금까지의 메인 에이전트 사전 대화:",
    transcript || "(아직 대화가 거의 없습니다.)",
  ].join("\n");
}

function agendaSystemPrompt() {
  return [
    "당신은 사용자가 AI 에이전트들의 토론을 보기 전에, 토론할 질문을 같이 좁혀주는 한국어 대화형 LLM입니다.",
    "사용자는 완성된 의제를 제출하는 것이 아니라 편하게 고민을 말합니다.",
    "답변은 자연스럽고 짧게, 사용자의 최근 발화를 구체적으로 반영하세요.",
    "주제가 넓으면 토론 가능한 좁은 질문 후보를 제안하세요.",
    "사용자가 명시적으로 시작하기 전에는 서브 에이전트 호출이나 토론 시작을 선언하지 마세요.",
    "사용자의 최신 발화가 정정, 불만, 질문이면 의제 입력으로 오해하지 말고 먼저 그 의도에 답하세요.",
    "이미 받은 대화가 있는데 '사전 대화가 보이지 않는다'고 말하지 마세요.",
    "반드시 JSON 객체 하나만 출력하세요.",
  ].join("\n");
}

function detectAgendaDecisionTrack(topic = "", messages = []) {
  const text = normalizeText([
    topic,
    ...(Array.isArray(messages) ? messages.map((message) => message.content) : []),
  ].join("\n"));
  if (/(고객\s*\/\s*시장|고객,\s*시장|포지셔닝|누구에게\s*팔|후보\s*고객군|초기\s*고객)/i.test(text)) return "customer";
  if (/(MVP|기능\s*우선순위|첫\s*버전|무엇부터\s*만들)/i.test(text)) return "mvp";
  if (/(아이디어\s*검증|사업\s*아이디어\s*검증)/i.test(text)) return "idea";
  if (/(가격|수익모델|과금)/i.test(text)) return "pricing";
  if (/(마케팅|첫\s*고객|고객\s*확보|세일즈)/i.test(text)) return "growth";
  if (/(실행|운영|예산|외주|직접)/i.test(text)) return "execution";
  if (/(피벗|중단|계속할지|확장)/i.test(text)) return "pivot";
  return "";
}

function agendaDecisionTrackInstruction(track) {
  const instructions = {
    customer: {
      label: "고객 / 시장",
      rule:
        "사용자가 말하는 대상은 팔 대상, 구매자, 사용자, 시장 세그먼트입니다. 대학생/대학원생 같은 후보가 나오면 누가 더 절박한 문제를 갖고, 누가 돈을 내며, 누가 접근 가능한지 비교해야 합니다.",
      question: "대학생과 대학원생 중 누가 직접 돈을 내고, 누가 더 당장 강의를 필요로 하나요?",
      refinement: "대학생과 대학원생 중 누가 직접 돈을 내고, 누가 더 당장 강의를 필요로 하는지",
    },
    mvp: {
      label: "MVP / 기능",
      rule: "사용자가 말하는 내용은 만들 기능과 제외할 기능의 범위입니다. 핵심 가치, 수동 검증 가능성, 첫 고객 경험을 기준으로 좁히세요.",
      question: "이 기능 중 고객이 처음 5분 안에 가치를 느끼게 만드는 것은 무엇인가요?",
    },
    idea: {
      label: "아이디어 검증",
      rule: "사용자가 말하는 내용은 아이디어의 고객 문제, 지불 의사, 검증 방법입니다. 매력 평가보다 작게 확인할 가정을 좁히세요.",
      question: "이 아이디어에서 가장 먼저 확인해야 할 고객 문제는 무엇인가요?",
    },
    pricing: {
      label: "가격 / 수익모델",
      rule: "사용자가 말하는 내용은 가격, 과금 시점, 무료/유료 구조입니다. 고객 저항과 가치 인식 시점을 기준으로 좁히세요.",
      question: "고객이 돈을 내도 된다고 느끼는 순간은 언제인가요?",
    },
    growth: {
      label: "마케팅 / 첫 고객",
      rule: "사용자가 말하는 내용은 첫 고객을 만날 채널과 메시지입니다. 접근 가능성과 빠른 피드백을 기준으로 좁히세요.",
      question: "이번 주에 실제로 만날 수 있는 고객 채널은 어디인가요?",
    },
    execution: {
      label: "실행 / 운영",
      rule: "사용자가 말하는 내용은 시간, 예산, 팀, 운영 부담입니다. 무엇을 직접 하고 무엇을 미룰지 기준으로 좁히세요.",
      question: "지금 가장 부족한 자원은 시간, 돈, 사람 중 무엇인가요?",
    },
    pivot: {
      label: "피벗 / 중단",
      rule: "사용자가 말하는 내용은 계속할지 바꿀지 판단할 신호입니다. 지표, 반응, 중단 기준을 기준으로 좁히세요.",
      question: "어떤 신호가 나오면 계속하고, 어떤 신호가 나오면 방향을 바꾸나요?",
    },
  };
  return instructions[track] || null;
}

function normalizeAgendaState(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const track = normalizeAgendaTrack(source.track || source.decisionTrack || source.selectedDecisionTrack);
  const memory = source.memory && typeof source.memory === "object" ? source.memory : {};
  const readiness = source.readiness && typeof source.readiness === "object" ? source.readiness : null;
  return {
    version: 1,
    track,
    trackLabel: clip(normalizeText(source.trackLabel), 40),
    turnIntent: clip(normalizeText(source.turnIntent), 40),
    readiness,
    memory,
  };
}

function normalizeAgendaTrack(value) {
  const raw = normalizeText(value);
  const lower = raw.toLowerCase();
  if (!raw) return "";
  if (lower === "customer" || /고객\s*\/\s*시장|고객,\s*시장|포지셔닝/.test(raw)) return "customer";
  if (lower === "mvp" || /mvp|기능\s*우선순위|제품\s*방향/.test(raw)) return "mvp";
  if (lower === "idea" || /아이디어\s*검증|사업\s*아이디어/.test(raw)) return "idea";
  if (lower === "pricing" || /가격|수익모델|과금/.test(raw)) return "pricing";
  if (lower === "growth" || /마케팅|첫\s*고객|세일즈|고객\s*확보/.test(raw)) return "growth";
  if (lower === "execution" || /실행|운영|예산|팀/.test(raw)) return "execution";
  if (lower === "pivot" || /피벗|중단|확장/.test(raw)) return "pivot";
  return "";
}

function buildAgendaState({ topic, messages, providedState = {} }) {
  const normalized = normalizeAgendaState(providedState);
  const track = normalized.track || detectAgendaDecisionTrack(topic, messages);
  const trackInstruction = agendaDecisionTrackInstruction(track);
  const userMessages = Array.isArray(messages) ? messages.filter((message) => message.role === "user") : [];
  const latestUser = stripAgendaTrackMarker(userMessages[userMessages.length - 1]?.content || topic);
  const turnIntent = detectAgendaTurnIntent(latestUser);
  const memory = buildAgendaMemory({ topic, messages, track, trackInstruction });
  const readiness = estimateAgendaReadiness({ track, memory, userMessages, turnIntent });
  return {
    version: 1,
    track,
    trackLabel: trackInstruction?.label || normalized.trackLabel || "",
    turnIntent,
    readiness,
    memory,
    lastUser: clip(latestUser, 240),
  };
}

function stripAgendaTrackMarker(text) {
  return normalizeText(text).replace(/^\[방향:\s*[^\]]+\]\s*/u, "").trim();
}

function detectAgendaTurnIntent(text) {
  const value = normalizeText(text);
  const command = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!value) return "agenda_detail";
  if ([
    "시작",
    "바로 시작",
    "토론 시작",
    "이제 시작",
    "이제 토론 시작",
    "토론 시작해",
    "토론 시작하자",
    "시작해",
    "시작하자",
    "start",
    "go",
  ].includes(command)) return "start_request";
  if (isAgendaCorrectionOrComplaint(value)) return "correction";
  if (isAgendaUnderstandingCheck(value)) return "understanding_check";
  if (/(어떻게|어떤식|어떤\s*식|예시|답변|뭘\s*말|무엇을\s*말|뭘\s*알려|어떤\s*정보)/.test(value)) return "answer_guidance";
  if (/(말고|아니라).{0,20}(쪽|방향|관점)|방향을\s*바꾸|다른\s*주제/.test(value)) return "direction_change";
  if (/^(그래|응|좋아|맞아|그렇게|ㅇㅇ|네|어|좋습니다)[.!?\s]*$/i.test(value)) return "ack";
  return "agenda_detail";
}

function isAgendaCorrectionOrComplaint(text) {
  const value = normalizeText(text);
  return [
    /왜\s*(이런|그런)\s*식/,
    /왜\s*이렇게\s*답/,
    /이런\s*식으로\s*답변/,
    /답변이\s*(이상|엉뚱|잘못|틀렸)/,
    /그게\s*(아니|아닌데)/,
    /내가\s*(물은|말한|얘기한)\s*건\s*(그게\s*)?아니/,
    /내가\s*어떤\s*사람.*(물었|말했)/,
    /무슨\s*소리/,
    /헛소리/,
    /말을?\s*못\s*알아/,
  ].some((pattern) => pattern.test(value));
}

function buildAgendaMemory({ topic, messages, track, trackInstruction }) {
  const userTexts = (Array.isArray(messages) ? messages : [])
    .filter((message) => message.role === "user")
    .map((message) => stripAgendaTrackMarker(message.content))
    .filter(Boolean);
  const substantive = userTexts.filter((text) => isSubstantiveAgendaText(text));
  const userContentText = substantive.join("\n");
  const fullText = [topic, userContentText].filter(Boolean).join("\n");
  const latestSubstantive = [...substantive].reverse().find((text) => !isAgendaCorrectionOrComplaint(text)) || topic;
  const candidates = extractAgendaCandidates(userContentText || fullText, track);
  const product = extractAgendaProduct(userContentText || fullText, track);
  const criteria = extractAgendaCriteria(fullText, track);
  const facts = extractAgendaFacts(substantive);
  const debateQuestion = buildAgendaDebateQuestion({
    topic,
    track,
    candidates,
    product,
    context: fullText,
  });

  return {
    selectedDirection: trackInstruction?.label || "",
    userQuestion: clip(latestSubstantive, 260),
    debateQuestion: clip(debateQuestion, 280),
    product: clip(product, 80),
    candidates,
    criteria,
    facts,
    corrections: userTexts.filter(isAgendaCorrectionOrComplaint).slice(-2).map((text) => clip(text, 160)),
    nextQuestion: trackInstruction?.question || "이 선택에서 가장 먼저 비교하고 싶은 기준은 무엇인가요?",
  };
}

function isSubstantiveAgendaText(text) {
  const value = normalizeText(text);
  if (!value) return false;
  if (isAgendaCorrectionOrComplaint(value)) return false;
  if (detectAgendaTurnIntent(value) === "answer_guidance") return false;
  if (/^(그래|응|좋아|맞아|그렇게|ㅇㅇ|네|어|좋습니다)[.!?\s]*$/i.test(value)) return false;
  if (/^(사업\s*아이디어\s*검증|MVP와\s*기능\s*우선순위|고객,\s*시장,\s*포지셔닝|가격과\s*수익모델|마케팅과\s*첫\s*고객\s*확보|실행과\s*운영\s*판단|피벗,\s*중단,\s*확장\s*판단)$/i.test(value)) return false;
  return true;
}

function extractAgendaCandidates(text, track) {
  if (track !== "customer") return [];
  const known = [
    ["대학생", "대학생"],
    ["학부생", "대학생"],
    ["대학원생", "대학원생"],
    ["석사", "대학원생"],
    ["박사", "대학원생"],
    ["직장인", "직장인"],
    ["현업자", "현업자"],
    ["비전공자", "비전공자"],
    ["전공자", "전공자"],
    ["초보자", "초보자"],
    ["창업자", "창업자"],
    ["소상공인", "소상공인"],
    ["자영업자", "자영업자"],
    ["기업", "기업"],
    ["B2B", "B2B"],
    ["B2C", "B2C"],
  ];
  const found = [];
  for (const [word, canonical] of known) {
    if (new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text) && !found.includes(canonical)) {
      found.push(canonical);
    }
  }
  return found.slice(0, 6);
}

function extractAgendaProduct(text, track) {
  if (track !== "customer" && !/팔|판매|강의|서비스|제품|앱|툴|플랫폼|교육|코스/.test(text)) return "";
  const match = normalizeText(text).match(/([가-힣A-Za-z0-9 ]{2,45}?(?:강의|서비스|제품|앱|툴|플랫폼|프로그램|교육|코스))(?:를|을|은|는|이|가|\s|$)/);
  if (!match) return "";
  return match[1]
    .replace(/^(내가|나는|제가|저는|지금|현재)\s*/g, "")
    .trim();
}

function extractAgendaCriteria(text, track) {
  const criteria = [];
  const add = (keyword, label) => {
    if (keyword.test(text) && !criteria.includes(label)) criteria.push(label);
  };
  if (track === "customer") {
    add(/돈|가격|지불|구매|결제|팔|판매/, "지불 의사");
    add(/필요|절박|문제|고통|수요/, "문제 절박도");
    add(/접근|채널|만날|도달|광고|커뮤니티/, "접근 가능성");
    add(/시장|규모|경쟁|차별/, "시장성");
    add(/대학생|대학원생|학부생|석사|박사/, "고객군 비교");
  }
  add(/시간|비용|예산|리소스/, "자원 제약");
  add(/검증|실험|인터뷰|랜딩|수동/, "검증 방법");
  return criteria.slice(0, 6);
}

function extractAgendaFacts(messages) {
  return messages
    .filter((text) => /(가정|둘\s*다|출신|현재|지금|아직|이미|시간|예산|가격|강의|팔|판매|고객|시장|필요)/.test(text))
    .slice(-5)
    .map((text) => clip(text, 180));
}

function buildAgendaDebateQuestion({ topic, track, candidates, product, context }) {
  if (track === "customer") {
    if (candidates.length >= 2 && product) {
      return `${product}를 ${formatKoreanChoiceList(candidates.slice(0, 2))} 중 누구에게 먼저 팔아야 하는가?`;
    }
    if (candidates.length >= 2) {
      return `${formatKoreanChoiceList(candidates.slice(0, 2))} 중 누구를 초기 고객으로 잡아야 하는가?`;
    }
    if (product) {
      return `${product}의 초기 고객을 누구로 잡아야 가장 빠르게 지불 의사를 검증할 수 있는가?`;
    }
  }
  return suggestNarrowDebateFrames(topic, context).recommended;
}

function formatKoreanChoiceList(items) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] || "";
  return `${values.slice(0, -1).join(", ")}과 ${values[values.length - 1]}`;
}

function estimateAgendaReadiness({ track, memory, userMessages, turnIntent }) {
  const substantiveCount = userMessages
    .map((message) => stripAgendaTrackMarker(message.content))
    .filter(isSubstantiveAgendaText)
    .length;
  let ready = substantiveCount >= 2;
  const reasons = [];

  if (track === "customer") {
    const hasCustomerChoice = memory.candidates.length >= 2 || /누구에게|고객|시장|팔|판매|타깃|타겟/.test(memory.userQuestion);
    const hasProductOrQuestion = Boolean(memory.product) || /강의|서비스|제품|앱|툴|플랫폼|교육|코스/.test(memory.userQuestion);
    ready = hasCustomerChoice && hasProductOrQuestion;
    if (!memory.candidates.length) reasons.push("고객 후보가 아직 충분히 나오지 않았습니다.");
    if (!hasProductOrQuestion) reasons.push("무엇을 팔거나 검증할지 아직 불분명합니다.");
  }

  if (track && memory.debateQuestion && substantiveCount >= 1 && turnIntent !== "answer_guidance") {
    ready = ready || (track !== "customer" && substantiveCount >= 1);
  }

  return {
    ready: Boolean(ready),
    reasons: reasons.slice(0, 3),
  };
}

function renderAgendaTranscript(messages) {
  return messages
    .map((message) => `${message.role === "main" ? "Main Agent" : "사용자"}: ${message.content}`)
    .join("\n");
}

function normalizeAgendaResult(text, { topic, messages, agendaState, source }) {
  const cleaned = cleanAssistantText(text);
  const parsed = parseJsonFromOutput(cleaned);
  const state = agendaState || buildAgendaState({ topic, messages });
  const fallback = buildMockAgendaTurn({ topic, messages, agendaState: state, source });
  const latestUser = latestAgendaUserText(messages, topic);
  const understandingCheck = isAgendaUnderstandingCheck(latestUser);
  if (!parsed) {
    const safePlainReply = !isBadAgendaReply(cleaned, topic, messages)
      && !agendaReplyIgnoresUnderstandingCheck(cleaned, understandingCheck)
      && !agendaReplyIgnoresTurnIntent(cleaned, state)
      && looksLikeUsefulAgendaReply(cleaned)
      ? cleaned
      : fallback.reply;
    return {
      ...fallback,
      reply: safePlainReply,
      agendaState: state,
      source,
      repaired: true,
    };
  }

  const reply = clip(normalizeText(parsed.reply), 1800);
  const safeReply = !isBadAgendaReply(reply, topic, messages)
    && !agendaReplyIgnoresUnderstandingCheck(reply, understandingCheck)
    && !agendaReplyIgnoresTurnIntent(reply, state)
    && looksLikeUsefulAgendaReply(reply)
    ? reply
    : fallback.reply;
  const topicDraft = clip(
    normalizeText(parsed.topicDraft || parsed.narrowedTopic || parsed.debateTopic || parsed.topic) || fallback.topicDraft || state.memory?.debateQuestion || topic,
    280,
  );
  const structurallyReady = Boolean(state.readiness?.ready);
  return {
    reply: safeReply,
    ready: Boolean(parsed.ready || fallback.ready) && structurallyReady,
    topicDraft,
    summary: clip(normalizeText(parsed.summary) || fallback.summary, 1200),
    missing: normalizeStringList(parsed.missing).slice(0, 5),
    agendaState: {
      ...state,
      nextAction: clip(normalizeText(parsed.nextAction), 40),
    },
    source,
    repaired: safeReply !== reply,
  };
}

function isBadAgendaReply(text, topic = "", messages = []) {
  const value = normalizeText(text);
  if (!value) return true;
  if (agendaReplyForgetsConversation(value)) return true;
  if (agendaReplyAsksForKnownContext(value, topic, messages)) return true;
  if (agendaReplyMissesTopic(value, topic, messages)) return true;
  if (agendaReplyLeavesDecisionTrack(value, topic, messages)) return true;
  return [
    /사전\s*대화\s*내용을\s*보내주시면/,
    /사전\s*대화\s*내용을\s*붙여\s*주세요/,
    /의제와\s*상황\s*설명을\s*보내주세요/,
    /본인의\s*입장,\s*상대\s*입장/,
    /핵심\s*쟁점,\s*상대\s*입장/,
    /상대\s*입장,\s*확인이\s*필요한\s*사실/,
    /토론\s*주제,\s*배경,\s*원하는\s*결론/,
    /Main Agent/i,
    /지정된\s*토론\s*역할/,
    /토론\s*제품의\s*Main/i,
    /역할과\s*출력\s*형식/,
    /응답하겠습니다/,
    /답변하겠습니다/,
    /확인했습니다/,
    /알겠습니다/,
    /지시에\s*따라/,
  ].some((pattern) => pattern.test(value));
}

function agendaReplyLeavesDecisionTrack(value, topic, messages) {
  const track = detectAgendaDecisionTrack(topic, messages);
  if (!track) return false;

  if (track === "customer") {
    const asksPersonalCategory = /(진로|일|공부|인간관계|건강|습관|감정\s*문제|가장\s*가까운\s*쪽|머릿속에\s*맴도는\s*고민)/.test(value);
    const mentionsBusinessCustomer = /(고객|시장|구매자|사용자|수강생|대학생|대학원생|세그먼트|타깃|지불|강의|팔|판매|포지셔닝)/.test(value);
    if (asksPersonalCategory && !mentionsBusinessCustomer) return true;
    if (asksPersonalCategory && !/(대학생|대학원생|강의|수강생|고객|시장|지불|구매)/.test(value)) return true;
  }

  return false;
}

function latestAgendaUserText(messages, topic = "") {
  const userMessages = Array.isArray(messages) ? messages.filter((message) => message.role === "user") : [];
  return userMessages[userMessages.length - 1]?.content || topic || "";
}

function isAgendaUnderstandingCheck(text) {
  const value = normalizeText(text);
  if (!value) return false;
  return [
    /내\s*(고민|상황|말|얘기|질문|맥락).{0,30}(이해|알|파악|기억)/,
    /(고민|상황|말|얘기|질문|맥락).{0,20}(말했|설명했|적었).{0,30}(이해|알|파악|기억)/,
    /이해는?\s*하고\s*있/,
    /이해했(어|냐|나|는지)/,
    /내가\s*(뭘|뭐를|무엇을|뭐라고).{0,20}(말했|물었|썼)/,
    /뭘\s*말했는지.{0,20}(알|기억|이해)/,
    /듣고\s*있(어|냐|니|는거|는\s*거)/,
    /말귀를?\s*못\s*알아/,
  ].some((pattern) => pattern.test(value));
}

function agendaReplyIgnoresUnderstandingCheck(text, understandingCheck) {
  if (!understandingCheck) return false;
  const value = normalizeText(text);
  const acknowledges = /(미안|죄송|맞아요|제가\s*(이해한|들은|잡은|놓친)|지금까지\s*(이해|들은|파악)|말씀하신|말해준|말한\s*건)/.test(value);
  if (acknowledges) return false;
  return /(토론\s*주제|주제를\s*좁히|가장\s*답이\s*안\s*나는\s*선택|어디가\s*가장\s*가깝|구체적인\s*상황|고민이\s*무엇인가요)/.test(value);
}

function agendaReplyIgnoresTurnIntent(text, agendaState) {
  const value = normalizeText(text);
  if (!agendaState?.turnIntent || !value) return false;

  if (agendaState.turnIntent === "correction" || agendaState.turnIntent === "understanding_check") {
    const acknowledges = /(맞아요|미안|죄송|방금|제가\s*(잘못|놓쳤|오해|잘못\s*잡)|말씀하신|물으신|정확히는|다시\s*잡)/.test(value);
    if (!acknowledges) return true;
    const asksFreshGenericQuestion = /(요즘\s*가장\s*자주|진로|인간관계|건강|감정\s*문제|고민이\s*무엇인가요|어디가\s*가장\s*가깝)/.test(value);
    if (asksFreshGenericQuestion) return true;
  }

  if (agendaState.track === "customer") {
    const mentionsCustomerContext = /(고객|시장|구매|지불|팔|판매|수강생|대학생|대학원생|세그먼트|타깃|타겟|강의)/.test(value);
    if (!mentionsCustomerContext && /(개인|진로|공부|일|인간관계|감정|건강)/.test(value)) return true;
  }

  return false;
}

function agendaReplyForgetsConversation(value) {
  return [
    /사전\s*대화.{0,20}(보이지|없|안\s*보|붙여|보내|주세요)/,
    /대화\s*내용.{0,20}(보이지|없|안\s*보|붙여|보내|주세요)/,
    /아직\s*보이지\s*않/,
    /아직\s*보이지\s*않습니다/,
    /의제와\s*현재\s*상황을\s*그대로\s*보내/,
    /의제와\s*상황\s*설명을\s*보내/,
    /토론\s*주제,\s*본인의\s*입장/,
    /본인의\s*입장,\s*상대\s*입장/,
    /핵심\s*쟁점,\s*상대\s*입장/,
  ].some((pattern) => pattern.test(value));
}

function agendaReplyAsksForKnownContext(value, topic, messages) {
  if (agendaReplyMentionsAnyUserContext(value, topic, messages)) return false;
  const genericContextAsk = /(의제|주제|상황|배경|쟁점|결론|입장|사전\s*대화|대화\s*내용)/.test(value)
    && /(보내|붙여|적어|말해|주세요|주시면|정리해드리)/.test(value);
  return genericContextAsk;
}

function agendaReplyMentionsAnyUserContext(value, topic, messages) {
  const userTexts = Array.isArray(messages)
    ? messages.filter((message) => message.role === "user").map((message) => message.content)
    : [];
  return [topic, ...userTexts].some((text) => agendaReplyMentionsTopic(value, text));
}

function agendaReplyMissesTopic(value, topic, messages) {
  const userTurns = Array.isArray(messages) ? messages.filter((message) => message.role === "user").length : 0;
  if (userTurns > 1) return false;
  if (agendaReplyMentionsTopic(value, topic)) return false;
  return /(의제|토론|상황|쟁점|결론|배경|입장|사전\s*대화)/.test(value)
    && /(보내|붙여|적어|주세요|주시면|정리)/.test(value);
}

function agendaReplyMentionsTopic(value, topic) {
  const stopwords = new Set(["내가", "지금", "현재", "이런", "그런", "저런", "해야", "할까", "맞는지", "필요", "필요한가", "같아서", "있는지", "없는지"]);
  const words = normalizeText(topic)
    .replace(/[?？!！.,]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !stopwords.has(word));
  if (!words.length) return true;
  return words.some((word) => value.includes(word));
}

function looksLikeUsefulAgendaReply(text) {
  const value = normalizeText(text);
  if (value.length < 20) return false;
  return /[가-힣]/.test(value);
}

function buildMockAgendaTurn({ topic, messages, agendaState, source }) {
  const state = agendaState || buildAgendaState({ topic, messages });
  return buildStatefulAgendaTurn({ topic, messages, agendaState: state, source });
}

function buildStatefulAgendaTurn({ topic, messages, agendaState, source }) {
  const state = agendaState || buildAgendaState({ topic, messages });
  const userMessages = messages.filter((message) => message.role === "user");
  const summary = summarizeAgendaMessages(topic, userMessages);

  if (state.turnIntent === "correction" || state.turnIntent === "understanding_check") {
    return buildAgendaCorrectionTurn({ topic, agendaState: state, summary, source });
  }

  if (state.turnIntent === "answer_guidance") {
    return buildStatefulHowToAnswerAgendaTurn({ topic, agendaState: state, summary, source });
  }

  if (state.turnIntent === "start_request") {
    return buildAgendaStartRequestTurn({ topic, agendaState: state, summary, source });
  }

  if (state.track === "customer") {
    return buildCustomerAgendaTurn({ topic, agendaState: state, summary, source });
  }

  return buildGenericStatefulAgendaTurn({ topic, messages, agendaState: state, summary, source });
}

function buildAgendaCorrectionTurn({ topic, agendaState, summary, source }) {
  const memory = agendaState.memory || {};
  const contextLine = describeAgendaMemory(memory, topic);
  const readyLine = agendaState.readiness?.ready
    ? `이 정도면 토론 질문은 “${memory.debateQuestion || topic}”로 잡을 수 있습니다. 바로 토론을 시작해도 되고, 더 좁히려면 ${memory.nextQuestion}`
    : `제가 다시 이 기준으로 잡겠습니다. ${memory.nextQuestion || "지금 비교하려는 선택지를 한 문장으로만 더 말해주세요."}`;

  return {
    reply: [
      "맞아요. 방금 흐름은 제가 의도를 잘못 잡은 겁니다.",
      contextLine,
      "",
      readyLine,
    ].join("\n"),
    ready: Boolean(agendaState.readiness?.ready),
    topicDraft: memory.debateQuestion || topic,
    summary,
    missing: agendaState.readiness?.ready ? [] : ["비교할 대상", "판단 기준"],
    agendaState,
    source,
  };
}

function buildStatefulHowToAnswerAgendaTurn({ topic, agendaState, summary, source }) {
  const memory = agendaState.memory || {};
  const trackLabel = agendaState.trackLabel || memory.selectedDirection;
  const businessLike = Boolean(agendaState.track);
  const example = agendaState.track === "customer"
    ? `"${memory.product || "이 강의/제품"}를 ${memory.candidates?.length ? formatKoreanChoiceList(memory.candidates.slice(0, 2)) : "두 후보 고객"} 중 누구에게 먼저 팔지 고민 중이다. 둘 다 어떤 배경을 갖고 있고, 누가 돈을 낼지와 어디서 만날 수 있을지가 아직 불확실하다."`
    : buildAgendaAnswerExample(topic);

  return {
    reply: businessLike
      ? [
        `좋아요. ${trackLabel ? `${trackLabel} 방향에서는` : "사업 판단에서는"} 이렇게 답해주면 됩니다.`,
        "",
        "- 무엇을 팔거나 검증하려는지",
        "- 후보 고객/선택지가 무엇인지",
        "- 이미 알고 있는 가정이나 조건",
        "- 제일 헷갈리는 비교 기준",
        "",
        `예를 들면 이렇게요.\n${example}`,
      ].join("\n")
      : buildHowToAnswerAgendaTurn({ topic, summary, source }).reply,
    ready: false,
    topicDraft: memory.debateQuestion || topic,
    summary,
    missing: ["팔 대상/선택지", "이미 아는 조건", "헷갈리는 기준"],
    agendaState,
    source,
  };
}

function buildAgendaStartRequestTurn({ topic, agendaState, summary, source }) {
  const memory = agendaState.memory || {};
  if (!agendaState.readiness?.ready) {
    return {
      reply: `바로 시작하기 전에 하나만 더 잡으면 좋겠습니다. ${memory.nextQuestion || "비교하려는 선택지를 한 문장으로만 더 말해주세요."}`,
      ready: false,
      topicDraft: memory.debateQuestion || topic,
      summary,
      missing: ["토론 질문 확정"],
      agendaState,
      source,
    };
  }

  return {
    reply: `좋아요. “${memory.debateQuestion || topic}”로 토론을 시작할 수 있습니다. 시작 버튼을 누르면 이 주제에 맞춰 서브 에이전트 역할을 배정하겠습니다.`,
    ready: true,
    topicDraft: memory.debateQuestion || topic,
    summary,
    missing: [],
    agendaState,
    source,
  };
}

function buildCustomerAgendaTurn({ topic, agendaState, summary, source }) {
  const memory = agendaState.memory || {};
  if (!memory.candidates?.length) {
    return {
      reply: "좋아요. 고객/시장 방향으로 보겠습니다. 후보 고객군을 그대로 적어주세요. 예를 들면 대학생, 대학원생, 직장인처럼 비교하고 싶은 대상을 나열하면 됩니다.",
      ready: false,
      topicDraft: memory.debateQuestion || topic,
      summary,
      missing: ["후보 고객군"],
      agendaState,
      source,
    };
  }

  if (!agendaState.readiness?.ready) {
    return {
      reply: [
        `좋아요. 지금은 ${formatKoreanChoiceList(memory.candidates)} 쪽을 고객 후보로 보고 있습니다.`,
        memory.product ? `팔려는 대상은 ${memory.product}로 이해했어요.` : "",
        "",
        memory.nextQuestion,
      ].filter(Boolean).join("\n"),
      ready: false,
      topicDraft: memory.debateQuestion || topic,
      summary,
      missing: ["무엇을 팔지", "지불 의사"],
      agendaState,
      source,
    };
  }

  return {
    reply: [
      `좋아요. 이건 고객/시장 선택 문제로 잡겠습니다. ${describeAgendaMemory(memory, topic)}`,
      "",
      `토론 질문은 “${memory.debateQuestion}”가 가장 선명합니다.`,
      "바로 토론을 시작해도 되고, 하나만 더 좁히려면 실제 결제자가 누구인지부터 확인하면 됩니다.",
    ].join("\n"),
    ready: true,
    topicDraft: memory.debateQuestion || topic,
    summary,
    missing: [],
    agendaState,
    source,
  };
}

function buildGenericStatefulAgendaTurn({ topic, messages, agendaState, summary, source }) {
  const userMessages = messages.filter((message) => message.role === "user");
  const lastUser = userMessages[userMessages.length - 1]?.content || topic;
  const narrowed = suggestNarrowDebateFrames(topic, userMessages.map((message) => message.content).join("\n"));
  const ready = Boolean(agendaState.readiness?.ready);

  if (agendaState.turnIntent === "ack" && ready) {
    return {
      reply: `좋아요. 그럼 토론 질문은 “${agendaState.memory?.debateQuestion || narrowed.recommended}”로 잡겠습니다. 시작 버튼을 누르면 이 질문에 맞춰 서브 에이전트 역할을 배정하겠습니다.`,
      ready: true,
      topicDraft: agendaState.memory?.debateQuestion || narrowed.recommended,
      summary,
      missing: [],
      agendaState,
      source,
    };
  }

  return buildConversationalAgendaTurn({ topic, userMessages, lastUser, summary, source });
}

function describeAgendaMemory(memory, topic) {
  const pieces = [];
  if (memory.product) pieces.push(`팔려는 것은 ${memory.product}`);
  if (memory.candidates?.length) pieces.push(`비교 대상은 ${formatKoreanChoiceList(memory.candidates)}`);
  if (memory.facts?.length) pieces.push(`조건은 ${memory.facts.slice(-1)[0]}`);
  if (!pieces.length) return `제가 지금 잡은 핵심은 “${memory.userQuestion || topic}”입니다.`;
  return `제가 지금 잡은 핵심은 ${pieces.join(", ")}라는 점입니다.`;
}

function buildUnderstandingCheckAgendaTurn({ topic, userMessages, summary, source }) {
  const substantiveMessages = userMessages.filter((message) => !isAgendaUnderstandingCheck(message.content));
  const context = substantiveMessages.map((message) => message.content).join("\n");
  const narrowed = suggestNarrowDebateFrames(topic, context);
  const knownContext = substantiveMessages.length
    ? substantiveMessages.map((message, index) => `${index + 1}. ${message.content}`).join("\n")
    : `처음 잡힌 의제는 "${topic}"입니다. 아직 구체적인 상황은 충분히 받지 못했습니다.`;

  return {
    reply: [
      "맞아요. 방금 답변은 당신이 이미 말한 맥락을 제대로 붙잡지 못하고, 처음부터 다시 묻는 것처럼 들렸습니다.",
      "",
      "제가 지금 대화에서 잡고 있는 내용은 이 정도예요.",
      knownContext,
      "",
      `그래서 토론 질문은 일단 "${narrowed.recommended}" 쪽으로 좁힐 수 있습니다.`,
      "",
      "제가 놓친 핵심이 있다면 바로 잡고 싶습니다. 지금 고민의 중심은 선택 자체의 가치인가요, 아니면 당신 상황에서 그 선택을 해도 되는지인가요?",
    ].join("\n"),
    ready: substantiveMessages.length >= 2,
    topicDraft: narrowed.recommended,
    summary,
    missing: ["고민의 중심축", "개인 상황에서 가장 중요한 제약"],
    source,
  };
}

function buildHowToAnswerAgendaTurn({ topic, summary, source }) {
  const answerExample = buildAgendaAnswerExample(topic);
  const narrowed = suggestNarrowDebateFrames(topic, summary);
  return {
    reply: `좋아요. "${topic}"는 단순 찬반보다 당신의 현재 상황과 판단 기준을 알아야 깊게 다룰 수 있습니다.

이런 형식으로 답해주면 좋습니다.

- 현재 위치: 지금 어떤 단계에 있는지
- 원하는 결과: 합격, 커리어 전환, 안정성, 시간 확보 중 무엇이 큰지
- 제약: 시간, 비용, 체력, 일/학업, 대안 경로
- 두려운 점: 실패했을 때 잃는 것, 하지 않았을 때 후회할 것

예를 들면 이렇게 답할 수 있습니다.
"${answerExample}"

편한 만큼만 말해 주세요. 제가 그 답을 바탕으로 다시 좁혀 묻겠습니다.`,
    ready: false,
    topicDraft: narrowed.recommended,
    summary,
    missing: ["현재 위치", "원하는 결과", "현실 제약", "대안"],
    source,
  };
}

function buildConversationalAgendaTurn({ topic, userMessages, lastUser, summary, source }) {
  const userTurnCount = userMessages.length;
  const narrowed = suggestNarrowDebateFrames(topic, userMessages.map((message) => message.content).join("\n"));
  const latest = normalizeText(lastUser);
  const decisionTrack = detectAgendaDecisionTrack(topic, userMessages);
  const trackInstruction = agendaDecisionTrackInstruction(decisionTrack);
  const ready = userTurnCount >= 2;

  if (userTurnCount <= 1) {
    if (trackInstruction) {
      return {
        reply: [
          `좋아요. "${trackInstruction.label}" 방향이면 바로 넓게 묻기보다, 먼저 사업 판단에 맞게 질문을 좁히는 게 좋습니다.`,
          "",
          `지금 기준으로는 "${narrowed.recommended}" 쪽이 가장 토론하기 좋습니다.`,
          narrowed.reason ? `이렇게 잡으면 ${narrowed.reason}` : "",
          "",
          trackInstruction.question,
        ].filter(Boolean).join("\n"),
        ready: false,
        topicDraft: narrowed.recommended,
        summary: buildConversationalAgendaSummary(topic, userMessages, narrowed),
        missing: ["구체 고객 후보", "검증 기준"],
        source,
      };
    }
    return {
      reply: [
        `좋아요. "${topic}"라고 하면 바로 찬반을 나누기보다, 먼저 토론할 질문을 조금 좁히는 게 좋아 보여요.`,
        "",
        `지금 기준으로는 "${narrowed.recommended}" 쪽이 가장 토론하기 좋습니다.`,
        narrowed.options.length > 1 ? `다른 방향으로는 ${narrowed.options.slice(1).map((option) => `"${option}"`).join(", ")}도 가능하고요.` : "",
        "",
        "이걸 당신 개인의 선택 문제로 볼까요, 아니면 AI 시대에 이 자격증 자체가 여전히 의미 있는지 보는 문제로 볼까요?",
      ].filter(Boolean).join("\n"),
      ready: false,
      topicDraft: narrowed.recommended,
      summary: buildConversationalAgendaSummary(topic, userMessages, narrowed),
      missing: ["개인 선택인지 일반 쟁점인지", "목표 직무나 사용 목적"],
      source,
    };
  }

  if (/(그래|응|좋아|맞아|그렇게|ㅇㅇ|네|어)/i.test(latest) && latest.length <= 20) {
    return {
      reply: [
        "좋아요. 그럼 지금 토론 주제는 이렇게 잡으면 자연스럽겠습니다.",
        "",
        `“${narrowed.recommended}”`,
        "",
        trackInstruction
          ? `이 방향으로 바로 토론을 시작해도 되고, 원하면 ${trackInstruction.refinement || trackInstruction.question}까지 한 번 더 좁힐 수 있어요.`
          : "이 방향으로 바로 토론을 시작해도 되고, 원하면 한 번 더 좁힐 수 있어요. 예를 들면 취업용인지, 이직용인지, 공부 방향 확인용인지에 따라 토론 역할이 달라집니다.",
      ].join("\n"),
      ready: true,
      topicDraft: narrowed.recommended,
      summary: buildConversationalAgendaSummary(topic, userMessages, narrowed),
      missing: [],
      source,
    };
  }

  return {
    reply: [
      `좋아요. 지금 말한 핵심은 “${clip(latest, 120)}” 쪽으로 이해했어요.`,
      "",
      `그럼 토론은 "${narrowed.recommended}"로 좁히면 훨씬 보기 좋겠습니다.`,
      narrowed.reason ? `이렇게 잡으면 ${narrowed.reason}` : "",
      "",
      ready
          ? trackInstruction
          ? `이제 이 질문으로 서브 에이전트 역할을 배정할 수 있습니다. 이 방향으로 토론을 열까요, 아니면 ${trackInstruction.refinement || trackInstruction.question}까지 한 번만 더 좁힐까요?`
          : "이제 이 질문으로 서브 에이전트 역할을 배정할 수 있습니다. 이 방향으로 토론을 열까요, 아니면 더 개인 상황 쪽으로 한 번만 더 좁힐까요?"
        : trackInstruction
          ? `이 주제로 에이전트들을 붙이면 선택한 사업 방향에 맞게 서로 다른 관점으로 볼 수 있어요. 이 방향으로 토론을 열까요, 아니면 ${trackInstruction.refinement || trackInstruction.question}까지 더 좁힐까요?`
          : "이 주제로 에이전트들을 붙이면 한쪽은 현실적인 효용을 보고, 한쪽은 대안 경로를 보고, 한쪽은 시간 대비 선택 기준을 볼 수 있어요. 이 방향으로 토론을 열까요, 아니면 더 개인 상황 쪽으로 좁힐까요?",
    ].filter(Boolean).join("\n"),
    ready,
    topicDraft: narrowed.recommended,
    summary: buildConversationalAgendaSummary(topic, userMessages, narrowed),
    missing: ready ? [] : ["토론 범위", "개인 상황 반영 정도"],
    source,
  };
}

function suggestNarrowDebateFrames(topic, context = "") {
  const text = `${topic}\n${context}`;
  const businessFrame = suggestBusinessDecisionFrame(text);
  if (businessFrame) return businessFrame;
  if (/(빅데이터|데이터|자격증|ADsP|ADP|SQL|시험)/i.test(text)) {
    const aiEra = /(AI|인공지능|시대|필요\s*없|쓸모|대체)/i.test(text);
    const recommended = aiEra
      ? "AI 시대에도 빅데이터 자격증이 취업이나 커리어 신호로 여전히 의미가 있는가, 아니면 같은 시간을 포트폴리오와 실무 프로젝트에 쓰는 게 나은가?"
      : "빅데이터 자격증 준비가 지금 목표에 실제로 도움이 되는가, 아니면 다른 학습/포트폴리오 경로가 더 효율적인가?";
    return {
      recommended,
      options: [
        recommended,
        "데이터 직무 취업에서 자격증과 포트폴리오 중 무엇이 더 강한 증거인가?",
        "초보자가 3개월을 쓴다면 시험 준비와 실무 프로젝트 중 어디에 배분해야 하는가?",
      ],
      reason: "자격증 자체의 찬반보다 시간 배분과 실제 신호 가치가 핵심 쟁점이 됩니다.",
    };
  }

  if (/(창업|사업|서비스|프로덕트|MVP|시장)/i.test(text)) {
    return {
      recommended: "이 아이디어를 지금 만들기 전에 어떤 최소 검증을 먼저 해야 하는가?",
      options: [
        "이 아이디어를 지금 만들기 전에 어떤 최소 검증을 먼저 해야 하는가?",
        "기능을 더 만드는 것과 고객 반응을 먼저 확인하는 것 중 무엇이 우선인가?",
        "한 달 안에 실패 여부를 판단할 기준은 무엇인가?",
      ],
      reason: "막연한 사업성보다 다음 행동과 실패 기준이 선명해집니다.",
    };
  }

  return {
    recommended: `${clip(topic, 80)}를 지금 결정할 때 가장 중요한 기준은 무엇인가?`,
    options: [
      `${clip(topic, 80)}를 지금 결정할 때 가장 중요한 기준은 무엇인가?`,
      "이 선택을 해야 하는 이유와 하지 말아야 하는 이유 중 어느 쪽이 더 강한가?",
      "같은 시간과 비용을 다른 대안에 쓰면 결과가 더 좋아질 가능성이 있는가?",
    ],
    reason: "넓은 고민을 실제로 토론 가능한 선택 기준으로 바꿀 수 있습니다.",
  };
}

function suggestBusinessDecisionFrame(text) {
  const includesAny = (words) => words.some((word) => text.includes(word));
  if (includesAny(["아이디어 검증", "사업 아이디어 검증"])) {
    return {
      recommended: "이 사업 아이디어가 실제 고객 문제를 충분히 해결하며 지금 검증할 가치가 있는가?",
      options: [
        "이 사업 아이디어가 실제 고객 문제를 충분히 해결하며 지금 검증할 가치가 있는가?",
        "고객이 이 문제를 돈이나 시간으로 해결하려 할 만큼 아파하는가?",
        "경쟁 제품이 있어도 들어갈 차별화 지점이 있는가?",
      ],
      reason: "아이디어의 매력보다 고객 고통, 지불 의사, 검증 순서가 핵심 쟁점이 됩니다.",
    };
  }
  if (includesAny(["MVP", "기능 우선순위", "제품 방향"])) {
    return {
      recommended: "첫 버전에서 어떤 기능을 반드시 만들고 무엇을 과감히 빼야 하는가?",
      options: [
        "첫 버전에서 어떤 기능을 반드시 만들고 무엇을 과감히 빼야 하는가?",
        "수동 운영으로 먼저 검증할 수 있는 기능과 반드시 자동화해야 하는 기능은 무엇인가?",
        "첫 고객이 가치를 느끼는 최소 경험은 어디까지인가?",
      ],
      reason: "만들 기능의 양보다 첫 검증에 필요한 최소 경험을 정하는 것이 중요합니다.",
    };
  }
  if (includesAny(["고객, 시장", "포지셔닝", "고객 / 시장", "시장"])) {
    return {
      recommended: "초기 고객을 누구로 잡아야 가장 빠르게 문제와 지불 의사를 검증할 수 있는가?",
      options: [
        "초기 고객을 누구로 잡아야 가장 빠르게 문제와 지불 의사를 검증할 수 있는가?",
        "B2B와 B2C 중 어느 쪽이 지금 더 빠른 검증 경로인가?",
        "경쟁 제품과 다르게 기억될 한 문장은 무엇이어야 하는가?",
      ],
      reason: "넓은 시장보다 처음 설득할 좁은 고객군이 논의를 선명하게 만듭니다.",
    };
  }
  if (includesAny(["가격", "수익모델", "과금"])) {
    return {
      recommended: "초기 제품에서 어떤 가격 구조와 과금 타이밍이 고객 저항과 수익성을 가장 잘 균형 잡는가?",
      options: [
        "초기 제품에서 어떤 가격 구조와 과금 타이밍이 고객 저항과 수익성을 가장 잘 균형 잡는가?",
        "무료 체험을 길게 줄지, 처음부터 작은 금액이라도 결제를 받을지?",
        "구독, 일회성, 사용량 기반 중 어떤 모델이 고객 가치와 맞는가?",
      ],
      reason: "가격은 숫자보다 고객이 가치를 인정하는 순간과 연결되어야 합니다.",
    };
  }
  if (includesAny(["마케팅", "첫 고객", "세일즈", "고객 확보"])) {
    return {
      recommended: "초기 고객을 얻기 위해 어떤 채널과 메시지를 먼저 시험해야 하는가?",
      options: [
        "초기 고객을 얻기 위해 어떤 채널과 메시지를 먼저 시험해야 하는가?",
        "콘텐츠, 커뮤니티, 광고, 콜드메일 중 무엇을 먼저 실험해야 하는가?",
        "첫 10명의 고객을 만들기 위한 가장 짧은 경로는 무엇인가?",
      ],
      reason: "막연한 마케팅보다 첫 고객을 만나는 채널과 메시지 실험이 중요합니다.",
    };
  }
  if (includesAny(["실행", "운영", "외주", "직접", "팀", "예산"])) {
    return {
      recommended: "지금 가진 시간, 돈, 인력 안에서 무엇을 직접 하고 무엇을 미뤄야 하는가?",
      options: [
        "지금 가진 시간, 돈, 인력 안에서 무엇을 직접 하고 무엇을 미뤄야 하는가?",
        "외주와 직접 개발 중 어떤 선택이 검증 속도와 품질을 더 잘 맞추는가?",
        "운영 부담과 법무/CS 리스크를 어느 시점부터 감당해야 하는가?",
      ],
      reason: "사업 판단은 아이디어보다 실행 자원의 제약에서 갈리는 경우가 많습니다.",
    };
  }
  if (includesAny(["피벗", "중단", "확장", "계속할지"])) {
    return {
      recommended: "현재 신호를 기준으로 계속 밀어붙일지, 방향을 바꿀지, 중단할지 어떻게 판단해야 하는가?",
      options: [
        "현재 신호를 기준으로 계속 밀어붙일지, 방향을 바꿀지, 중단할지 어떻게 판단해야 하는가?",
        "어떤 지표가 나오면 접고, 어떤 지표가 나오면 더 투자해야 하는가?",
        "고객군을 바꾸는 것과 기능을 줄이는 것 중 무엇이 먼저인가?",
      ],
      reason: "감정적인 지속 여부보다 관찰된 신호와 중단 기준이 핵심입니다.",
    };
  }
  return null;
}

function buildConversationalAgendaSummary(topic, userMessages, narrowed) {
  const userLines = userMessages
    .map((message, index) => `${index + 1}. ${message.content}`)
    .join("\n");
  return clip([
    `사용자가 처음 꺼낸 고민: ${topic}`,
    `메인이 추천한 토론 주제 초안: ${narrowed.recommended}`,
    userLines ? `사용자가 말한 맥락:\n${userLines}` : "",
  ].filter(Boolean).join("\n"), 1200);
}

function buildAgendaAnswerExample(topic) {
  const cleanTopic = clip(topic.replace(/[?？]+$/g, "").trim(), 80) || "이 사안";

  if (/(빅데이터|데이터|자격증|시험|합격|공부|SQL|ADsP|ADP|정보처리)/i.test(topic)) {
    return "나는 지금 비전공자이고 데이터 직무로 이직하고 싶다. 3개월 정도 공부할 수 있지만, 자격증이 취업에 실제로 도움이 되는지와 포트폴리오를 같이 준비해야 하는지가 고민이다. 비용과 시간은 부담되지만, 방향을 잘못 잡는 게 더 걱정된다.";
  }

  if (/(변호사|로스쿨|변시|법무|법률|사법)/i.test(topic)) {
    return "나는 지금 로스쿨 졸업을 앞두고 있고, 시험 준비에 1년을 더 쓸 수는 있지만 비용과 멘탈이 걱정된다. 변호사라는 직업 자체보다 법률 커리어의 안정성이 끌린다. 대안으로는 기업 법무나 다른 시험도 생각 중이다.";
  }

  if (/(창업|사업|서비스|프로덕트|제품|MVP|시장)/i.test(topic)) {
    return "나는 지금 이 아이디어를 작게 검증해보고 싶다. 만들 수는 있지만 실제 사용자가 돈이나 시간을 쓸 만큼 필요한지 확신이 없다. 한 달 안에 확인 가능한 기준과, 실패하면 접을 조건을 정하고 싶다.";
  }

  return `나는 지금 ${cleanTopic}를 고민 중이다. 원하는 결과는 아직 완전히 정리되지 않았고, 시간과 비용을 어디까지 쓸 수 있는지가 제약이다. 가장 걱정되는 건 잘못 선택해서 다른 기회를 놓치는 것이다.`;
}

function summarizeAgendaMessages(topic, userMessages) {
  const userLines = userMessages
    .map((message, index) => `${index + 1}. ${message.content}`)
    .join("\n");
  return clip([`의제: ${topic}`, userLines ? `사용자가 말한 맥락:\n${userLines}` : ""].filter(Boolean).join("\n"), 1200);
}

async function planDebateLiteRolesForAgenda({ topic, agenda, runtime }) {
  const contextText = [topic, agenda.topicDraft, agenda.summary, agenda.transcript].filter(Boolean).join("\n");
  const trackPlan = planAgendaTrackRoles(agenda);
  const fallback = trackPlan ? finalizeLiteRolePlan(trackPlan, "heuristic") : planDebateLiteRoles(contextText);
  if (runtime.provider === "mock") return fallback;

  try {
    const text = await runEngine(runtime.provider, buildRolePlannerPrompt({ topic, agenda }), {
      sessionId: `roles-${crypto.randomUUID()}`,
      roleId: "main",
      kind: "role-plan",
      runtime,
      timeoutMs: runtime.provider === "codex" ? Math.min(CODEX_TIMEOUT_MS, 90000) : AI_API_TIMEOUT_MS,
      instructions: rolePlannerSystemPrompt(),
      systemPrompt: rolePlannerSystemPrompt(),
      textFormat: runtime.provider === "openai" ? { type: "json_object" } : undefined,
    });
    return normalizeRolePlannerResult(text, fallback, runtime.provider);
  } catch (error) {
    return {
      ...fallback,
      source: "heuristic",
      plannerError: error instanceof Error ? trimForError(error.message) : trimForError(String(error)),
    };
  }
}

function planAgendaTrackRoles(agenda = {}) {
  const track = normalizeAgendaTrack(agenda.agendaState?.track);
  const memory = agenda.agendaState?.memory || {};
  const candidates = Array.isArray(memory.candidates) ? memory.candidates.filter(Boolean) : [];
  const product = clip(normalizeText(memory.product), 40) || "제품/서비스";
  const makePlan = (reason, roles) => ({
    reason,
    roles: roles.map((role, index) => ({
      id: `agent${index + 1}`,
      color: ["#8a6419", "#0b7d68", "#326d8f"][index],
      ...role,
    })),
  });

  if (track === "customer") {
    const first = candidates[0] || "첫 후보 고객";
    const second = candidates[1] || "다른 후보 고객";
    return makePlan("고객/시장 결정으로 보고 후보 고객군, 구매 가능성, 검증 실험을 나누어 봅니다.", [
      {
        name: `${first} 시장 옹호자`,
        purpose: `${product}를 ${first}에게 먼저 팔 때의 강점과 접근 경로를 주장합니다.`,
        lens: `${first}의 문제 절박도`,
      },
      {
        name: `${second} 시장 옹호자`,
        purpose: `${product}를 ${second}에게 먼저 팔 때의 강점과 구매 가능성을 주장합니다.`,
        lens: `${second}의 지불 의사`,
      },
      {
        name: "구매검증 설계자",
        purpose: "두 고객군 중 누가 실제로 돈과 시간을 쓸지 가장 작게 확인할 실험을 설계합니다.",
        lens: "검증 순서와 성공 기준",
      },
    ]);
  }

  if (track === "mvp") {
    return makePlan("MVP 범위 결정으로 보고 핵심 가치, 제거할 기능, 수동 검증을 나누어 봅니다.", [
      { name: "핵심가치 수호자", purpose: "첫 버전에서 반드시 살아야 할 고객 가치를 고릅니다.", lens: "필수 가치" },
      { name: "스코프 절단자", purpose: "지금 빼야 할 기능과 미뤄도 되는 기능을 분리합니다.", lens: "제외할 기능" },
      { name: "수동검증 설계자", purpose: "개발 전에 손으로 확인할 수 있는 흐름을 제안합니다.", lens: "검증 순서" },
    ]);
  }

  if (track === "pricing") {
    return makePlan("가격/수익모델 결정으로 보고 구매 저항, 수익성, 과금 타이밍을 나누어 봅니다.", [
      { name: "구매저항 분석가", purpose: "고객이 가격을 거절할 이유와 심리적 장벽을 봅니다.", lens: "가격 저항" },
      { name: "수익성 검토자", purpose: "가격 구조가 비용과 지속성에 맞는지 따집니다.", lens: "단위경제" },
      { name: "과금전략 설계자", purpose: "무료/유료 전환과 결제 시점을 제안합니다.", lens: "과금 타이밍" },
    ]);
  }

  if (track === "growth") {
    return makePlan("첫 고객 확보 문제로 보고 채널, 메시지, 실행 속도를 나누어 봅니다.", [
      { name: "채널 실험가", purpose: "가장 빨리 고객을 만날 채널을 고릅니다.", lens: "접근 가능성" },
      { name: "메시지 편집자", purpose: "고객이 반응할 문제 문장과 제안을 다듬습니다.", lens: "메시지" },
      { name: "세일즈 현실가", purpose: "첫 10명 확보를 위한 접촉 방식과 병목을 봅니다.", lens: "실행 가능성" },
    ]);
  }

  if (track === "execution") {
    return makePlan("실행/운영 판단으로 보고 자원 배분, 구현 방식, 운영 리스크를 나누어 봅니다.", [
      { name: "자원 배분자", purpose: "시간, 돈, 인력 중 가장 부족한 자원 기준으로 우선순위를 잡습니다.", lens: "제약" },
      { name: "빌드 전략가", purpose: "직접 개발, 외주, 노코드, 수동 운영 중 현실적인 길을 고릅니다.", lens: "구현 방식" },
      { name: "운영 리스크 관리자", purpose: "CS, 법무, 품질, 반복 운영 부담을 미리 드러냅니다.", lens: "운영 부담" },
    ]);
  }

  if (track === "pivot") {
    return makePlan("피벗/중단 판단으로 보고 신호 해석, 중단 기준, 방향 전환안을 나누어 봅니다.", [
      { name: "신호 판독자", purpose: "현재 고객 반응과 지표가 강한 신호인지 약한 신호인지 해석합니다.", lens: "신호 강도" },
      { name: "중단 기준 관리자", purpose: "언제 접고 언제 더 투자할지 기준을 정합니다.", lens: "중단선" },
      { name: "피벗 설계자", purpose: "고객군, 문제, 기능 중 무엇을 바꿀지 대안을 제안합니다.", lens: "전환 옵션" },
    ]);
  }

  return null;
}

function buildRolePlannerPrompt({ topic, agenda }) {
  return [
    "사용자가 메인 에이전트와 사전 대화를 마쳤습니다.",
    "이제 Main Agent의 판단 결과를 바탕으로 실제로 호출할 서브 에이전트 3명을 설계하고 역할을 배정하세요.",
    "역할은 서로 겹치지 않아야 하며, 사용자의 상황과 판단 기준에 맞아야 합니다.",
    "역할명은 짧은 한국어 명사구로 쓰고, Main Agent, 진행자, 사회자 같은 이름은 쓰지 마세요.",
    "각 역할은 토론에서 실제로 말할 관점이어야 하며, 각자 맡을 임무가 한 문장으로 분명해야 합니다.",
    "역할 구성은 비판/대안/정리처럼 기계적인 기본값보다, 사용자의 실제 고민에 맞춘 호출 계획이어야 합니다.",
    "반드시 JSON 객체 하나만 출력하세요.",
    '{"reason":"왜 이 역할 구성이 적절한지 한 문장","roles":[{"name":"역할명","purpose":"무엇을 검토할지","lens":"주요 관점","assignment":"이 에이전트에게 맡길 구체 임무 한 문장","callSignal":"왜 지금 이 에이전트를 호출하는지"}]}',
    "",
    `토론 의제: ${topic}`,
    agenda.topicDraft ? `메인이 좁힌 토론 질문: ${agenda.topicDraft}` : "",
    "",
    "메인 에이전트가 이해한 요약:",
    agenda.summary || "(요약 없음)",
    "",
    "메인 에이전트의 구조화된 의제 메모리:",
    agenda.agendaState?.memory ? JSON.stringify(agenda.agendaState.memory, null, 2) : "(메모리 없음)",
    "",
    "사용자가 사전 대화에서 직접 말한 내용:",
    agenda.transcript || renderAgendaTranscript(agenda.messages) || "(기록 없음)",
  ].join("\n");
}

function rolePlannerSystemPrompt() {
  return [
    "당신은 토론 제품의 메인 오케스트레이터입니다.",
    "사용자와의 사전 대화를 바탕으로 어떤 서브 에이전트를 호출할지 정하고, 각 에이전트의 임무를 배정합니다.",
    "역할은 구체적이고 서로 달라야 하며, 사용자의 실제 상황을 반영해야 합니다.",
    "역할 이름은 짧고 사람이 이해하기 쉬워야 합니다.",
    "출력은 JSON 객체 하나만 허용됩니다.",
  ].join("\n");
}

function normalizeRolePlannerResult(text, fallback, source) {
  const parsed = parseJsonFromOutput(cleanAssistantText(text));
  if (!parsed) return fallback;
  return normalizeLiteRolePlan(parsed, fallback, source);
}

function normalizeLiteRolePlan(value, fallback = null, source = "client") {
  if (!value || typeof value !== "object") return fallback;
  const rawRoles = Array.isArray(value.roles) ? value.roles : [];
  const colors = ["#8a6419", "#0b7d68", "#326d8f"];
  const roles = rawRoles
    .map((role, index) => ({
      id: normalizeText(role.id).replace(/[^a-zA-Z0-9_-]/g, "") || `agent${index + 1}`,
      name: clip(normalizeText(role.name), 26),
      purpose: clip(normalizeText(role.purpose || role.description), 150),
      lens: clip(normalizeText(role.lens || role.purpose || role.description), 90),
      assignment: clip(normalizeText(role.assignment || role.task || role.instruction || role.purpose || role.description), 180),
      callSignal: clip(normalizeText(role.callSignal || role.reason || role.why || role.lens), 140),
      color: normalizeColor(role.color) || colors[index % colors.length],
    }))
    .filter((role) => role.name && role.purpose && !/main\s*agent|메인\s*에이전트|진행자|사회자/i.test(role.name))
    .slice(0, 3);

  if (roles.length < 3) return fallback;
  return finalizeLiteRolePlan({
    reason: clip(normalizeText(value.reason) || fallback?.reason || "사용자 맥락에 맞춰 서로 다른 검토 관점을 배정했습니다.", 220),
    roles,
  }, source);
}

function finalizeLiteRolePlan(plan, source = "heuristic") {
  const colors = ["#8a6419", "#0b7d68", "#326d8f"];
  const roles = (Array.isArray(plan?.roles) ? plan.roles : [])
    .slice(0, 3)
    .map((role, index) => {
      const purpose = clip(normalizeText(role.purpose || role.description), 150);
      const lens = clip(normalizeText(role.lens || purpose), 90);
      return {
        id: normalizeText(role.id).replace(/[^a-zA-Z0-9_-]/g, "") || `agent${index + 1}`,
        name: clip(normalizeText(role.name) || `서브 에이전트 ${index + 1}`, 26),
        purpose,
        lens,
        assignment: clip(normalizeText(role.assignment || role.instruction) || `${purpose} ${lens ? `관점은 "${lens}"입니다.` : ""}`.trim(), 180),
        callSignal: clip(normalizeText(role.callSignal || role.reason) || `${lens || "다른 관점"}을 분리해서 보기 위해 호출합니다.`, 140),
        color: normalizeColor(role.color) || colors[index % colors.length],
      };
    });

  return {
    reason: clip(normalizeText(plan?.reason) || "사용자 맥락에 맞춰 서로 다른 검토 관점을 배정했습니다.", 220),
    roles,
    source: normalizeText(plan?.source) || source,
  };
}

async function streamDebateLite(req, res) {
  const body = await readJsonBody(req);
  const topic = normalizeText(body.topic);
  const runtime = normalizeDebateLiteRuntime(body.runtime || body);
  const agenda = normalizeAgendaContext(body.agenda);

  if (!topic) {
    return sendJson(res, 400, { error: "토론할 사안을 입력하세요." });
  }

  const providedRolePlan = normalizeLiteRolePlan(body.rolePlan || body.agenda?.rolePlan, null, "client");
  let rolePlan = providedRolePlan;
  if (!rolePlan) {
    rolePlan = await planDebateLiteRolesForAgenda({ topic, agenda, runtime });
  }
  const roles = normalizeRoles(rolePlan.roles.map(liteRoleToStoredRole));
  const session = createSession({ topic, roles, engineMode: runtime.provider, source: "debate-lite" });
  session.liteRolePlan = rolePlan;
  session.liteAgenda = agenda;
  session.liteRuntime = sanitizeDebateLiteRuntime(runtime);
  await saveSession(session);

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const writeEvent = (event) => {
    if (!closed) res.write(`${JSON.stringify(event)}\n`);
  };

  try {
    writeEvent({ type: "session", session: publicSession(session) });
    writeEvent({ type: "runtime", runtime: session.liteRuntime, label: engineLabels[runtime.provider] || runtime.provider });
    writeEvent({ type: "roles", reason: rolePlan.reason, roles: rolePlan.roles });
    writeEvent({
      type: "main",
      message: makeDebateLiteMessage({
        session,
        roleId: "main",
        roleName: "Main Agent",
        round: 0,
        content: buildDebateLiteDecisionText(topic, rolePlan),
      }),
    });

    const introMessage = makeDebateLiteMessage({
      session,
      roleId: "main",
      roleName: "Main Agent",
      round: 1,
      content: `토론 주제를 확정했습니다. 지금부터 ${rolePlan.roles
        .map((role) => role.name)
        .join(", ")} 순서로 토론을 진행하겠습니다. 사람이 중간에 끼어들면 그 발언을 다음 턴에 우선 반영합니다.`,
    });
    introMessage.content = `토론 주제를 정리했습니다. 지금부터 ${rolePlan.roles
      .map((role) => role.name)
      .join(", ")} 순서로 논의하겠습니다. 사람이 중간에 끼어들면 그 발언을 다음 흐름에 우선 반영합니다.`;
    session.messages.push(introMessage);
    session.updatedAt = new Date().toISOString();
    await saveSession(session);
    writeEvent({ type: "message", message: introMessage });

    if (runtime.provider === "mock") {
      for (const message of buildDebateLiteScript(session, rolePlan).filter((item) => item.roleId !== "main")) {
        if (closed) break;
        writeEvent({ type: "role_start", roleId: message.roleId, roleName: message.roleName, round: message.round });
        await delay(420);
        if (closed) break;
        session.messages.push(message);
        session.updatedAt = new Date().toISOString();
        await saveSession(session);
        writeEvent({ type: "message", message });
      }
    } else {
      for (const role of roles) {
        if (closed) break;
        writeEvent({ type: "role_start", roleId: role.id, roleName: role.name, round: 1 });
        const result = await runRoleTurn({
          session,
          role,
          round: 1,
          engineMode: runtime.provider,
          runtime,
          strict: true,
        });
        if (closed) break;
        const message = buildAgentMessage({ session, role, round: 1, result });
        session.messages.push(message);
        session.updatedAt = new Date().toISOString();
        await saveSession(session);
        writeEvent({ type: "message", message });
      }
    }

    if (!closed) {
      const reportResult = await runDebateLiteReport({ session, runtime, rolePlan });
      session.finalReport = reportResult.report;
      session.reportEngine = reportResult.engine;
      session.status = "completed";
      session.updatedAt = new Date().toISOString();
      await saveSession(session);
      writeEvent({
        type: "report",
        report: session.finalReport,
        engine: reportResult.engine,
        engineLabel: engineLabels[reportResult.engine] || reportResult.engine,
      });
      writeEvent({ type: "done", session: publicSession(session) });
    }
  } catch (error) {
    session.status = "failed";
    session.updatedAt = new Date().toISOString();
    session.lastError = error instanceof Error ? trimForError(error.message) : trimForError(String(error));
    await saveSession(session);
    writeEvent({ type: "error", error: session.lastError, session: publicSession(session) });
  } finally {
    if (!closed) res.end();
  }
}

async function runDebateLiteReport({ session, runtime, rolePlan }) {
  if (runtime.provider === "mock") {
    return { report: buildDebateLiteReport(session, rolePlan), engine: "mock" };
  }

  try {
    return await runReportTurn({ session, engineMode: runtime.provider, runtime, strict: true });
  } catch (error) {
    return {
      report: buildDebateLiteReport(session, rolePlan),
      engine: "mock",
      attempts: [
        {
          engine: runtime.provider,
          ok: false,
          durationMs: 0,
          error: error instanceof Error ? trimForError(error.message) : trimForError(String(error)),
        },
      ],
    };
  }
}

async function handleDebateLiteIntervention(req, res) {
  const body = await readJsonBody(req);
  const session = await loadSession(normalizeText(body.sessionId));
  const content = normalizeText(body.content);
  const runtime = normalizeDebateLiteRuntime({
    provider: body.runtime?.provider || session.engineMode || "mock",
    model: body.runtime?.model || session.liteRuntime?.model,
    baseUrl: body.runtime?.baseUrl || session.liteRuntime?.baseUrl,
    apiKey: body.runtime?.apiKey,
  });

  if (!content) {
    return sendJson(res, 400, { error: "끼어들 내용을 입력하세요." });
  }

  const round = nextHumanRound(session);
  const humanMessage = makeDebateLiteMessage({
    session,
    roleId: "human",
    roleName: "사용자 개입",
    round,
    content,
    engine: "human",
    engineLabel: engineLabels.human,
  });

  session.messages.push(humanMessage);
  session.status = "running";
  session.updatedAt = new Date().toISOString();
  await saveSession(session);

  const responses = await buildDebateLiteInterventionResponses(session, content, round, runtime);

  session.messages.push(...responses);
  session.status = "completed";
  session.updatedAt = new Date().toISOString();
  const reportResult = await runDebateLiteReport({
    session,
    runtime,
    rolePlan: session.liteRolePlan || planDebateLiteRoles(session.topic),
  });
  session.finalReport = reportResult.report;
  session.reportEngine = reportResult.engine;
  await saveSession(session);

  return sendJson(res, 200, {
    ok: true,
    humanMessage,
    messages: responses,
    report: session.finalReport,
    session: publicSession(session),
  });
}

function planBusinessDecisionRoles(topic) {
  const text = normalizeText(topic);
  if (!/(사업|아이디어|창업|서비스|프로덕트|제품|MVP|기능|고객|시장|가격|수익모델|과금|마케팅|첫 고객|세일즈|채널|실행|운영|외주|직접 개발|팀|예산|법무|CS|피벗|중단|확장)/i.test(text)) {
    return null;
  }
  const makePlan = (reason, roles) => ({
    reason,
    roles: roles.map((role, index) => ({
      id: `agent${index + 1}`,
      color: ["#8a6419", "#0b7d68", "#326d8f"][index],
      ...role,
    })),
  });

  if (/아이디어|고객 문제|검증할 가치|지불 의사|차별화/.test(text)) {
    return makePlan("아이디어 검증 문제로 보고 고객 고통, 시장 현실, 검증 실험을 나누어 봅니다.", [
      { name: "고객 고통 검증자", purpose: "고객이 정말 돈이나 시간을 쓸 만큼 아픈 문제인지 점검합니다.", lens: "문제 강도와 지불 의사" },
      { name: "시장 회의론자", purpose: "시장 크기, 경쟁, 차별화 부족 같은 실패 가능성을 따집니다.", lens: "시장성과 진입 리스크" },
      { name: "검증 실험 설계자", purpose: "가장 작게 확인할 인터뷰, 랜딩, 수동 운영 실험을 제안합니다.", lens: "최소 검증 순서" },
    ]);
  }
  if (/MVP|첫 버전|기능|수동 운영|자동화/.test(text)) {
    return makePlan("MVP 범위 결정으로 보고 핵심 가치, 제거할 기능, 검증 순서를 나누어 봅니다.", [
      { name: "핵심가치 수호자", purpose: "첫 고객이 반드시 느껴야 할 핵심 경험만 남깁니다.", lens: "반드시 필요한 가치" },
      { name: "스코프 절단자", purpose: "지금 만들면 안 되는 기능과 나중으로 미룰 기능을 잘라냅니다.", lens: "빼야 할 기능" },
      { name: "운영 실험가", purpose: "개발 전에 수동으로 검증할 수 있는 흐름을 설계합니다.", lens: "수동 검증과 출시 순서" },
    ]);
  }
  if (/초기 고객|포지셔닝|B2B|B2C|고객군|시장/.test(text)) {
    return makePlan("고객과 포지셔닝 결정으로 보고 첫 고객군, 메시지, 경쟁 차별화를 나누어 봅니다.", [
      { name: "초기고객 선택자", purpose: "가장 먼저 설득할 좁은 고객군을 고릅니다.", lens: "접근 가능성과 고통 강도" },
      { name: "포지셔닝 편집자", purpose: "고객이 기억할 한 문장과 경쟁 대비 차이를 다듬습니다.", lens: "메시지와 차별화" },
      { name: "시장 현실 검토자", purpose: "시장 크기와 구매 구조가 실제로 맞는지 확인합니다.", lens: "시장성과 구매 경로" },
    ]);
  }
  if (/가격|수익모델|과금|구독|무료|결제/.test(text)) {
    return makePlan("가격과 수익모델 결정으로 보고 고객 저항, 수익성, 과금 타이밍을 나누어 봅니다.", [
      { name: "고객저항 분석가", purpose: "고객이 가격을 받아들이지 않을 이유와 심리적 장벽을 봅니다.", lens: "구매 저항" },
      { name: "수익성 검토자", purpose: "가격 구조가 비용, 마진, 장기 운영에 맞는지 계산합니다.", lens: "단위경제와 지속성" },
      { name: "과금전략 설계자", purpose: "무료 체험, 구독, 사용량 과금의 시작 타이밍을 제안합니다.", lens: "결제 전환 구조" },
    ]);
  }
  if (/마케팅|첫 고객|세일즈|채널|콘텐츠|콜드메일|광고/.test(text)) {
    return makePlan("첫 고객 확보 문제로 보고 채널, 메시지, 실험 속도를 나누어 봅니다.", [
      { name: "채널 실험가", purpose: "가장 빨리 고객을 만날 채널과 실험 순서를 고릅니다.", lens: "채널 우선순위" },
      { name: "메시지 카피라이터", purpose: "고객이 반응할 문제 문장과 제안을 다듬습니다.", lens: "문제-제안 메시지" },
      { name: "세일즈 현실주의자", purpose: "첫 10명을 실제로 확보하기 위한 접촉 방식과 병목을 봅니다.", lens: "실행 가능성" },
    ]);
  }
  if (/실행|운영|외주|직접|팀|예산|시간|법무|CS/.test(text)) {
    return makePlan("실행과 운영 판단으로 보고 자원 배분, 직접/외주, 운영 리스크를 나누어 봅니다.", [
      { name: "자원 배분자", purpose: "시간, 돈, 인력 중 가장 부족한 자원을 기준으로 우선순위를 잡습니다.", lens: "제약과 우선순위" },
      { name: "빌드 전략가", purpose: "직접 개발, 외주, 노코드, 수동 운영 중 현실적인 길을 고릅니다.", lens: "구현 방식" },
      { name: "운영 리스크 관리자", purpose: "CS, 법무, 품질, 반복 운영 부담을 미리 드러냅니다.", lens: "운영 부담과 리스크" },
    ]);
  }
  if (/피벗|중단|확장|계속|지표|신호/.test(text)) {
    return makePlan("계속할지 바꿀지의 판단으로 보고 신호, 중단 기준, 다음 실험을 나누어 봅니다.", [
      { name: "신호 판독자", purpose: "지금까지의 고객 반응과 지표가 어떤 의미인지 해석합니다.", lens: "강한 신호와 약한 신호" },
      { name: "중단 기준 관리자", purpose: "언제 접고 언제 더 투자할지 기준을 명확히 합니다.", lens: "중단선과 추가 투자선" },
      { name: "피벗 설계자", purpose: "고객군, 문제, 기능 중 무엇을 바꿀지 대안을 제안합니다.", lens: "방향 전환 옵션" },
    ]);
  }
  return null;
}

function planDebateLiteRoles(topic) {
  const normalized = topic.toLowerCase();
  const businessPlan = planBusinessDecisionRoles(topic);
  if (businessPlan) return finalizeLiteRolePlan(businessPlan, "heuristic");
  let plan = debateLiteRoleSets[debateLiteRoleSets.length - 1];
  let bestScore = 0;
  for (const set of debateLiteRoleSets) {
    if (!set.keywords.length) continue;
    const score = set.keywords.reduce((total, word) => {
      return normalized.includes(word) ? total + Math.max(1, Math.min(3, word.length)) : total;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      plan = set;
    }
  }
  return finalizeLiteRolePlan({
    reason: plan.reason,
    roles: plan.roles.map((role) => ({ ...role })),
  }, "heuristic");
}

function liteRoleToStoredRole(role) {
  return {
    id: role.id,
    name: role.name,
    description: role.purpose,
    instruction: [
      `${role.purpose} 관점은 "${role.lens}"입니다.`,
      role.assignment ? `배정 임무: ${role.assignment}` : "",
      "발언은 짧고 구체적으로, 다음 판단에 필요한 조건을 남깁니다.",
    ].filter(Boolean).join(" "),
    color: role.color,
  };
}

function buildDebateLiteDecisionText(topic, rolePlan) {
  const roleLines = rolePlan.roles
    .map((role, index) => `${index + 1}. ${role.name}: ${role.assignment || role.purpose}`)
    .join("\n");
  return `"${topic}"은 이제 토론을 시작해도 좋은 주제입니다.\n\n메인 판단: ${rolePlan.reason}\n\n배정된 역할\n${roleLines}`;
}

function buildDebateLiteScript(session, rolePlan) {
  const [first, second, third] = rolePlan.roles;
  const topic = session.topic;
  const businessLike = /사업|아이디어|MVP|기능|고객|시장|가격|수익|마케팅|첫 고객|실행|운영|피벗|중단|B2B|SaaS|제품|창업|채널|세일즈/i.test(topic);
  const evidenceTarget = businessLike ? "실제 고객 신호" : "실제 선택 근거";
  const opportunityOptions = businessLike
    ? "고객 인터뷰, 랜딩페이지, 수동 운영, 세일즈 접촉"
    : "대안 실행, 자료 확인, 작은 실험, 일정 조정";
  const firstExperiment = businessLike
    ? "1주일 안에 후보 고객 5명에게 문제 인터뷰를 하고, 이 문제가 예산이나 반복 업무와 연결되는지 확인"
    : "작게 실행 가능한 실험 하나를 정하고, 그 결과가 어떤 결정을 뒷받침하는지 확인";

  return [
    makeDebateLiteMessage({
      session,
      roleId: "main",
      roleName: "Main Agent",
      round: 1,
      content: `토론 주제를 정리했습니다. 지금부터 ${rolePlan.roles
        .map((role) => role.name)
        .join(", ")} 순서로 논의하겠습니다. 사람이 중간에 끼어들면 그 발언을 다음 흐름에 우선 반영합니다.`,
    }),
    makeDebateLiteMessage({
      session,
      roleId: first.id,
      roleName: `${first.name} (Agent 1)`,
      round: 1,
      content: `먼저 "${topic}"에서 가장 조심해야 할 지점은 ${first.lens}입니다. 좋은 느낌만으로 결론내리지 말고, 판단 기준과 실패 기준을 먼저 분리해야 합니다.`,
    }),
    makeDebateLiteMessage({
      session,
      roleId: second.id,
      roleName: `${second.name} (Agent 2)`,
      round: 1,
      content: `동의합니다. 다만 검토만 길어지면 ${evidenceTarget}가 생기지 않습니다. 저는 "${topic}"을 바로 결론내기보다, 대안과 현실 행동을 비교하면서 무엇이 실제로 작동하는지 검증해야 한다고 봅니다.`,
    }),
    makeDebateLiteMessage({
      session,
      roleId: third.id,
      roleName: `${third.name} (Agent 3)`,
      round: 1,
      content: `저는 이 논의를 실행 가능한 검증으로 바꾸겠습니다. 이 선택이 맞았다고 말할 수 있는 최소 조건, 틀렸다고 판단할 중단 조건, 다음 행동을 한 줄씩 정해야 합니다.`,
    }),
    makeDebateLiteMessage({
      session,
      roleId: first.id,
      roleName: `${first.name} (Agent 1)`,
      round: 2,
      content: `추가로 확인하고 싶은 것은 기회비용입니다. "${topic}"에 시간을 쓰는 동안 ${opportunityOptions} 중 무엇을 미루게 되는지 계산하지 않으면 판단이 너무 낙관적으로 흐릅니다.`,
    }),
    makeDebateLiteMessage({
      session,
      roleId: second.id,
      roleName: `${second.name} (Agent 2)`,
      round: 2,
      content: `그렇다면 첫 단계는 ${evidenceTarget}를 만드는 것입니다. 예를 들어 ${firstExperiment}하면 다음 판단의 근거가 생깁니다.`,
    }),
    makeDebateLiteMessage({
      session,
      roleId: third.id,
      roleName: `${third.name} (Agent 3)`,
      round: 2,
      content: `현재 합의점은 "바로 크게 실행하기보다, 핵심 가정을 작게 검증한다"입니다. 다음 결정은 누구에게 확인하고, 어떤 반응이면 계속하며, 어떤 신호가 나오면 방향을 바꿀지 정하는 것입니다.`,
    }),
  ];
}

async function buildDebateLiteInterventionResponses(session, content, round, runtime = { provider: "mock" }) {
  const roles = liteRolesForSession(session);
  const mediator = roles[2] || roles[0];
  let nextRole = chooseNextLiteRole(session, roles);
  if (roles.length > 1 && nextRole.id === mediator.id) {
    nextRole = roles[(roles.indexOf(mediator) + 1) % roles.length] || roles[0];
  }

  const mainMessage = makeDebateLiteMessage({
      session,
      roleId: "main",
      roleName: "Main Agent",
      round,
      content: `사용자 개입을 반영했습니다. 새 조건은 "${content}"입니다. 이 발언을 다음 논점에 우선 반영하도록 토론 흐름을 조정하겠습니다.`,
    });

  if (runtime.provider !== "mock") {
    const storedRoles = rolesForSession(session);
    const mediatorRole = storedRoles.find((role) => role.id === mediator.id) || storedRoles[0];
    const nextStoredRole = storedRoles.find((role) => role.id === nextRole.id) || storedRoles[1] || storedRoles[0];
    const mediatorResult = await runRoleTurn({
      session,
      role: mediatorRole,
      round,
      engineMode: runtime.provider,
      intervention: content,
      runtime,
      strict: true,
    });
    const nextResult = await runRoleTurn({
      session,
      role: nextStoredRole,
      round,
      engineMode: runtime.provider,
      intervention: content,
      runtime,
      strict: true,
    });
    return [
      mainMessage,
      buildAgentMessage({ session, role: mediatorRole, round, result: mediatorResult }),
      buildAgentMessage({ session, role: nextStoredRole, round, result: nextResult }),
    ];
  }

  return [
    mainMessage,
    makeDebateLiteMessage({
      session,
      roleId: mediator.id,
      roleName: `${mediator.name} (Agent ${roles.indexOf(mediator) + 1})`,
      round,
      content: `좋습니다. 방금 개입은 토론의 기준을 바꿉니다. 이제 단순 찬반보다 "${content}"를 만족시키는 조건이 무엇인지 확인해야 합니다.`,
    }),
    makeDebateLiteMessage({
      session,
      roleId: nextRole.id,
      roleName: `${nextRole.name} (Agent ${roles.indexOf(nextRole) + 1})`,
      round,
      content: `그 기준을 적용하면 "${session.topic}"의 다음 검토 포인트는 실행 순서입니다. 우선순위를 낮춰야 할 부분과 당장 실험해볼 부분을 분리하겠습니다.`,
    }),
  ];
}

function buildDebateLiteReport(session, rolePlan) {
  const roles = rolePlan.roles || liteRolesForSession(session);
  const roleNames = roles.map((role) => role.name).join(", ");
  const humanCount = (session.messages || []).filter((message) => message.roleId === "human").length;
  return {
    summary: `"${session.topic}"에 대해 ${roleNames} 관점으로 토론했습니다.${humanCount ? ` 사람 개입 ${humanCount}건을 반영했습니다.` : ""}`,
    decision: "작게 시작하되 실패 기준과 사람 개입 조건을 먼저 정하는 방향으로 논의를 모았습니다.",
    agreements: [
      "처음부터 결론을 고정하지 않고 관점별 역할을 나눠 판단해야 합니다.",
      "실험 범위, 성공 지표, 중단 기준을 한 세트로 정해야 합니다.",
      "사용자의 중간 발언은 다음 턴의 우선 조건으로 반영되어야 합니다.",
    ],
    disagreements: ["어느 지표를 최우선으로 볼지는 실제 사용 맥락에 따라 더 정해야 합니다."],
    nextActions: [
      "파일럿 범위와 관찰 지표를 한 문장씩 정합니다.",
      "사람이 반드시 개입해야 하는 예외 상황을 적습니다.",
      "다음 토론에서는 결론 후보를 2개로 좁혀 비교합니다.",
    ],
    risks: ["역할이 너무 비슷하면 토론이 반복될 수 있으므로 역할 목적을 계속 선명하게 유지해야 합니다."],
  };
}

function makeDebateLiteMessage({ session, roleId, roleName, round, content, engine = "mock", engineLabel = engineLabels.mock }) {
  return {
    id: makeId(roleId === "human" ? "human" : "msg"),
    sessionId: session.id,
    roleId,
    roleName,
    round,
    content,
    engine,
    engineLabel,
    status: "complete",
    createdAt: new Date().toISOString(),
  };
}

function liteRolesForSession(session) {
  if (Array.isArray(session.liteRolePlan?.roles) && session.liteRolePlan.roles.length) {
    return session.liteRolePlan.roles;
  }
  return rolesForSession(session).map((role, index) => ({
    id: role.id,
    name: role.name,
    purpose: role.description,
    lens: "다음 판단 기준",
    color: role.color || defaultRoleColor(index),
  }));
}

function chooseNextLiteRole(session, roles) {
  const lastAgent = [...(session.messages || [])]
    .reverse()
    .find((message) => message.roleId !== "human" && message.roleId !== "main");
  if (!lastAgent) return roles[0];
  const index = roles.findIndex((role) => role.id === lastAgent.roleId);
  return roles[(index + 1 + roles.length) % roles.length] || roles[0];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamDebate(req, res) {
  const body = await readJsonBody(req);
  const topic = normalizeText(body.topic) || "제목 없는 토론";
  const roles = normalizeRoles(body.roles);
  const engineMode = normalizeEngineMode(body.engineMode);
  const session = createSession({ topic, roles, engineMode, source: "server" });

  await saveSession(session);

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const writeEvent = (event) => {
    if (!closed) res.write(`${JSON.stringify(event)}\n`);
  };

  writeEvent({ type: "session", session: publicSession(session) });

  try {
    for (const item of buildRunPlan(roles)) {
      if (closed) break;
      writeEvent({ type: "role_start", roleId: item.role.id, roleName: item.role.name, round: item.round });

      const result = await runRoleTurn({
        session,
        role: item.role,
        round: item.round,
        engineMode,
      });

      const message = buildAgentMessage({ session, role: item.role, round: item.round, result });
      session.messages.push(message);
      session.updatedAt = new Date().toISOString();
      await saveSession(session);
      writeEvent({ type: "message", message });
    }

    if (!closed) {
      const reportResult = await runReportTurn({ session, engineMode });
      session.finalReport = reportResult.report;
      session.reportEngine = reportResult.engine;
      session.status = "completed";
      session.updatedAt = new Date().toISOString();
      await saveSession(session);
      writeEvent({
        type: "report",
        report: session.finalReport,
        engine: reportResult.engine,
        engineLabel: engineLabels[reportResult.engine] || reportResult.engine,
      });
      writeEvent({ type: "done", session: publicSession(session) });
    }
  } catch (error) {
    session.status = "failed";
    session.updatedAt = new Date().toISOString();
    session.lastError = error instanceof Error ? trimForError(error.message) : trimForError(String(error));
    await saveSession(session);
    writeEvent({ type: "error", error: session.lastError, session: publicSession(session) });
  } finally {
    if (!closed) res.end();
  }
}

async function handleChat(req, res) {
  const body = await readJsonBody(req);
  const session = await loadSession(normalizeText(body.sessionId));
  const content = normalizeText(body.content);
  const engineMode = normalizeEngineMode(body.engineMode || session.engineMode);

  if (!content) {
    return sendJson(res, 400, { error: "채팅 메시지를 입력하세요." });
  }

  const now = new Date().toISOString();
  const humanMessage = {
    id: makeId("human"),
    sessionId: session.id,
    roleId: "human",
    roleName: "나",
    round: nextHumanRound(session),
    content,
    engine: "human",
    engineLabel: engineLabels.human,
    status: "complete",
    createdAt: now,
  };

  session.messages.push(humanMessage);
  session.status = "running";
  session.updatedAt = now;
  await saveSession(session);

  const role = chooseNextRole(session);
  const result = await runRoleTurn({
    session,
    role,
    round: humanMessage.round,
    engineMode,
    intervention: content,
  });

  const responseMessage = buildAgentMessage({
    session,
    role,
    round: humanMessage.round,
    result,
  });

  session.messages.push(responseMessage);
  session.status = "completed";
  session.updatedAt = new Date().toISOString();
  await saveSession(session);

  return sendJson(res, 200, {
    ok: true,
    humanMessage,
    responseMessages: [responseMessage],
    responseMessage,
    session: publicSession(session),
  });
}

async function handleReportRefresh(req, res) {
  const body = await readJsonBody(req);
  const session = await loadSession(normalizeText(body.sessionId));
  const engineMode = normalizeEngineMode(body.engineMode || session.engineMode);
  const result = await runReportTurn({ session, engineMode });
  session.finalReport = result.report;
  session.reportEngine = result.engine;
  session.status = "completed";
  session.updatedAt = new Date().toISOString();
  await saveSession(session);
  return sendJson(res, 200, {
    ok: true,
    report: session.finalReport,
    engine: result.engine,
    engineLabel: engineLabels[result.engine] || result.engine,
    session: publicSession(session),
  });
}

function createSession({ topic, roles, engineMode, source }) {
  const now = new Date().toISOString();
  return {
    id: makeId("debate"),
    topic,
    roles,
    selectedRoleIds: roles.map((role) => role.id),
    engineMode,
    source,
    status: "running",
    messages: [],
    finalReport: null,
    reportEngine: null,
    createdAt: now,
    updatedAt: now,
  };
}

function publicSession(session) {
  const roles = rolesForSession(session);
  return {
    id: session.id,
    topic: session.topic,
    roles,
    selectedRoleIds: roles.map((role) => role.id),
    engineMode: session.engineMode,
    source: session.source,
    status: session.status,
    messages: session.messages || [],
    finalReport: session.finalReport || null,
    reportEngine: session.reportEngine || null,
    lastError: session.lastError || null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function buildRunPlan(roles) {
  const rounds = roles.length > 5 ? 1 : 2;
  const plan = [];
  for (let round = 1; round <= rounds; round += 1) {
    for (const role of roles) {
      plan.push({ round, role });
    }
  }
  return plan;
}

function buildAgentMessage({ session, role, round, result }) {
  return {
    id: makeId("msg"),
    sessionId: session.id,
    roleId: role.id,
    roleName: role.name,
    round,
    content: result.text,
    engine: result.engine,
    engineLabel: engineLabels[result.engine] || result.engine,
    fallback: result.fallback,
    attempts: result.attempts,
    status: "complete",
    createdAt: new Date().toISOString(),
  };
}

async function runRoleTurn({ session, role, round, engineMode, intervention, runtime, strict = false }) {
  const prompt =
    engineMode === "codex"
      ? buildCodexRolePrompt({ session, role, round, intervention })
      : buildRolePrompt({ session, role, round, intervention });
  const engineOrder = strict ? [engineMode] : resolveEngineOrder(engineMode);
  const attempts = [];

  for (const engine of engineOrder) {
    if (engine === "mock") break;
    const startedAt = Date.now();
    try {
      const text = await runEngine(engine, prompt, {
        sessionId: session.id,
        roleId: role.id,
        round,
        kind: "role",
        runtime,
      });
      const cleaned = cleanAssistantText(text);
      if (!cleaned) throw new Error("빈 응답을 받았습니다.");
      return {
        text: cleaned,
        engine,
        fallback: engine !== engineOrder[0],
        attempts: [
          ...attempts,
          {
            engine,
            ok: true,
            durationMs: Date.now() - startedAt,
          },
        ],
      };
    } catch (error) {
      attempts.push({
        engine,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? trimForError(error.message) : trimForError(String(error)),
      });
    }
  }

  if (strict && attempts.length) {
    const lastError = attempts[attempts.length - 1]?.error || "선택한 AI 엔진이 응답하지 않았습니다.";
    throw new Error(`${engineLabels[engineMode] || engineMode} 실행에 실패했습니다: ${lastError}`);
  }

  return {
    text: mockRoleResponse({ session, role, round, intervention }),
    engine: "mock",
    fallback: engineOrder[0] !== "mock",
    attempts: [
      ...attempts,
      {
        engine: "mock",
        ok: true,
        durationMs: 0,
      },
    ],
  };
}

async function runReportTurn({ session, engineMode, runtime, strict = false }) {
  const prompt = engineMode === "codex" ? buildCodexReportPrompt(session) : buildReportPrompt(session);
  const order = (strict ? [engineMode] : resolveEngineOrder(engineMode)).filter((engine) => engine !== "mock");
  const attempts = [];

  for (const engine of order) {
    const startedAt = Date.now();
    try {
      const text = await runEngine(engine, prompt, {
        sessionId: session.id,
        roleId: "report",
        round: 99,
        kind: "report",
        runtime,
      });
      const report = parseReportText(text);
      return {
        report,
        engine,
        attempts: [
          ...attempts,
          {
            engine,
            ok: true,
            durationMs: Date.now() - startedAt,
          },
        ],
      };
    } catch (error) {
      attempts.push({
        engine,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? trimForError(error.message) : trimForError(String(error)),
      });
    }
  }

  if (strict && attempts.length) {
    const lastError = attempts[attempts.length - 1]?.error || "선택한 AI 엔진이 응답하지 않았습니다.";
    throw new Error(`${engineLabels[engineMode] || engineMode} 실행에 실패했습니다: ${lastError}`);
  }

  return {
    report: buildHeuristicReport(session),
    engine: "mock",
    attempts: [
      ...attempts,
      {
        engine: "mock",
        ok: true,
        durationMs: 0,
      },
    ],
  };
}

async function runEngine(engine, prompt, context) {
  if (directApiProviders.has(engine) || engine === "ollama") return runDirectProvider(engine, prompt, context);
  if (engine === "openclaw") return runOpenClaw(prompt, context);
  if (engine === "codex") return runCodex(prompt, context);
  if (engine === "claude") return runClaude(prompt);
  throw new Error(`지원하지 않는 엔진입니다: ${engine}`);
}

async function runOpenAI(prompt, context = {}) {
  return runOpenAIResponse(prompt, {
    apiKey: context.runtime?.apiKey,
    model: context.runtime?.model,
    timeoutMs: OPENAI_TIMEOUT_MS,
  });
}

async function runOpenClaw(prompt, context) {
  if (!(await commandExists("openclaw"))) {
    throw new Error("오픈클로 명령줄 도구를 찾지 못했습니다.");
  }
  if (!(await fileExists(OPENCLAW_CONFIG_PATH))) {
    throw new Error("오픈클로 토론 전용 프로필 설정 파일이 없습니다.");
  }

  const timeoutSeconds = Math.max(10, Math.ceil(OPENCLAW_TIMEOUT_MS / 1000));
  const cliArgs = [
    "--no-color",
    "--profile",
    OPENCLAW_PROFILE,
    "agent",
    "--local",
    "--json",
    "--session-id",
    `${context.sessionId}-${context.roleId}`,
    "--message",
    prompt,
    "--timeout",
    String(timeoutSeconds),
    "--thinking",
    OPENCLAW_THINKING,
  ];
  const invocation = (await fileExists(OPENCLAW_ENTRY))
    ? {
        command: process.execPath,
        args: [OPENCLAW_ENTRY, ...cliArgs],
      }
    : {
        command: "openclaw",
        args: cliArgs,
      };

  const result = await runCommand({
    ...invocation,
    cwd: RUNTIME_WORKSPACE,
    timeoutMs: OPENCLAW_TIMEOUT_MS,
    env: { NO_COLOR: "1", FORCE_COLOR: "0" },
  });

  if (result.timedOut) throw new Error(`오픈클로 응답 시간이 ${Math.ceil(OPENCLAW_TIMEOUT_MS / 1000)}초를 넘었습니다.`);
  if (result.exitCode !== 0) throw new Error(trimForError(result.stderr || result.stdout || "오픈클로 실행에 실패했습니다."));

  const parsed = parseJsonFromOutput(result.stdout);
  if (parsed) {
    const text = extractText(parsed);
    if (text) return text;
  }

  return result.stdout;
}

async function runCodex(prompt, context) {
  if (!(await commandExists("codex"))) {
    throw new Error("코덱스 명령줄 도구를 찾지 못했습니다.");
  }

  const model = context.runtime?.model || DEFAULT_CODEX_MODEL;
  const timeoutMs = context.timeoutMs || CODEX_TIMEOUT_MS;
  const outputPath = path.join(
    CLI_OUTPUT_DIR,
    `${context.sessionId}-${context.roleId}-${context.kind || "role"}-${Date.now()}.txt`,
  );
  const cliArgs = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--model",
    model,
    "-C",
    RUNTIME_WORKSPACE,
    "--output-last-message",
    outputPath,
    prompt,
  ];
  const invocation =
    process.platform === "win32" && (await fileExists(CODEX_WRAPPER))
      ? {
          command: "powershell.exe",
          args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", CODEX_WRAPPER, ...cliArgs],
        }
      : {
          command: "codex",
          args: cliArgs,
        };

  const result = await runCommand({
    ...invocation,
    cwd: RUNTIME_WORKSPACE,
    timeoutMs,
    env: { NO_COLOR: "1", FORCE_COLOR: "0" },
  });

  if (result.timedOut) throw new Error(`코덱스 응답 시간이 ${Math.ceil(timeoutMs / 1000)}초를 넘었습니다.`);
  if (result.exitCode !== 0) throw new Error(trimForError(result.stderr || result.stdout || "코덱스 실행에 실패했습니다."));

  const output = await readFile(outputPath, "utf8").catch(() => "");
  return output || result.stdout;
}

async function runClaude(prompt) {
  if (!(await commandExists("claude"))) {
    throw new Error("클로드 명령줄 도구를 찾지 못했습니다.");
  }

  const cliArgs = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
    "--tools",
    "",
  ];
  const invocation = (await fileExists(CLAUDE_ENTRY))
    ? {
        command: process.execPath,
        args: [CLAUDE_ENTRY, ...cliArgs],
      }
    : {
        command: "claude",
        args: cliArgs,
      };

  const result = await runCommand({
    ...invocation,
    cwd: RUNTIME_WORKSPACE,
    timeoutMs: ENGINE_TIMEOUT_MS,
    env: { NO_COLOR: "1", FORCE_COLOR: "0" },
  });

  if (result.timedOut) throw new Error(`클로드 응답 시간이 ${Math.ceil(ENGINE_TIMEOUT_MS / 1000)}초를 넘었습니다.`);
  if (result.exitCode !== 0) throw new Error(trimForError(result.stderr || result.stdout || "클로드 실행에 실패했습니다."));

  const parsed = parseJsonFromOutput(result.stdout);
  if (parsed) {
    const text = extractText(parsed);
    if (text) return text;
  }

  return result.stdout;
}

function runCommand({ command, args, cwd, timeoutMs, env = {} }) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let hardTimer = null;

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (hardTimer) clearTimeout(hardTimer);
      resolve({
        exitCode: payload.exitCode,
        signal: payload.signal || null,
        stdout,
        stderr,
        timedOut,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
      hardTimer = setTimeout(() => finish({ exitCode: null, signal: "TIMEOUT" }), 5000);
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout = appendLimited(stdout, chunk.toString("utf8"));
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendLimited(stderr, chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      stderr = appendLimited(stderr, error.message);
      finish({ exitCode: 1, signal: null });
    });
    child.on("close", (code, signal) => {
      finish({ exitCode: code, signal });
    });
  });
}

function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => {});
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
    setTimeout(() => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
    }, 1200).unref();
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
}

function buildRolePrompt({ session, role, round, intervention }) {
  const transcript = renderTranscript(session);
  const roles = rolesForSession(session).map((item) => `${item.name}: ${item.description}`).join("\n");
  const interventionLine = intervention ? `\n사람이 방금 채팅으로 끼어들었습니다: ${intervention}` : "";
  const agendaContext = renderAgendaContextForPrompt(session);

  return [
    "당신은 사람이 관찰하는 공개 토론방 안에서 말하는 에이전트입니다.",
    "내부 추론은 공개하지 말고, 최종 발언만 한국어로 짧게 작성하세요.",
    "명령 실행, 파일 읽기, 파일 쓰기, 네트워크 호출을 하지 마세요. 이 요청은 텍스트 발언 생성만 허용합니다.",
    "사람의 채팅은 특정 역할 대상이 아니라 전체 토론 흐름에 들어온 개입입니다. 자연스럽게 이어받으세요.",
    "영어 제품명은 가능하면 한국어 표기로 바꾸세요. 예: OpenClaw는 오픈클로, Codex는 코덱스, Claude는 클로드.",
    "",
    `토론 주제: ${session.topic}`,
    agendaContext ? `사전 대화에서 확인한 사용자 맥락:\n${agendaContext}` : "",
    `현재 라운드: ${round}`,
    "참여 역할:",
    roles,
    "",
    `당신의 역할: ${role.name}`,
    `역할 설명: ${role.description}`,
    `역할 지침: ${role.instruction || role.description}`,
    interventionLine,
    "",
    "지금까지의 공개 발언:",
    transcript || "아직 발언이 없습니다.",
    "",
    "응답 형식:",
    "- 2~5문장",
    "- 한국어만 사용",
    "- 이 역할의 관점이 분명해야 함",
    "- 사람의 채팅이나 이전 발언을 한 가지 이상 이어받아야 함",
    "",
    "지금 바로 위 토론 주제에 대한 실제 발언만 출력하세요. 추가 주제를 요청하거나 대기하지 마세요.",
  ].join("\n");
}

function buildCodexRolePrompt({ session, role, round, intervention }) {
  const transcript = renderTranscript(session);
  const agendaContext = renderAgendaContextForPrompt(session);
  return [
    `토론 주제: ${session.topic}`,
    agendaContext ? `사전 대화에서 확인한 사용자 맥락:\n${agendaContext}` : "",
    `현재 라운드: ${round}`,
    `당신의 역할: ${role.name}`,
    `역할 설명: ${role.description}`,
    `역할 지침: ${role.instruction || role.description}`,
    intervention ? `사람의 중간 개입: ${intervention}` : "",
    "",
    "이전 공개 발언:",
    transcript || "아직 이전 발언이 없습니다. 이 주제에 대한 첫 발언을 하세요.",
    "",
    "위 토론 주제에 대해 지금 바로 이 역할의 실제 발언만 작성하세요.",
    "준비됐다는 말, 주제를 달라는 말, 파일/작업공간 언급, 내부 추론 공개는 금지입니다.",
    "한국어 2~5문장으로만 답하세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderAgendaContextForPrompt(session) {
  const agenda = session.liteAgenda || {};
  return clip([
    agenda.topicDraft ? `메인이 좁힌 토론 질문: ${agenda.topicDraft}` : "",
    agenda.summary,
    agenda.transcript,
  ].filter(Boolean).join("\n\n"), 1800);
}

function buildReportPrompt(session) {
  return [
    "다음 공개 토론을 한국어 최종 보고서로 정리하세요.",
    "내부 추론은 공개하지 말고 JSON만 출력하세요.",
    "추가 입력을 기다리지 말고 즉시 JSON 객체 하나만 출력하세요.",
    "스키마:",
    '{"summary":"한 문단 요약","decision":"권장 결론","agreements":["합의 1"],"disagreements":["쟁점 1"],"nextActions":["다음 행동 1"],"risks":["주의할 점 1"]}',
    "",
    `토론 주제: ${session.topic}`,
    "",
    renderTranscript(session),
  ].join("\n");
}

function buildCodexReportPrompt(session) {
  return [
    `토론 주제: ${session.topic}`,
    "",
    "아래 공개 토론 내용을 바탕으로 한국어 최종 보고서 JSON 하나만 작성하세요.",
    "파일이나 작업공간을 언급하지 말고, 추가 입력을 요청하지 마세요.",
    'JSON 스키마: {"summary":"한 문단 요약","decision":"권장 결론","agreements":["합의 1"],"disagreements":["쟁점 1"],"nextActions":["다음 행동 1"],"risks":["주의할 점 1"]}',
    "",
    "토론 내용:",
    renderTranscript(session),
  ].join("\n");
}

function renderTranscript(session) {
  return (session.messages || [])
    .map((message) => {
      const roleName = message.roleName || roleById(session, message.roleId).name;
      return `[${roleName} / ${message.engineLabel || message.engine || "엔진"}] ${message.content}`;
    })
    .join("\n\n");
}

function parseReportText(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = parseJsonFromOutput(cleaned);
  if (parsed) return normalizeReport(parsed);

  return normalizeReport({
    summary: cleanAssistantText(cleaned).slice(0, 1200),
    decision: "토론 결과를 바탕으로 작은 범위부터 실행하고, 위험 요소를 확인하면서 확장하는 것이 좋습니다.",
  });
}

function normalizeReport(value) {
  return {
    summary: normalizeText(value.summary) || "토론 내용을 요약할 수 없습니다.",
    decision: normalizeText(value.decision) || "추가 검토 후 결정하세요.",
    agreements: normalizeStringList(value.agreements),
    disagreements: normalizeStringList(value.disagreements),
    nextActions: normalizeStringList(value.nextActions),
    risks: normalizeStringList(value.risks),
  };
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean).slice(0, 8);
}

function buildHeuristicReport(session) {
  const roles = rolesForSession(session);
  const roleNames = roles.map((role) => role.name).join(", ");
  const hasHumanInput = session.messages.some((message) => message.roleId === "human");
  return {
    summary: `"${session.topic}"에 대해 ${roleNames} 관점으로 공개 토론을 진행했습니다. 사람이 중간 채팅으로 흐름에 개입할 수 있는 구조까지 함께 확인했습니다.`,
    decision: "사용자가 직접 역할을 만들고, 토론 중에는 일반 채팅처럼 끼어들 수 있는 구조가 더 자연스럽습니다. 역할 대상 선택 없이 전체 흐름에 사람 메시지를 넣고 다음 역할이 이어받는 방식이 적절합니다.",
    agreements: [
      "역할은 제품이 고정해두기보다 사용자가 직접 정할 수 있어야 합니다.",
      "사람 개입은 별도 대상 선택보다 채팅 입력으로 들어가는 편이 이해하기 쉽습니다.",
      "토론과 사람 메시지는 같은 대화 기록 안에 저장되어야 합니다.",
    ],
    disagreements: [
      "사람이 끼어든 뒤 한 역할만 답할지, 여러 역할이 연속으로 답할지는 제품 설정으로 더 다듬을 수 있습니다.",
    ],
    nextActions: [
      "사용자가 만든 역할로 토론을 시작합니다.",
      "토론 중 하단 채팅창에 메시지를 넣어 흐름이 자연스럽게 이어지는지 확인합니다.",
      hasHumanInput ? "사람 채팅이 최종 보고서에 반영되는지 다시 정리합니다." : "사람 채팅을 한 번 넣어 결과 변화를 확인합니다.",
    ],
    risks: [
      "역할 설명이 너무 짧으면 발언 품질이 흔들릴 수 있습니다.",
      "역할 수가 많으면 응답 시간이 길어질 수 있으므로 기본 라운드는 짧게 유지합니다.",
    ],
  };
}

function mockRoleResponse({ session, role, round, intervention }) {
  const chatLine = intervention ? ` 방금 사람은 "${intervention}"라고 끼어들었습니다.` : "";
  return `${role.name} 관점에서 보면 "${session.topic}"의 핵심은 역할이 정해져 있다는 느낌보다 토론 흐름이 살아 있어야 한다는 점입니다.${chatLine} 저는 ${role.description}라는 책임에 맞춰, 지금 단계에서는 사용자가 만든 역할과 사람 채팅을 같은 대화 기록 안에 자연스럽게 섞는 방향을 제안합니다. 라운드 ${round}에서는 이 구조가 실제 사용자가 이해하기 쉬운지 확인해야 합니다.`;
}

function chooseNextRole(session) {
  const roles = rolesForSession(session);
  const lastAgent = [...(session.messages || [])].reverse().find((message) => message.roleId !== "human");
  if (!lastAgent) return roles[0];
  const index = roles.findIndex((role) => role.id === lastAgent.roleId);
  return roles[(index + 1 + roles.length) % roles.length] || roles[0];
}

function nextHumanRound(session) {
  const rounds = (session.messages || []).map((message) => Number(message.round) || 0);
  return rounds.length ? Math.max(...rounds) + 0.5 : 0.5;
}

function normalizeRoles(value) {
  const source = Array.isArray(value) && value.length ? value : defaultRoles;
  const roles = [];
  const usedIds = new Set();

  for (let index = 0; index < source.length && roles.length < 8; index += 1) {
    const item = source[index] || {};
    const name = clip(normalizeText(item.name) || `역할 ${index + 1}`, 32);
    const description = clip(normalizeText(item.description) || `${name} 관점으로 토론합니다.`, 140);
    const instruction = clip(normalizeText(item.instruction) || description, 240);
    const baseId = normalizeText(item.id).replace(/[^a-zA-Z0-9_-]/g, "") || `role-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    roles.push({
      id,
      name,
      description,
      instruction,
      color: normalizeColor(item.color) || defaultRoleColor(index),
      initials: makeInitials(name),
    });
  }

  return roles.length ? roles : normalizeRoles(defaultRoles);
}

function rolesForSession(session) {
  if (Array.isArray(session.roles) && session.roles.length) return normalizeRoles(session.roles);
  if (Array.isArray(session.selectedRoleIds) && session.selectedRoleIds.length) {
    const map = new Map(defaultRoles.map((role) => [role.id, role]));
    const legacyMap = new Map([
      ["moderator", defaultRoles[0]],
      ["builder", defaultRoles[1]],
      ["skeptic", defaultRoles[2]],
      ["product", { ...defaultRoles[1], id: "product", name: "제품 담당", description: "사용자 가치와 사용 흐름을 검토합니다." }],
      ["risk", { ...defaultRoles[2], id: "risk", name: "리스크 담당", description: "비용, 인증, 보안, 운영 위험을 검토합니다." }],
      ["synthesizer", { ...defaultRoles[0], id: "synthesizer", name: "정리자", description: "결론과 다음 행동을 정리합니다." }],
    ]);
    return normalizeRoles(session.selectedRoleIds.map((id) => map.get(id) || legacyMap.get(id)).filter(Boolean));
  }
  return normalizeRoles(defaultRoles);
}

function roleById(session, id) {
  return rolesForSession(session).find((role) => role.id === id) || rolesForSession(session)[0];
}

function makeInitials(name) {
  const letters = Array.from(name.replace(/\s+/g, ""));
  return letters.slice(0, 2).join("") || "역할";
}

function defaultRoleColor(index) {
  return ["#202624", "#0b7d68", "#8a6419", "#326d8f", "#9b3f38", "#59478b", "#59636e", "#7b5934"][index % 8];
}

function normalizeColor(value) {
  const text = normalizeText(value);
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : "";
}

function cleanAssistantText(text) {
  const cleaned = String(text || "")
    .replace(/\r/g, "")
    .replace(/^\s*```(?:json|markdown|text)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/<\|[^>]+?\|>/g, "")
    .trim();
  return localizeVisibleEnglish(cleaned).slice(0, 2400);
}

function localizeVisibleEnglish(text) {
  return text
    .replace(/\bOpenClaw\b/g, "오픈클로")
    .replace(/\bCodex\b/g, "코덱스")
    .replace(/\bClaude\b/g, "클로드")
    .replace(/\bAI\b/g, "인공지능")
    .replace(/\bMVP\b/g, "최소 기능 제품")
    .replace(/\bAPI\b/g, "응용 연결 방식")
    .replace(/\bCLI\b/g, "명령줄 도구")
    .replace(/\bJSON\b/g, "제이슨")
    .replace(/\bsession\b/gi, "세션")
    .replace(/\bengine\b/gi, "엔진")
    .replace(/\bdebate\b/gi, "토론");
}

function parseJsonFromOutput(output) {
  const text = String(output || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch {}
  }

  return null;
}

function extractText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join("\n");
  if (typeof value !== "object") return "";

  for (const key of ["result", "response", "reply", "message", "content", "text", "output", "lastMessage", "final"]) {
    const text = extractText(value[key]);
    if (text) return text;
  }

  if (value.message && typeof value.message === "object") {
    const text = extractText(value.message.content);
    if (text) return text;
  }

  return "";
}

function trimForError(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/([A-Za-z0-9_+-]{12,})/g, (match) => {
      if (/^(debate|session|openclaw|codex|claude)/i.test(match)) return match;
      if (/^[A-Z0-9_]+_API_KEY$/.test(match)) return match;
      return `${match.slice(0, 4)}...${match.slice(-4)}`;
    })
    .trim()
    .slice(0, 600);
}

function resolveEngineOrder(engineMode) {
  if (directApiProviders.has(engineMode) || engineMode === "ollama") return [engineMode];
  if (engineMode === "codex") return ["codex", "openclaw", "claude", "mock"];
  if (engineMode === "claude") return ["claude", "codex", "openclaw", "mock"];
  if (engineMode === "mock") return ["mock"];
  return ["openclaw", "codex", "claude", "mock"];
}

function normalizeEngineMode(value) {
  const raw = normalizeText(value);
  return ["openai", "anthropic", "gemini", "openrouter", "ollama", "openclaw", "codex", "claude", "mock"].includes(raw)
    ? raw
    : "openclaw";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value, maxLength) {
  return Array.from(value).slice(0, maxLength).join("");
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function sessionPath(sessionId) {
  const safe = normalizeText(sessionId).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) {
    const error = new Error("세션 아이디가 올바르지 않습니다.");
    error.statusCode = 400;
    throw error;
  }
  return path.join(SESSION_DIR, `${safe}.json`);
}

async function saveSession(session) {
  await writeFile(sessionPath(session.id), `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

async function loadSession(sessionId) {
  try {
    const raw = await readFile(sessionPath(sessionId), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFound = new Error("저장된 세션을 찾을 수 없습니다.");
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  }
}

async function listSessions() {
  const files = await readdir(SESSION_DIR).catch(() => []);
  const sessions = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    try {
      const raw = await readFile(path.join(SESSION_DIR, file), "utf8");
      const session = JSON.parse(raw);
      const roles = rolesForSession(session);
      sessions.push({
        id: session.id,
        topic: cleanStoredTitle(session.topic),
        status: session.status,
        engineMode: session.engineMode,
        roleCount: roles.length,
        messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
        hasReport: Boolean(session.finalReport),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      });
    } catch {
      // Ignore corrupt session files so one bad record does not break the product.
    }
  }
  return sessions.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

async function countSessions() {
  const sessions = await listSessions();
  return sessions.length;
}

function cleanStoredTitle(value) {
  const text = normalizeText(value);
  if (!text) return "제목 없는 토론";
  const questionMarks = (text.match(/\?/g) || []).length;
  const koreanLetters = (text.match(/[가-힣]/g) || []).length;
  if (questionMarks >= 4 && koreanLetters < 2) return "이전 토론";
  return text;
}

function buildMarkdownExport(session) {
  const lines = [
    `# ${session.topic}`,
    "",
    `- 세션: ${session.id}`,
    `- 상태: ${session.status}`,
    `- 엔진 모드: ${engineLabels[session.engineMode] || session.engineMode}`,
    `- 역할: ${rolesForSession(session).map((role) => role.name).join(", ")}`,
    `- 생성: ${session.createdAt}`,
    `- 수정: ${session.updatedAt}`,
    "",
    "## 발언",
    "",
  ];

  for (const message of session.messages || []) {
    lines.push(`### ${message.roleName || roleById(session, message.roleId).name}`);
    lines.push("");
    lines.push(message.content || "");
    lines.push("");
  }

  if (session.finalReport) {
    lines.push("## 최종 보고서", "");
    lines.push(`요약: ${session.finalReport.summary}`, "");
    lines.push(`결론: ${session.finalReport.decision}`, "");
    for (const [title, key] of [
      ["합의", "agreements"],
      ["쟁점", "disagreements"],
      ["다음 행동", "nextActions"],
      ["위험", "risks"],
    ]) {
      const items = session.finalReport[key] || [];
      if (items.length) {
        lines.push(`### ${title}`, "");
        for (const item of items) lines.push(`- ${item}`);
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

async function commandExists(command) {
  if (command === "openclaw" && (await fileExists(OPENCLAW_ENTRY))) return true;
  if (command === "claude" && (await fileExists(CLAUDE_ENTRY))) return true;
  if (command === "codex" && (await fileExists(CODEX_WRAPPER))) return true;

  const probe = process.platform === "win32" ? "where.exe" : "which";
  const result = await runCommand({
    command: probe,
    args: [command],
    timeoutMs: 5000,
    cwd: __dirname,
  });
  return result.exitCode === 0;
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function appendLimited(current, next) {
  const combined = `${current}${next}`;
  return combined.length > 250000 ? combined.slice(-250000) : combined;
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
    if (body.length > 200000) throw new Error("요청 본문이 너무 큽니다.");
  }
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

async function serveStatic(pathname, res) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(STATIC_DIR, `.${requestedPath}`);
  if (!resolved.startsWith(path.resolve(STATIC_DIR))) {
    return sendJson(res, 403, { error: "허용되지 않은 경로입니다." });
  }

  try {
    await access(resolved, constants.R_OK);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    createReadStream(resolved).pipe(res);
  } catch {
    sendJson(res, 404, { error: "파일을 찾을 수 없습니다." });
  }
}

function maskHome(filePath) {
  const home = os.homedir();
  return filePath.startsWith(home) ? filePath.replace(home, "~") : filePath;
}
