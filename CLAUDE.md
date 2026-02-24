# iDrawBook - 개발 가이드

고성능 웹 기반 드로잉 애플리케이션으로, 프리미엄 Apple 스타일 디자인을 갖추고 있습니다. 본 문서는 이 프로젝트를 작업하는 개발자와 AI 어시스턴트를 위한 필수 정보를 제공합니다.

---

## 1. 프로젝트 개요

**프로젝트명**: iDrawBook
**버전**: 0.2.0
**유형**: 현대식 웹 애플리케이션 (ES Module)
**목적**: 멀티페이지 지원, Google Drive 통합, 실시간 렌더링을 갖춘 디지털 드로잉 및 아트북 제작

---

## 2. 기술 스택

### 핵심 기술
- **언어**: TypeScript 5.9+ (strict 모드 활성화)
- **런타임 대상**: ES2022
- **빌드 도구**: Vite 7.3+
- **모듈 시스템**: ES Modules (ESM)

### 테스트 및 품질 보증
- **테스트 프레임워크**: Vitest 4.0+
- **커버리지 도구**: @vitest/coverage-v8
- **DOM 테스트**: jsdom 28.1+

### 런타임 의존성
- **pdfjs-dist** (5.4.624): PDF 렌더링 및 조작
- **jspdf** (4.1.0): PDF 생성

### 개발 환경 설정
```bash
npm install          # 의존성 설치
npm run dev          # Vite 개발 서버 시작
npm run build        # 프로덕션 번들 빌드 (tsc 먼저 실행)
npm run preview      # 프로덕션 빌드 로컬 미리보기
npm run test         # 테스트 실행
npm run coverage     # 커버리지 리포트 포함 테스트 실행
```

---

## 3. 프로젝트 구조

### 디렉토리 레이아웃
```
src/
├── main.ts                      # 애플리케이션 진입점
├── style.css                    # 전역 스타일시트
├── config.ts                    # APP_CONFIG: 팔레트, UI 설정
├── history.ts                   # HistoryManager (실행 취소/다시 실행)
├── google.ts                    # GoogleService & APIs
│
├── canvas/                      # 캔버스 및 매니저
│   ├── canvas-manager.ts        # 메인 캔버스 오케스트레이터
│   ├── page-manager.ts          # 멀티페이지 관리
│   ├── tool-manager.ts          # 도구 활성화/전환
│   ├── input-manager.ts         # 이벤트 위임 (포인터, 키보드)
│   ├── renderer.ts              # 렌더링 파이프라인 & 뷰포트 컬링
│   └── types.ts                 # Page & ICanvasContext 인터페이스
│
├── tools/                       # 드로잉 도구 (다형성)
│   ├── itool.ts                 # ITool 인터페이스 정의
│   ├── base-tool.ts             # AbstractBaseTool 클래스
│   ├── freehand-tool.ts         # 펜/브러시 드로잉
│   ├── shape-tool.ts            # 도형 (사각형, 원, 선)
│   ├── text-tool.ts             # 텍스트 렌더링 & 편집
│   ├── fill-tool.ts             # 버킷 채우기 (플러드 필)
│   ├── hand-tool.ts             # 팬/줌 캔버스 네비게이션
│   ├── tool-utils.ts            # 공유 유틸리티 함수
│   ├── types.ts                 # DrawingTool, Point, ToolConfig
│   └── index.ts                 # 도구 내보내기
│
├── actions/                     # 드로잉 액션 (실행 취소/다시 실행용)
│   ├── types.ts                 # DrawingAction 인터페이스
│   ├── shape-action.ts          # 도형 드로잉 액션
│   ├── stroke-action.ts         # 스트로크/손그리기 액션
│   ├── fill-action.ts           # 채우기 도구 액션
│   ├── text-action.ts           # 텍스트 렌더링 액션
│   └── index.ts                 # 액션 내보내기
│
├── ui/                          # 사용자 인터페이스 & DOM 관리
│   ├── ui-manager.ts            # 중앙 UI 오케스트레이터
│   ├── modals.ts                # 모달 다이얼로그 & 사용자 입력
│   ├── modal-templates.ts       # 모달 HTML 템플릿
│   ├── palette.ts               # 색상 선택 및 팔레트 UI
│   ├── tool-state.ts            # 도구 옵션 패널
│   ├── google-ui.ts             # Google 로그인/파일 컨트롤
│   ├── preview.ts               # 페이지 미리보기 썸네일
│   ├── toast.ts                 # 토스트 알림
│   ├── icon-injector.ts         # SVG 아이콘 주입 시스템
│   └── svg-icons.ts             # 아이콘 정의
│
├── workers/                     # 웹 워커 (비동기 작업)
│   ├── flood-fill.worker.ts     # 플러드 필 알고리즘 (워커 스레드)
│   ├── flood-fill.core.ts       # 플러드 필 핵심 로직
│   └── [필요시 추가 워커]
│
└── tests/                       # 단위 및 통합 테스트
    └── *.test.ts                # 테스트 파일 (함께 배치 전략)
```

### 주요 아키텍처 레이어

1. **매니저 레이어** (`canvas/`): 캔버스 상태, 도구, 페이지, 렌더링을 오케스트레이션
2. **도구 레이어** (`tools/`): ITool 인터페이스를 구현하는 다형성 드로잉 도구
3. **액션 레이어** (`actions/`): 실행 취소/다시 실행을 위한 재생 가능한 드로잉 명령
4. **UI 레이어** (`ui/`): DOM 조작, 모달, 팔레트, 도구 옵션
5. **워커 레이어** (`workers/`): 오프로드된 계산 (플러드 필 등)
6. **히스토리 레이어** (`history.ts`): 실행 취소/다시 실행 스택 관리 (스냅샷 포함)

---

## 4. 핵심 컴포넌트 & 인터페이스

### 캔버스 시스템
- **ICanvasContext**: 캔버스 상태 접근을 위한 중앙 인터페이스
  - 포함: canvas, context, pages, tools, history manager 참조
  - 제공: render(), redraw(), screenToWorld(), worldToScreen(), pushAction()

- **CanvasManager**: 메인 오케스트레이터
  - 캔버스 라이프사이클, 페이지 생성/삭제, 도구 전환 관리
  - 줌, 팬, 렌더링 파이프라인 처리
  - HistoryManager와 통합하여 실행 취소/다시 실행 지원
  - 성능을 위한 뷰포트 컬링 구현

- **PageManager**: 멀티페이지 문서 지원
  - 고유 ID를 가진 페이지 생성/삭제
  - 페이지 메타데이터 유지 (위치, 치수)
  - 활성 페이지 추적

- **ToolManager**: 도구 라이프사이클 관리
  - 도구 활성화/비활성화
  - 포인터 이벤트를 활성 도구로 위임
  - 도구 상태 UI 업데이트 관리

### 도구 시스템
- **ITool 인터페이스**: 표준 도구 계약
  ```typescript
  onDown(e: PointerEvent, worldPos: Point, targetPage: Page | null): void | Promise<void>
  onMove(e: PointerEvent, worldPos: Point, targetPage: Page | null): void | Promise<void>
  onUp(e: PointerEvent, worldPos: Point, targetPage: Page | null): void | Promise<void>
  activate(): void
  deactivate(): void
  cancel(): void
  ```

- **BaseTool**: 공통 도구 로직을 구현하는 추상 기본 클래스
- **도구 구현**: 손그리기, 도형, 텍스트, 채우기, 핸드 (팬/줌)

### 액션 시스템
- **DrawingAction**: 실행 취소/다시 실행을 위한 범용 액션 인터페이스
  - 포함: execute(), revert() 또는 스냅샷 기반 재생
  - 액션은 히스토리에 푸시되어 재생됨

### 히스토리 시스템
- **HistoryManager**: 스냅샷 최적화를 통한 실행 취소/다시 실행
  - 전체 재그리기 지연을 방지하기 위해 50개 액션마다 스냅샷
  - 스냅샷에서 증분 재그리기 지원

---

## 5. 코딩 컨벤션

### 파일 네이밍
- **파일**: 소문자 kebab-case (예: `canvas-manager.ts`, `freehand-tool.ts`)
- **클래스**: PascalCase (예: `CanvasManager`, `FreehandTool`)
- **인터페이스**: PascalCase (선택적 I 접두사, 예: `ITool`, `ICanvasContext`)
- **함수**: camelCase (예: `updatePreview`, `generatePalette`)
- **상수**: UPPER_SNAKE_CASE (예: `APP_CONFIG`, `PALETTE_SETTINGS`)

### TypeScript 표준
- **Strict 모드**: 전역 활성화
  - 모든 변수는 명시적 타입 필요
  - 암시적 `any` 불허
  - Null/undefined 안전성 강제

- **타입 정의**:
  - 객체 계약에는 `interface` 사용
  - 유니온, 원시형, 복잡한 타입에는 `type` 사용
  - 타입을 구현과 함께 배치하거나 전용 `types.ts` 파일 유지

- **임포트**:
  - ES6 `import/export` 문법 사용
  - 트리 쉐이킹을 위해 네임드 익스포트 선호
  - 임포트 그룹화: 외부 → 깊은 상대 → 얕은 상대

### 코드 스타일
- **들여쓰기**: 2칸 (tsconfig에서 강제)
- **줄 길이**: 하드 제한 없음, 필요시 100자 이하 유지
- **세미콜론**: 필수 (tsconfig `verbatimModuleSyntax`에서 강제)
- **따옴표**: 싱글 따옴표 문자열 (프로젝트 표준)

### 주석 & 문서화
- **자명한 코드**: 주석보다 명확한 네이밍 선호
- **복잡한 로직**: "무엇"이 아닌 "왜"를 설명하는 인라인 주석 추가
- **TODO/FIXME**: 미완성 작업을 `// TODO:` 또는 `// FIXME:` 주석으로 표시
- **피해야 할 것**: 낡은/스캐폴딩 주석 (예: `// ... Overlay 생성 메서드 ...`)

### Null 안전 & 에러 핸들링
- 역참조하기 전에 항상 null 확인
- 옵셔널 체이닝 (`?.`)과 nullish coalescing (`??`) 사용
- 시스템 경계에서만 검증 (사용자 입력, 외부 API)
- 비동기 작업에는 try/catch 사용

### 테스트
- **테스트 파일**: `src/tests/`에 함께 배치, `.test.ts` 접미사
- **커버리지**: 매니저, 도구, UI 컴포넌트에서 높은 커버리지 목표
- **테스트 패턴**: Arrange → Act → Assert
- **Mocking**: DOM 테스트에 jsdom 사용, 외부 API 목킹 (Google Drive 등)

---

## 6. 중요한 디자인 패턴

### 매니저 패턴
핵심 매니저 (CanvasManager, PageManager, ToolManager)들이 서브시스템을 조정:
- 각 매니저는 단일 책임 원칙 준수
- 매니저는 외부 사용을 위해 공개 API 노출
- 내부 상태 변경은 콜백 트리거 (예: `onUpdateCallback`)

### 도구 다형성
모든 도구는 `ITool` 인터페이스 구현:
- `activate()`/`deactivate()`는 설정/정리용
- `onDown()`, `onMove()`, `onUp()`은 이벤트 처리용
- `InputManager`를 통한 통일된 이벤트 위임

### 액션 재생
드로잉 액션은 저장되어 실행 취소/다시 실행을 위해 재생:
- 액션은 생성 후 불변
- 히스토리 스냅샷은 재그리기 성능 최적화
- 뷰포트 컬링은 오프스크린 콘텐츠 렌더링 방지

### 아이콘 주입
SVG 아이콘은 `icon-injector.ts`를 통해 DOM에 동적으로 주입:
- 아이콘은 `svg-icons.ts`에 정의
- 앱 초기화 중 한 번 주입
- CSS 클래스 토글로 업데이트 (예: `updateOrientationIcons()`)

---

## 7. 성능 고려 사항

### 렌더링 최적화
- **뷰포트 컬링**: 보이는 페이지만 렌더링 (`renderer.ts`에서 구현)
- **오프스크린 캔버스**: 페이지 외 렌더링에 오프스크린 캔버스 사용
- **스냅샷 전략**: 50개 액션마다 스냅샷하여 실행 취소/다시 실행 중 재그리기 지연 감소
- **배치 DOM 업데이트**: UI 요소를 단일 작업으로 업데이트

### 비동기 작업
- **웹 워커**: 비용이 큰 계산에 사용 (예: 플러드 필)
- **비동기 도구**: 도구는 논블로킹 작업을 위해 `Promise<void>` 반환 가능
- **지연 렌더링**: 복잡한 작업은 렌더링 호출 지연

### 알려진 병목 (CODE_REVIEW_REPORT.md 참조)
- 팔레트 및 도구 상태 업데이트에서 빈번한 DOM 쿼리
- Google API 초기화는 폴링 사용 (Promise 기반 로더로 마이그레이션 권장)
- 큰 실행 취소/다시 실행 스택은 눈에 띄는 지연 초래 가능

---

## 8. 일반적인 작업 & 패턴

### 새 도구 추가
1. `src/tools/[tool-name]-tool.ts` 생성 및 `BaseTool` 확장
2. `ITool` 인터페이스 메서드 구현
3. `ToolManager.getTools()`에 도구 추가
4. 필요시 `tool-state.ts`에 UI 옵션 생성
5. `src/tests/`에 테스트 파일 추가

### 드로잉 액션 추가
1. `src/actions/[action-type]-action.ts` 생성
2. `DrawingAction` 인터페이스 구현
3. `actions/index.ts`에 등록
4. 히스토리에서 액션이 올바르게 재생되는지 확인

### 캔버스 상태 수정
1. `canvasManager.pushAction(action)`을 통해 변경 푸시
2. HistoryManager가 실행 취소/다시 실행 처리하도록 허용
3. `onUpdateCallback`을 통해 UI 업데이트 트리거

### 멀티페이지 문서 작업
1. `PageManager.createPage()` / `deletePage()` 사용
2. 활성 페이지 가져오기: `canvasManager.getActivePageId()`
3. 활성 페이지 설정: `canvasManager.setActivePageId(id)`
4. 페이지 반복: `canvasManager.getPages()` (Map<id, Page>)

---

## 9. Git & 커밋 컨벤션

### 브랜치 네이밍
- 기능: `feat/[feature-description]`
- 버그 수정: `fix/[bug-description]`
- 리팩토링: `refactor/[area-name]`
- 테스트: `test/[coverage-area]`

### 커밋 메시지
- 형식: `<type>: <description>`
- 타입: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- 예시:
  - `feat: 멀티페이지 문서 지원 추가`
  - `fix: 뷰포트 컬링 계산 수정`
  - `test: 플러드 필 워커 커버리지 증가`

---

## 10. 유용한 리소스 & 참고자료

### 내부 문서
- `CODE_REVIEW_REPORT.md`: 구조 분석, 성능 리뷰, 코드 품질 평가
- `tsconfig.json`: TypeScript 컴파일러 옵션 (strict, no unused 등)
- `vite.config.ts`: 빌드 설정 (있을 경우)

### 먼저 이해해야 할 핵심 파일
1. `src/canvas/canvas-manager.ts` - 핵심 오케스트레이터
2. `src/tools/itool.ts` - 도구 인터페이스
3. `src/history.ts` - 실행 취소/다시 실행 메커니즘
4. `src/canvas/renderer.ts` - 렌더링 파이프라인

### 외부 라이브러리
- **pdfjs-dist**: PDF 렌더링 (`google.ts` 통합 예시 참조)
- **jspdf**: 내보내기용 PDF 생성

---

## 11. 알려진 이슈 & 향후 개선 사항

`CODE_REVIEW_REPORT.md`의 자세한 분석 참조:

### 높은 우선순위
- `main.ts` 리팩토링으로 God Object 복잡성 감소 (컴포넌트 컨트롤러로 분리)
- ESLint + Prettier 추가하여 자동화된 코드 정리
- Google API 로딩을 폴링에서 Promise 기반 접근으로 마이그레이션

### 중간 우선순위
- DOM 조작 효율성 개선 (팔레트, 도구 상태 빈번한 업데이트)
- 매우 큰 액션 스택에 대한 실행 취소/다시 실행 성능 최적화
- 아이콘 관리 향상 (SVG 컴포넌트 접근 고려)

### 낮은 우선순위
- 스캐폴딩 주석 정리
- 중복 로직 통합 (예: main.ts의 툴바 토글 로직)
- HTML의 하드코딩된 TODO 텍스트 제거/리팩토링

---

## 12. 도움말

- **코드 구조에 대한 질문?** 관련 매니저 또는 도구 클래스 검토
- **타입 문제?** 각 디렉토리의 `types.ts` 파일 확인
- **성능 우려?** 섹션 7 및 CODE_REVIEW_REPORT.md 참조
- **테스트?** `src/tests/`에서 패턴 및 기존 테스트 구조 확인
