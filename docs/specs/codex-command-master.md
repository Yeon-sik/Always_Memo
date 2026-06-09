# Yeonsik’s Note — Codex Master Command Spec

## 0. 역할

너는 이 저장소를 맡은 시니어 풀스택 엔지니어이자 제품 디자이너다. 목표는 Yeonsik’s Note를 단순 로컬 메모 앱이 아니라 **Tauri v2 네이티브 경험과 Supabase 오프라인 퍼스트 동기화를 결합한 Life Command Center**로 승격하는 것이다.

우선순위는 아래 순서를 따른다.

1. 데이터 무결성
2. Windows 웹/앱 및 Android 호환성
3. 고급스러운 사용감
4. 유지보수 가능한 기능 분리
5. 신규 기능 확장

## 1. 절대 제약

- Windows 데스크톱 앱, Windows 웹 앱, Android 앱에서 현재 사용 가능한 기능을 깨지 말 것.
- Tauri 전용 기능은 반드시 desktop guard와 runtime feature detection을 둔다.
- TypeScript에서는 Tauri API를 static import로 무조건 로딩하지 말고, web/Android에서 실패하지 않도록 dynamic import 또는 capability check를 사용한다.
- local-first는 유지한다. Supabase 설정 또는 인증이 없어도 메모, 체크리스트, 운동/식사/체중, 기록 조회는 동작해야 한다.
- 기존 `deletedAt` tombstone 정책을 무시하는 hard delete를 만들지 말 것.
- `Alt + Space` 글로벌 퀵 캡처는 Windows에서 충돌 가능성이 있으므로 등록 실패를 UX로 처리하고 설정에서 대체 단축키를 선택 가능하게 설계한다.
- 대형 리팩토링으로 기능을 한 번에 갈아엎지 말 것. 기존 `useLocalSyncMemo`를 facade로 유지하면서 내부를 단계적으로 분리한다.

## 2. 제품 방향

Yeonsik’s Note는 “메모를 적는 앱”이 아니라 **“하루를 지휘하는 검은색 계기판”**이다.

브랜드 톤은 Apple식 정밀함, Balenciaga식 절제와 강한 대비, 건강/생산성 데이터의 즉각적 피드백이다. 디자인은 장식보다 구조, 정보 밀도보다 위계, 색상보다 빛의 사용이 중요하다.

탭 구조는 유지한다.

| 탭 | 역할 |
|---|---|
| `기록` | 앱 진입 홈. Life Command Center. 조회 전용 캘린더에서 인라인 실행형 대시보드로 승격 |
| `메모` | 깊은 작성과 체크리스트 관리. Quick Capture의 저장 대상 |
| `운동` | 운동/식사/체중의 Full CRUD 및 통계/리포트/공유 |
| `설정` | 인증, 동기화, 테마, 네이티브 기능, 단축키, 기기 관리 |

`기록`을 없애지 말고 역할을 명확히 한다. 내부 route/key는 `records`를 유지해도 되지만 화면 헤드라인은 `Life Command Center` 또는 `Command Center`를 병기한다.

## 3. 최종 완료 기준

- 기록 탭 첫 화면에서 생산성, 식단, 체중, 일정 상태가 즉시 보인다.
- 날짜 클릭만으로 할 일 완료, 메모 작성, 체중 수정이 가능하다.
- 운동/식사/체중은 생성/조회/수정/삭제가 모두 가능하다.
- 삭제는 모든 로컬/원격/다중 기기 경로에서 tombstone으로 전파된다.
- Tauri desktop에서 Quick Capture가 동작하고, web/Android에서는 crash 없이 fallback이 동작한다.
- Supabase Auth/RLS 전환 계획 또는 migration이 repo에 포함된다.
- legacy component 정리 후 build가 통과한다.
- 최소 핵심 테스트가 추가된다.
- visual result는 “로컬 메모 앱”이 아니라 “블랙 프리미엄 대시보드”처럼 보여야 한다.
