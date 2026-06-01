# AGENTS.md

## 역할
너는 시니어 풀스택 데스크톱 앱 개발자다.
목표는 Windows 환경에서 실행되는 무료 개인용 동기화 메모/체크리스트 앱을 제작하는 것이다.

## 앱 목표
- 컴퓨터 부팅 시 자동 실행 가능
- 시스템 트레이에 상주 가능
- 메모 작성/수정/삭제
- 할 일 체크리스트 작성/완료/삭제
- 노트북과 데스크톱에서 같은 데이터 동기화
- 각 기기가 켜져 있고 앱이 실행 중일 때만 실시간 활성 상태 표시
- 인터넷이 없어도 로컬에서 작성 가능
- 인터넷 연결 시 Supabase와 동기화
- 전부 무료 플랜 기준으로 구동

## 기술 스택
- Desktop: Tauri v2
- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Local Storage: SQLite 또는 IndexedDB
- Cloud Sync: Supabase Postgres + Supabase Realtime
- Auth: Supabase Auth 또는 개발 초기에는 단일 사용자 config 방식
- Package Manager: pnpm 권장

## 핵심 설계 원칙
1. Local-first
   - 앱 실행 즉시 로컬 DB 데이터를 보여준다.
   - 클라우드 응답을 기다리지 않는다.

2. Sync-later
   - 네트워크가 없으면 로컬에 변경사항을 저장한다.
   - 네트워크가 복구되면 Supabase로 동기화한다.

3. Realtime-when-online
   - 양쪽 기기가 켜져 있고 앱이 실행 중이면 Supabase Realtime으로 즉시 반영한다.
   - 꺼져 있던 기기는 다음 실행 시 최신 데이터를 가져온다.

4. Conflict 최소화
   - 모든 row에는 updated_at을 둔다.
   - 충돌 시 MVP에서는 Last Write Wins를 사용한다.
   - 삭제는 hard delete가 아니라 deleted_at soft delete를 사용한다.

5. 무료 운영
   - 파일 첨부, 이미지 업로드, AI 기능, 대용량 로그 저장은 MVP에서 제외한다.
   - Supabase 무료 한도 초과 가능성이 있는 기능은 만들지 않는다.

## 데이터 모델 초안

### notes
- id: uuid
- user_id: uuid 또는 text
- title: text
- content: text
- updated_at: timestamptz
- deleted_at: timestamptz nullable
- device_id: text

### tasks
- id: uuid
- user_id: uuid 또는 text
- text: text
- is_done: boolean
- order_index: integer
- updated_at: timestamptz
- deleted_at: timestamptz nullable
- device_id: text

### devices
- id: text
- user_id: uuid 또는 text
- name: text
- last_seen_at: timestamptz
- app_version: text nullable

## 구현 우선순위
1. Tauri + React 기본 프로젝트 생성
2. 메모/체크리스트 UI 구현
3. 로컬 저장 구현
4. Supabase schema SQL 작성
5. Supabase 연결 설정
6. 앱 시작 시 pull sync
7. 변경 발생 시 push sync
8. Realtime 구독으로 다른 기기 변경 반영
9. heartbeat로 기기 활성 상태 표시
10. system tray 구현
11. autostart 옵션 구현
12. README 작성

## 코드 규칙
- TypeScript strict mode를 유지한다.
- 기능 단위로 파일을 분리한다.
- UI 컴포넌트와 데이터 로직을 분리한다.
- Supabase key는 .env에 둔다.
- .env.example을 제공한다.
- 에러는 콘솔에만 숨기지 말고 UI에 최소한의 상태로 표시한다.
- 임시 구현은 TODO 주석으로 남긴다.

## 금지
- 유료 API 사용 금지
- Electron 사용 금지
- 서버 직접 구축 금지
- 불필요한 백엔드 프레임워크 추가 금지
- 이미지/파일 첨부 기능 금지
- 로그인 복잡화 금지
- 과도한 디자인 작업 금지

## 완료 기준
- Windows에서 앱 실행 가능
- 메모 CRUD 가능
- 체크리스트 CRUD 가능
- 앱 재시작 후 데이터 유지
- Supabase 연결 시 다른 기기와 동기화 가능
- 앱 실행 중인 기기 상태 표시 가능
- 부팅 시 자동 실행 옵션 존재
- 트레이에서 열기/종료 가능
- README에 설치/실행/환경변수/Supabase 설정법 포함