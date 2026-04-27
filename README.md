# Agent Toron

AI 에이전트들이 한 주제를 두고 토론하고, 사람이 중간에 끼어들 수 있는 로컬 MVP입니다.

## 현재 MVP 흐름

첫 화면(`/`)은 AI 연결 설정 전용입니다. OpenAI API, Anthropic Claude API, Google Gemini API, OpenRouter, Codex OAuth, OpenClaw, Ollama, Demo 중 하나를 고르고 연결 테스트를 통과하면 실제 토론 화면(`/debate_mvp.html`)으로 이동합니다.

브라우저에서 입력한 API 키는 `sessionStorage`에만 저장되고 서버 세션 파일에는 저장되지 않습니다. 배포나 공유용으로는 서버 실행 전에 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL` 같은 환경변수를 설정해 둘 수 있습니다.

여러 역할의 인공지능 에이전트가 한 주제를 두고 토론하고, 사람이 중간에 채팅처럼 끼어들 수 있는 로컬 제품입니다. 역할은 미리 고정된 목록이 아니라 사용자가 직접 이름과 설명을 정합니다. 기본 실행 엔진은 오픈클로의 `debate` 프로필이며, 코덱스와 클로드는 보조 엔진으로 선택하거나 실패 시 대체 실행됩니다. 모든 실제 엔진이 실패하면 예비 엔진으로 화면 흐름을 유지합니다.

## 바로 실행

```powershell
npm run mvp
```

브라우저에서 엽니다.

```text
http://127.0.0.1:4187
```

이 서버는 별도 패키지 설치 없이 Node 기본 모듈만으로 동작합니다. 토론 화면에서는 사용자가 궁금한 주제를 편하게 말하면 메인 에이전트와 먼저 여러 턴 대화하면서 실제로 토론할 질문을 좁힙니다. 사용자가 `토론 시작` 버튼을 누르거나 명확히 시작을 요청한 뒤에만, 사전 대화 맥락을 기준으로 서브 에이전트 역할을 배정하고 토론을 시작합니다.

간단 토론 MVP 화면은 아래 주소에서 바로 열 수 있습니다.

```text
http://127.0.0.1:4187/debate_mvp.html
```

이 화면은 먼저 `AI 연결`에서 실행 방식을 고른 뒤 시작합니다. 토론 중에는 사용자가 오른쪽 입력창으로 질문, 반론, 조건을 추가해 개입할 수 있습니다.

- `OpenAI API`: 화면에 API 키를 입력하거나 서버 실행 전에 `OPENAI_API_KEY` 환경변수를 설정합니다. 기본 모델은 `gpt-5.5`이며 화면에서 바꿀 수 있습니다.
- `Codex OAuth`: 로컬에서 `codex login` 또는 `codex login --device-auth`를 먼저 완료한 뒤 연결 테스트를 누릅니다.
- `OpenClaw`: 오픈클로 CLI와 `OPENCLAW_PROFILE` 기준 프로필이 준비되어 있어야 합니다. 기본 프로필은 `debate`입니다.
- `Demo`: API 키 없이 화면 흐름만 확인하는 예비 엔진입니다.

OpenAI API 키는 서버 세션 파일에 저장하지 않습니다. 브라우저 세션 안에서 요청할 때만 서버로 전달됩니다.

## 실행 엔진 순서

- 오픈클로 우선: 오픈클로 → 코덱스 → 클로드 → 예비 엔진
- 코덱스 우선: 코덱스 → 오픈클로 → 클로드 → 예비 엔진
- 클로드 우선: 클로드 → 코덱스 → 오픈클로 → 예비 엔진
- 예비 엔진만: 브라우저와 서버 흐름 검증용

오픈클로는 로컬 제품에 맞게 `openclaw --profile debate agent --local` 형태로 호출됩니다. 게이트웨이 채널 전송용이 아니라, 토론방 안에서 한 역할의 공개 발언을 생성하는 용도입니다.

## 오픈클로 준비

오픈클로 명령줄 도구가 설치되어 있어도 `debate` 프로필 인증이 없으면 실제 오픈클로 발언은 실패할 수 있습니다. 먼저 토론 전용 프로필을 준비하세요.

```powershell
openclaw --profile debate configure
openclaw --profile debate models status
```

비대화식 초기화가 필요한 환경에서는 오픈클로가 안내하는 위험 확인 문구를 읽고, 해당 버전의 안내에 따라 `onboard --non-interactive --accept-risk` 흐름을 사용하세요.

## 저장 위치

```text
data/sessions/
```

각 토론은 세션 JSON으로 저장됩니다. 세션에는 사용자가 만든 역할, 발언, 사람 채팅, 최종 보고서가 함께 저장됩니다. 브라우저 왼쪽의 저장된 토론 목록에서 다시 열 수 있고, 내보내기 버튼으로 마크다운 파일을 받을 수 있습니다.

## 도커 실행

```powershell
docker compose up --build
```

브라우저에서 엽니다.

```text
http://127.0.0.1:4187
```

자세한 도커 안내는 [DOCKER.md](./DOCKER.md)를 보세요.

## 개발 확인

```powershell
npm run build
```

상태 확인:

```powershell
curl http://127.0.0.1:4187/api/status
```

브라우저 화면 검증 스크린샷은 `output/playwright/complete-product.png`에 저장됩니다.
