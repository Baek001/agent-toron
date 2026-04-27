# 도커 실행 가이드

이 제품은 도커 컨테이너 안에서 로컬 웹 서버와 토론방 화면을 함께 실행합니다. 기본 이미지는 오픈클로, 코덱스, 클로드 명령줄 도구를 설치하지만, 각 도구의 인증은 사용자가 별도로 준비해야 합니다.

## 기본 실행

```powershell
docker compose up --build
```

브라우저에서 엽니다.

```text
http://127.0.0.1:4187
```

이미 4187 포트를 쓰고 있다면 다른 호스트 포트를 지정할 수 있습니다.

```powershell
$env:HOST_PORT="4188"
docker compose up --build
```

## 빠른 화면 확인

명령줄 도구 설치 없이 예비 엔진만으로 화면과 세션 저장을 확인하려면 다음처럼 빌드합니다.

```powershell
docker build --build-arg INSTALL_AI_CLIS=false -t agent-toron:mock .
docker run --rm -p 4187:4187 agent-toron:mock
```

이 모드는 실제 인공지능 엔진을 호출하지 않습니다.

## 컨테이너 안 인증

컨테이너에서 실제 엔진을 쓰려면 실행 중인 컨테이너 안에서 각 도구를 인증합니다.

```powershell
docker compose exec debate-room openclaw --profile debate configure
docker compose exec debate-room openclaw --profile debate models status
docker compose exec debate-room codex login
docker compose exec debate-room claude auth
```

오픈클로는 토론 전용 `debate` 프로필을 사용합니다. 제품 서버는 해당 프로필을 1순위로 호출하고, 준비되지 않았거나 응답이 없으면 코덱스, 클로드, 예비 엔진 순서로 이어갑니다.

## 유지되는 데이터

compose는 다음 볼륨을 사용합니다.

- `debate-data`: 토론 세션 JSON
- `debate-output`: 명령줄 도구 출력 파일
- `openclaw-debate-profile`: 오픈클로 토론 전용 프로필
- `codex-home`: 코덱스 설정
- `claude-home`: 클로드 설정

세션 파일은 컨테이너 안의 `/app/data/sessions`에 저장됩니다.

## 상태 확인

```powershell
curl http://127.0.0.1:4187/api/status
```

응답의 `engines` 항목에서 오픈클로, 코덱스, 클로드, 예비 엔진의 준비 상태를 확인할 수 있습니다. 오픈클로 설정 파일이 없으면 화면에도 토론 전용 프로필이 아직 준비되지 않았다고 표시됩니다.

## 운영 주의

이 제품은 로컬 명령줄 도구를 실행합니다. 공개 서버에 그대로 올리기보다 개인 컴퓨터나 팀 내부 환경에서 먼저 사용하세요. 인증 파일, 세션 로그, 출력 파일은 이미지에 넣지 말고 볼륨이나 별도 비밀 관리 방식으로 다루는 것이 안전합니다.
