# Agent Debate Room 제품/개발 기획서 v0

## 1. 제품 한 줄 정의

Agent Debate Room은 여러 AI 역할이 하나의 주제를 놓고 라운드별로 토론하고, 사람이 중간에 개입하며, 마지막에 실행 가능한 결론을 얻는 실시간 토론형 에이전트 제품이다.

## 2. 왜 만드는가

사용자는 AI가 혼자 답을 내는 것보다, 서로 다른 관점의 AI들이 어떻게 주장하고 반박하고 결론에 도달하는지 눈으로 보고 싶다.

핵심 가치는 다음 세 가지다.

- 여러 관점이 동시에 드러난다.
- 사람은 중간에 방향을 바꿀 수 있다.
- 최종 결과는 단순 채팅 로그가 아니라 의사결정 문서가 된다.

## 3. 첫 번째 목표

첫 개발 목표는 OpenClaw를 바로 붙이는 것이 아니라, 제품의 기본 경험을 검증할 수 있는 MVP를 만드는 것이다.

MVP는 다음을 보여줘야 한다.

- 사용자가 토론 주제를 입력한다.
- 역할별 AI가 채팅방처럼 순서대로 발언한다.
- 사람이 중간에 특정 역할 또는 전체 토론에 개입할 수 있다.
- 마지막에 Synthesizer가 최종 결론을 만든다.

## 4. 제품 이름

기본 이름은 Agent Debate Room으로 둔다.

나중에 브랜드화할 때 후보:

- Agent Roundtable
- Debate Harness
- AI Council
- Codex Debate Room

## 5. 대상 사용자

초기 대상 사용자는 다음과 같다.

- AI 에이전트 워크플로우를 실험하는 개인 사용자
- 제품/개발 결정을 AI들과 토론해보고 싶은 빌더
- Codex, OpenClaw, Claude Code 같은 도구를 조합해서 쓰는 파워 유저
- 의사결정 전에 찬성/반대/리스크/사용자 가치 관점을 나눠 보고 싶은 사람

초기에는 팀 협업 제품이 아니라 개인용 실험 도구로 시작한다.

## 6. 핵심 사용자 흐름

```text
1. 사용자가 토론 주제를 입력한다.
2. 사용자가 토론 템플릿을 선택한다.
3. 제품이 역할별 에이전트를 준비한다.
4. Moderator가 주제를 정리한다.
5. Builder, Skeptic, Product, Risk가 각자 발언한다.
6. 사람은 중간에 메시지를 삽입하거나 특정 역할에게 질문한다.
7. Moderator가 다음 라운드를 진행한다.
8. Synthesizer가 최종 결론을 만든다.
9. 사용자는 토론 로그와 최종 보고서를 저장한다.
```

## 7. MVP 역할 정의

### Moderator

역할:

- 토론 주제를 정리한다.
- 발언 순서를 관리한다.
- 사람의 개입을 토론 흐름에 반영한다.
- 마지막에 Synthesizer에게 정리 지시를 보낸다.

기본 말투:

- 짧고 명확하게 진행한다.
- 토론을 장황하게 늘리지 않는다.

### Builder

역할:

- 만들 수 있는 방법을 제안한다.
- 구현 가능성을 긍정적으로 본다.
- MVP를 작게 자르는 방법을 제시한다.

주의:

- 무조건 찬성하지 않는다.
- 구현 비용을 숨기지 않는다.

### Skeptic

역할:

- 허점, 리스크, 과한 범위, 애매한 가정을 지적한다.
- 반대 관점에서 질문한다.
- 사용자가 놓칠 수 있는 실패 가능성을 드러낸다.

주의:

- 비관만 하지 않는다.
- 대안을 같이 제시한다.

### Product

역할:

- 사용자 가치와 제품 경험을 본다.
- 첫 화면, 핵심 행동, 반복 사용 이유를 점검한다.
- 기능보다 사용자의 목적을 우선한다.

주의:

- 마케팅 문구보다 실제 사용 흐름을 중시한다.

### Risk

역할:

- 비용, 보안, 인증, 개인정보, 운영 복잡도를 본다.
- OpenClaw, OAuth, provider 인증, 로그 저장 위험을 점검한다.

주의:

- MVP를 막는 사람이 아니라 안전한 범위를 정하는 사람이다.

### Synthesizer

역할:

- 토론 내용을 최종 보고서로 정리한다.
- 합의된 내용과 남은 쟁점을 분리한다.
- 다음 개발 액션을 명확히 만든다.

출력 형식:

```text
결론:
근거:
반대 의견:
남은 질문:
다음 액션:
```

## 8. MVP 화면 구성

첫 화면은 제품 설명 페이지가 아니라 바로 토론방이어야 한다.

필수 영역:

- 상단: 제품 이름, 현재 토론 상태, 저장 버튼
- 왼쪽: 토론 설정
- 중앙: 역할별 채팅 로그
- 오른쪽: 현재 쟁점, 개입 기록, 최종 요약
- 하단: 사람 개입 입력창

모바일에서는 오른쪽 패널을 접고, 중앙 채팅과 하단 입력을 우선한다.

## 9. MVP 기능 범위

반드시 포함:

- 토론 주제 입력
- 역할 선택
- 토론 시작
- 라운드별 메시지 표시
- 사람 개입 메시지 추가
- 특정 역할에게 질문
- 전체 토론에 지시
- 최종 결론 생성
- 토론 로그 저장

이번 버전에서 제외:

- 팀 계정
- 결제
- OAuth 로그인 UI
- OpenClaw 실시간 연결
- Codex ACP 실행
- 여러 사용자가 동시에 보는 협업 기능
- 복잡한 그래프 편집기

## 10. OpenClaw 연결 방식

제품은 OpenClaw를 대체하지 않는다.

제품은 OpenClaw 위에 붙는 관찰 가능한 토론 UI다.

```text
사용자
  -> Agent Debate Room UI
    -> 제품 백엔드
      -> OpenClaw Gateway
        -> 역할별 OpenClaw session/sub-agent
          -> 모델 provider 또는 Codex ACP harness
```

OpenClaw의 역할:

- 세션 생성
- 역할별 에이전트 실행
- 메시지 전달
- 대화 기록 조회
- Codex/Claude/Gemini 같은 ACP harness 실행

제품의 역할:

- 토론 템플릿 관리
- 발언 순서 제어
- UI 표시
- 사람 개입 처리
- 토론 로그 저장
- 최종 보고서 생성

## 11. OAuth와 인증의 위치

토론하는 AI 역할 자체가 OAuth 계정인 것은 아니다.

OAuth/API key는 다음 두 경우에만 필요하다.

- 제품 백엔드가 OpenClaw Gateway에 접속할 때 필요한 인증
- OpenClaw가 OpenAI, Codex, Claude 같은 모델 provider를 호출할 때 필요한 인증

초기 MVP에서는 OAuth를 만들지 않는다.

첫 버전은 로컬 개발 환경에서 다음처럼 둔다.

```text
제품 UI -> 제품 백엔드 -> mock debate engine
```

그 다음 단계에서:

```text
제품 UI -> 제품 백엔드 -> OpenClaw Gateway
```

나중에 Codex가 실제 토론 참가자가 되면:

```text
제품 UI -> 제품 백엔드 -> OpenClaw Gateway -> Codex ACP session
```

## 12. 하네스 구조

제품 안에는 Debate Harness가 있어야 한다.

하네스는 다음을 정의한다.

- 어떤 역할이 있는가
- 각 역할의 기본 지시문은 무엇인가
- 몇 라운드로 진행하는가
- 각 라운드에서 누가 말하는가
- 사람 개입이 들어왔을 때 어떻게 반영하는가
- 최종 결과를 어떤 형식으로 만드는가

첫 하네스 이름:

```text
product-debate-v1
```

기본 라운드:

```text
Round 0: Moderator가 주제 정리
Round 1: Builder, Skeptic, Product, Risk가 1차 의견
Round 2: 각 역할이 서로의 주장에 반응
Round 3: 사람 개입 반영
Round 4: Synthesizer가 최종 결론
```

## 13. 데이터 모델 초안

### DebateSession

```ts
type DebateSession = {
  id: string;
  title: string;
  topic: string;
  status: "draft" | "running" | "paused" | "completed" | "failed";
  harnessId: string;
  roles: DebateRole[];
  messages: DebateMessage[];
  createdAt: string;
  updatedAt: string;
};
```

### DebateRole

```ts
type DebateRole = {
  id: string;
  name: string;
  description: string;
  color: string;
  provider?: "mock" | "openclaw" | "codex-acp";
  sessionKey?: string;
};
```

### DebateMessage

```ts
type DebateMessage = {
  id: string;
  sessionId: string;
  roleId: string | "human" | "system";
  round: number;
  content: string;
  status: "pending" | "streaming" | "complete" | "error";
  createdAt: string;
};
```

### HumanIntervention

```ts
type HumanIntervention = {
  id: string;
  sessionId: string;
  target: "all" | "moderator" | "builder" | "skeptic" | "product" | "risk" | "synthesizer";
  content: string;
  createdAt: string;
};
```

## 14. 개발 단계

### Phase 1: 제품 명세와 mock 하네스

목표:

- 제품 구조를 문서화한다.
- OpenClaw 없이 토론 흐름을 재현한다.

산출물:

- 이 문서
- `debate-harness.json`
- `mockDebateEngine`
- 기본 토론 UI

성공 기준:

- 사용자가 주제를 입력하면 역할별 가짜 토론이 화면에 표시된다.
- 사람이 중간에 개입 메시지를 추가할 수 있다.
- 최종 결론이 생성된다.

### Phase 2: OpenClaw Gateway 어댑터

목표:

- mock engine을 OpenClaw 연결로 교체할 수 있는 구조를 만든다.

산출물:

- `OpenClawClient`
- `createDebateSessions`
- `sendRoleMessage`
- `readSessionHistory`

성공 기준:

- 제품 백엔드에서 OpenClaw Gateway에 연결할 수 있다.
- 역할별 session을 만들 수 있다.
- 특정 역할 session에 메시지를 보낼 수 있다.

### Phase 3: 실시간 토론

목표:

- 역할별 AI 발언을 실시간으로 UI에 표시한다.

산출물:

- message streaming
- status indicator
- retry/recover UI

성공 기준:

- 실행 중인 역할, 완료된 역할, 실패한 역할이 UI에서 구분된다.
- 사람이 중간에 개입하면 다음 라운드에 반영된다.

### Phase 4: Codex ACP 역할

목표:

- Codex를 토론 참가자로 추가한다.

예시 역할:

- Codex Engineer
- Codex Reviewer

성공 기준:

- Codex ACP session이 특정 주제나 코드베이스를 보고 의견을 낸다.
- 일반 토론 역할과 같은 채팅 UI에 표시된다.

## 15. 기술 스택 기본값

초기 추천:

- Frontend: Next.js + TypeScript
- UI foundation: assistant-ui + shadcn/ui
- Styling: Tailwind CSS
- Backend: Next.js Route Handlers 또는 작은 Node server
- Local storage: JSON file 또는 SQLite
- Later DB: SQLite -> Postgres
- Realtime: Server-Sent Events 또는 WebSocket
- OpenClaw integration: Gateway WebSocket/RPC adapter

선택 이유:

- OpenClaw Gateway 연결을 나중에 붙이기 쉽다.
- UI와 백엔드를 한 프로젝트에서 빠르게 만들 수 있다.
- mock engine에서 실제 engine으로 교체하기 쉽다.
- assistant-ui는 AI chat UI, streaming, interruption, retry, multi-turn conversation에 맞는 React UI 기반이다.
- shadcn/ui는 제품 화면의 버튼, 입력, 패널, 탭, 드롭다운 같은 기본 컴포넌트를 빠르게 구성하기 좋다.

오픈소스 UI 사용 방침:

- Magentic-UI는 제품 철학과 human-in-the-loop UX의 레퍼런스로 사용한다.
- AutoGen Studio는 multi-agent workflow 설정/실행 화면의 참고 자료로만 사용한다.
- 실제 MVP 구현은 assistant-ui와 shadcn/ui를 기반으로 새 제품 화면을 만든다.
- OpenClaw 연결은 UI 라이브러리와 분리된 adapter 계층으로 붙인다.

## 16. 첫 구현 파일 구조

```text
agent-debate-room/
  PRODUCT_PLAN.md
  debate-harness.json
  package.json
  src/
    app/
      page.tsx
      api/
        debate/
          route.ts
    components/
      DebateRoom.tsx
      RolePanel.tsx
      MessageList.tsx
      InterventionBox.tsx
      SummaryPanel.tsx
    lib/
      debate/
        mockDebateEngine.ts
        harness.ts
        types.ts
      openclaw/
        OpenClawClient.ts
        types.ts
```

## 17. 테스트 계획

Phase 1 테스트:

- 빈 주제로 시작하려고 하면 에러가 표시된다.
- 정상 주제를 입력하면 토론이 시작된다.
- 역할별 메시지가 순서대로 표시된다.
- 사람이 중간에 메시지를 넣으면 채팅 로그에 표시된다.
- 최종 결론이 생성된다.

Phase 2 테스트:

- OpenClaw Gateway가 꺼져 있으면 연결 실패 메시지가 나온다.
- Gateway가 켜져 있으면 세션 생성 요청이 성공한다.
- 특정 역할에게 메시지를 보내면 응답을 받을 수 있다.
- 실패한 역할만 재시도할 수 있다.

Phase 3 테스트:

- 긴 응답도 UI가 멈추지 않는다.
- 사용자가 토론 중지 버튼을 누르면 다음 라운드가 멈춘다.
- 재시도 후 중복 메시지가 생기지 않는다.

## 18. 주요 리스크

### AI 발언이 너무 장황해질 수 있음

대응:

- 역할별 발언 길이를 제한한다.
- Moderator가 각 라운드 목표를 짧게 준다.

### 사람이 개입했을 때 토론 흐름이 깨질 수 있음

대응:

- 모든 개입은 Moderator를 통해 다음 라운드 지시로 반영한다.
- 특정 역할에게 직접 보낸 메시지도 토론 로그에 남긴다.

### OpenClaw 연결이 처음부터 복잡할 수 있음

대응:

- Phase 1은 mock engine으로 만든다.
- OpenClaw는 adapter 계층으로만 붙인다.

### 숨은 추론을 보여주려는 제품으로 오해될 수 있음

대응:

- 이 제품은 공개 가능한 역할 발언만 보여준다.
- 내부 chain-of-thought나 비공개 추론 노출을 목표로 하지 않는다.

## 19. 개발자가 바로 시작할 첫 작업

첫 PR 또는 첫 작업 단위:

```text
Agent Debate Room Phase 1 scaffold
```

할 일:

- Next.js 프로젝트 생성
- `debate-harness.json` 작성
- 타입 정의 작성
- mock debate engine 작성
- 단일 페이지 토론 UI 작성
- 사람이 메시지 삽입하는 기능 작성

완료 기준:

- `npm run dev`로 로컬 실행 가능
- 토론 주제 입력 후 mock 토론이 진행됨
- 사람 개입 메시지가 로그에 들어감
- 최종 결론 영역이 표시됨

## 20. 현재 결정된 기본값

- 제품은 OpenClaw 위에 붙는 별도 제품으로 만든다.
- 토론 규칙은 제품 안의 Debate Harness가 관리한다.
- OpenClaw는 실행 엔진으로 사용한다.
- 역할 AI는 OAuth 계정이 아니라 session/sub-agent다.
- OAuth/API key는 Gateway 또는 model provider 인증에만 사용한다.
- 첫 개발은 mock engine으로 시작한다.
- 첫 UI는 토론방 자체이며 랜딩 페이지를 만들지 않는다.
- 첫 대상은 개인 파워 유저다.
