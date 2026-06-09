# Spec - 빠른 작업 확장

## 1. 목적

빠른 작업은 기록 탭의 선택 날짜에서 즉시 기록을 추가하는 날짜 문맥 입력 레이어다.

이 명세의 목적은 빠른 작업을 `할 일 / 메모 / 체중` 중심에서 `운동 / 식단`까지 확장하되, 기존 탭 구조의 의미를 없애지 않도록 역할 경계를 정의하는 것이다.

## 2. 제품 원칙

빠른 작업은 전체 기능 탭이 아니다.

```text
Quick Capture = 앱 전역 즉시 캡처
빠른 작업 = 선택 날짜 기준 quick add
각 탭 = 깊은 편집, 정리, 통계, export, 관리
```

빠른 작업은 사용자가 기록 탭에서 날짜를 보고 있을 때, 화면 이동 없이 짧은 입력을 끝내기 위한 기능이다.

반대로 각 탭은 해당 데이터의 깊은 작업을 담당한다.

## 3. 탭별 책임 경계

| 영역 | 주 책임 | 하지 말아야 할 일 |
|---|---|---|
| Quick Capture | 앱 어디서든 오늘 할 일/메모를 즉시 캡처 | 운동/식단/체중 상세 입력 |
| 기록 탭 빠른 작업 | 선택 날짜에 기록을 빠르게 추가 | 장기 관리, 복잡한 분석, 대량 편집 |
| 기록 탭 날짜 상세 | 선택 날짜의 전체 기록 조회, 삭제, 간단 수정 | 탭 수준 통계/리포트 대체 |
| 메모 탭 | 긴 글 작성, 메모 정리, 검색, 깊은 편집 | 날짜별 전체 생활 입력 대체 |
| 할 일 탭 | 일정, 정렬, 반복, 우선순위, 완료 관리 | 순간 캡처 대체 |
| 운동 탭 | 운동/식단/체중의 상세 CRUD, 통계, export | 기록 탭의 날짜 quick add 대체 |
| 설정 탭 | 동기화, 기기, 단축키, 환경 설정 | 생활 기록 입력 |

## 4. 빠른 작업 범위

빠른 작업은 다음 5개 섹션을 제공한다.

```text
할 일
메모
체중
운동
식단
```

각 섹션은 짧은 입력으로 저장 가능한 최소 필드만 가진다.

## 5. 입력 깊이 기준

빠른 작업에 들어갈 수 있는 입력은 다음 조건을 만족해야 한다.

```text
선택 날짜가 자동으로 적용된다.
3~5개 필드 안에서 저장할 수 있다.
저장 후 즉시 목록에 반영된다.
상세 수정은 각 탭 또는 날짜 상세로 넘긴다.
Android/narrow width에서 bottom sheet 안에 들어갈 수 있다.
```

빠른 작업에 넣지 않는 항목:

```text
반복 일정 설정
운동 루틴 빌더
세트/횟수/중량 상세 기록
식단 템플릿 관리
장기 통계/리포트 설정
대량 수정
Supabase 계정/동기화 설정
```

## 6. Quick Capture와의 차이

Quick Capture는 속도 우선 전역 캡처다.

정책:

```text
앱 어느 화면에서든 열린다.
기본 저장 날짜는 오늘이다.
선택된 캘린더 날짜의 영향을 받지 않는다.
할 일/메모 중심으로 유지한다.
Tauri desktop shortcut/tray fallback과 연결된다.
```

빠른 작업은 날짜 문맥 입력이다.

정책:

```text
기록 탭의 선택 날짜에서 열린다.
선택 날짜에 기록을 저장한다.
오늘 날짜에서는 일반 quick add로 동작한다.
지난 날짜에서는 누락 보강 모드로 동작한다.
미래 날짜에서는 실제 수행 기록을 막는다.
```

## 7. 날짜별 동작 정책

| 선택 날짜 | 빠른 작업 상태 | 저장 정책 |
|---|---|---|
| 오늘 | `빠른 작업` 버튼 표시 | 일반 기록으로 저장 |
| 지난 날짜 | `누락 보강` 버튼 표시 | `isBackfilled: true`로 저장 |
| 미래 날짜 | 실제 수행 기록 입력 비활성 | 할 일 예약/일정성 메모만 허용 가능 |

지난 날짜에서는 일반 빠른 작업 버튼을 보여주지 않는다.

지난 날짜에 새 항목을 추가하려면 사용자가 명시적으로 `누락 보강`을 선택해야 한다.

확인 문구:

```text
지난 날짜에 기록을 추가합니다. 이 항목은 누락 보강으로 표시됩니다.
```

## 8. 빠른 작업 UI 구조

빠른 작업은 modal/bottom sheet 내부에 5개 섹션을 한 번에 길게 나열하지 않는다.

권장 구조:

```text
상단: 날짜, 모드, 닫기
중단: segmented control 또는 compact tabs
하단: 선택 섹션의 입력 폼
```

섹션 순서:

```text
할 일
메모
체중
운동
식단
```

Android/narrow width에서는 bottom sheet 안에서 섹션 전환이 가능해야 한다.

Desktop에서는 compact premium overlay 형태를 유지한다.

## 9. 섹션별 입력 필드

### 9.1 할 일

필드:

```text
할 일 내용
```

저장:

```text
addTask(text, selectedDate, null, optionalBackfillInput)
```

상세 기능은 할 일 탭으로 넘긴다.

```text
시간 지정
반복
우선순위
정렬
```

### 9.2 메모

필드:

```text
제목
내용
```

키보드:

```text
Enter = 저장
Shift+Enter = 줄바꿈
Esc = 닫기
```

저장:

```text
addNoteForDate(selectedDate, title, content, optionalBackfillInput)
```

긴 글 편집, 검색, 메모 정리는 메모 탭으로 넘긴다.

### 9.3 체중

필드:

```text
체중 kg
```

검증:

```text
0보다 큰 숫자만 저장
```

저장:

```text
addWeightRecord(selectedDate, weightKg, optionalBackfillInput)
```

동일 날짜에 기존 체중 기록이 있더라도 자동 hard overwrite하지 않는다.

권장 UX:

```text
이미 체중 기록이 있으면 "오늘 체중 기록이 이미 있습니다."를 표시한다.
사용자는 추가 저장 또는 기존 기록 상세 편집 중 하나를 선택한다.
```

### 9.4 운동

빠른 작업 운동 입력은 FitnessPanel 전체 폼을 복사하지 않는다.

필드:

```text
운동 유형: 근력 / 유산소 / 기타
근력: 부위 1개 이상
유산소: 유산소 종류
기타: 운동명
선택 메모 또는 짧은 설명
```

MVP 저장 정책:

```text
근력에서 여러 부위를 선택하면 부위별 workout record를 생성한다.
유산소는 선택한 유산소 종류를 category/exerciseName에 저장한다.
기타는 category = "기타", exerciseName = 사용자가 입력한 운동명으로 저장한다.
```

저장:

```text
addWorkoutRecord(...)
addWorkoutRecords(...)
```

빠른 작업에 넣지 않는 상세:

```text
세트
횟수
중량
휴식 시간
루틴 관리
운동 템플릿
```

이 상세 입력은 운동 탭의 향후 확장 영역이다.

### 9.5 식단

필드:

```text
메뉴
칼로리
단백질 g
탄수 g 선택
지방 g 선택
```

검증:

```text
메뉴 필수
칼로리 0 이상 숫자 필수
단백질 0 이상 숫자 필수
탄수/지방은 비어 있거나 0 이상 숫자
```

저장:

```text
addMealRecord(selectedDate, menu, calories, proteinGrams, carbsGrams, fatGrams, optionalBackfillInput)
```

식단 템플릿, 식사별 분류, 장기 영양 분석은 운동 탭의 식단 관리 영역으로 넘긴다.

## 10. 누락 보강 모드

빠른 작업과 누락 보강은 같은 입력 UI를 재사용한다.

차이:

```text
빠른 작업 = 오늘 날짜 일반 기록
누락 보강 = 지난 날짜 보정 기록
```

누락 보강 모드에서 저장되는 모든 새 기록은 다음 메타데이터를 가진다.

```ts
{
  isBackfilled: true,
  backfilledAt: nowIso(),
  backfillReason: "past-date-correction"
}
```

UI 표시:

```text
누락 보강
지난 날짜에 빠진 기록만 보강으로 추가합니다.
```

저장 후 날짜 상세 항목에는 `누락 보강` 라벨을 표시한다.

## 11. 기존 탭의 역할 강화

빠른 작업이 확장되면 각 탭은 단순 입력 폼을 넘어서야 한다.

### 11.1 메모 탭

강화 방향:

```text
검색
정렬
긴 글 편집
날짜별 연결
중요 메모 표시
```

### 11.2 할 일 탭

강화 방향:

```text
일정 관리
반복 할 일
우선순위
드래그 정렬
완료 이력
```

### 11.3 운동 탭

강화 방향:

```text
운동/식단/체중 상세 CRUD
기간 통계
Markdown export
누락 보강 포함 여부 표시
운동 분류 관리
식단 템플릿
체중 추이 분석
```

## 12. 데이터 정책

빠른 작업은 기존 local-first 정책을 그대로 따른다.

필수 조건:

```text
Supabase가 없어도 저장된다.
deletedAt tombstone 정책을 유지한다.
Tauri API를 직접 import하지 않는다.
useLocalSyncMemo.ts는 facade로 유지한다.
저장 action은 기존 note/task/fitness service를 재사용한다.
```

삭제 정책:

```text
빠른 작업 내부에서는 삭제를 담당하지 않는다.
삭제는 날짜 상세 목록 또는 각 탭에서 수행한다.
삭제는 hard delete가 아니라 deletedAt tombstone으로 처리한다.
```

## 13. 접근성 및 키보드

필수:

```text
Esc로 닫기
focus trap 유지
닫은 뒤 원래 버튼으로 focus 복귀
Enter 저장
메모 textarea에서는 Shift+Enter 줄바꿈
섹션 전환은 키보드로 가능
```

모바일:

```text
bottom sheet
입력 필드가 키보드에 가려지지 않음
버튼 텍스트가 줄바꿈/잘림 없이 표시
```

## 14. 구현 권장 파일

기존 위치를 유지한다.

```text
src/features/command-center/quickActions/QuickActionOverlay.tsx
src/features/command-center/quickActions/QuickActionTaskList.tsx
src/features/command-center/quickActions/QuickActionMemoEditor.tsx
src/features/command-center/quickActions/QuickActionWeightEditor.tsx
```

신규 권장 파일:

```text
src/features/command-center/quickActions/QuickActionWorkoutEditor.tsx
src/features/command-center/quickActions/QuickActionMealEditor.tsx
src/features/command-center/quickActions/QuickActionModeTabs.tsx
src/features/command-center/quickActions/quickActionValidation.ts
```

선택:

```text
src/features/command-center/quickActions/quickActionSections.ts
```

## 15. 구현 순서

### Phase A - 구조 확장

```text
QuickActionOverlay에 section state 추가
5개 섹션 전환 UI 추가
기존 할 일/메모/체중 editor를 섹션 구조로 이동
```

### Phase B - 운동 quick add

```text
QuickActionWorkoutEditor 추가
FitnessPanel의 운동 옵션 상수 재사용
addWorkoutRecord/addWorkoutRecords 연결
오늘은 일반 기록, 지난 날짜는 누락 보강으로 저장
미래 날짜는 비활성화
```

### Phase C - 식단 quick add

```text
QuickActionMealEditor 추가
parseRequiredNumber/parseOptionalNumber 재사용 또는 quickActionValidation으로 분리
addMealRecord 연결
누락 보강 메타데이터 전달
```

### Phase D - UX 정리

```text
저장 후 선택 섹션 draft 초기화
저장 성공 microcopy
상세 편집으로 이동하는 보조 링크 검토
Android bottom sheet 높이/스크롤 검증
```

## 16. 테스트 기준

필수 테스트:

```text
오늘 날짜 빠른 작업에서 할 일/메모/체중/운동/식단을 추가할 수 있다.
지난 날짜 누락 보강에서 할 일/메모/체중/운동/식단을 추가할 수 있다.
지난 날짜 저장 항목에는 isBackfilled가 true로 들어간다.
미래 날짜에서는 운동/식단/체중 실제 기록 입력이 막힌다.
Quick Capture는 여전히 할 일/메모만 오늘 날짜로 저장한다.
삭제는 빠른 작업이 아니라 날짜 상세 또는 각 탭에서만 수행된다.
Tauri API 없는 web 환경에서 crash가 없다.
```

권장 검증:

```text
npm.cmd run test
npm.cmd run build
src-tauri에서 cargo check
desktop/web/Android narrow width 수동 확인
```

## 17. 수용 기준

이 명세가 구현되었다고 판단하려면 다음을 만족해야 한다.

```text
빠른 작업은 5개 섹션을 제공한다.
Quick Capture와 빠른 작업의 역할이 UI와 코드에서 분리되어 있다.
운동/식단 quick add는 FitnessPanel 전체를 복제하지 않는다.
각 탭은 깊은 관리/통계/정리 역할을 유지한다.
지난 날짜 입력은 누락 보강으로 저장되고 라벨이 표시된다.
미래 날짜에는 실제 수행 기록을 추가할 수 없다.
local-first, tombstone, desktop guard 원칙을 깨지 않는다.
```

