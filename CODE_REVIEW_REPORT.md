# iDrawBook 코드 리뷰 리포트 (Code Review Report)

## 1. 개요 (Overview)
본 문서는 `idrawbook` 웹 서비스(v0.2.0)의 소스 코드를 소프트웨어 전문가 관점에서 정밀 분석한 리포트입니다. 구조적 안정성, 성능 최적화, 그리고 코드 품질을 중점적으로 검토하였습니다.

**평가 요약:**
*   **프로젝트:** idrawbook
*   **주요 기술:** TypeScript, Canvas API, Event Handling
*   **최종 점수:** **74 / 100** (▲ 2점 상승 - 이전 리뷰 대비 일부 최적화 적용됨)

---

## 2. 코드 구조 및 아키텍처 (Structure & Architecture)

### 2.1 도구 구현 패턴의 불일치 (Inconsistent Tool Pattern)
*   **현상:** `TextTool`은 별도의 클래스(`src/tools/text-tool.ts`)로 캡슐화되어 관리되지만, 펜(Pencil), 브러쉬(Brush), 지우개(Eraser) 등은 `CanvasManager`와 `DrawingHandler` 내에서 단순 문자열(`'pencil'`, `'brush'`)과 switch-case 문으로 처리되고 있습니다.
*   **문제점:** 새로운 도구를 추가할 때마다 `DrawingHandler`, `CanvasManager`, `ToolUtils` 등 여러 파일을 수정해야 하며, 유지보수성이 떨어집니다.
*   **제안:** 모든 도구가 `ITool` 인터페이스(예: `onDown`, `onMove`, `onUp` 메서드 포함)를 구현하도록 리팩토링하여 일관성을 확보하세요. (Command Pattern 또는 Strategy Pattern 권장)

### 2.2 InputManager의 과도한 책임 (SRP Violation)
*   **현상:** `InputManager`가 사용자 입력을 받는 것을 넘어, 텍스트 도구의 히트 테스트(Hit Test) 로직(`handleTextToolDown`)이나 도구별 분기 처리를 직접 수행하고 있습니다.
*   **문제점:** 입력 처리 로직과 비즈니스 로직이 섞여 있어 코드가 복잡해지고 테스트하기 어렵습니다.
*   **제안:** 텍스트 히트 테스트 로직은 `TextTool` 등 관련 도구 클래스 내부로 이동시키고, `InputManager`는 순수하게 이벤트를 적절한 핸들러로 라우팅하는 역할만 수행하도록 하세요.

### 2.3 매직 넘버와 하드코딩 (Magic Numbers)
*   **현상:** 코드 곳곳에 의미를 알 수 없는 숫자나 하드코딩된 설정값들이 존재합니다.
    *   `src/canvas/renderer.ts`: `const margin = 50;`
    *   `src/history.ts`: `initialLimit: number = 100`
    *   `src/main.ts`: 팔레트 기본값(20, 10) 중복 정의
*   **제안:** 모든 설정값은 `src/config.ts` 또는 각 클래스의 상단 `const` 상수로 추출하여 관리하세요.

---

## 3. 성능 및 최적화 (Performance)

### 3.1 렌더링 최적화 상태 (Rendering Status)
*   **개선됨 (Improved):** 이전 리뷰에서 지적된 **뷰포트 컬링(Viewport Culling)** 이 `CanvasRenderer`에 구현되어, 화면 밖의 페이지는 렌더링하지 않도록 최적화되었습니다. 또한 `DrawPencilSegment`에서 **배칭(Batching)** 처리가 적용되어 드로잉 성능이 개선되었습니다.
*   **여전한 문제 (Critical Issue): 전체 다시 그리기 (Full Redraw)**
    *   **현상:** `CanvasManager.redraw()`는 실행 취소(Undo)나 수정 시 **모든 히스토리를 처음부터 끝까지** 다시 그립니다(O(N)). 액션이 많아질수록 기하급수적으로 느려집니다.
    *   **제안:** **스냅샷(Snapshot) 기법**을 도입하세요. 매 20~50회 액션마다 캔버스 상태를 비트맵으로 저장해두고, Undo/Redo 시 가장 가까운 스냅샷부터 다시 그리도록 해야 합니다.

### 3.2 메인 스레드 차단 (Main Thread Blocking)
*   **현상:** `ToolUtils.floodFill` (채우기 도구) 함수가 메인 스레드에서 동기적(Synchronous)으로 실행됩니다. 1024x1024 이상의 캔버스에서 실행 시 UI가 일시적으로 멈출(Freeze) 위험이 큽니다.
*   **제안:** 픽셀 처리 로직을 **Web Worker**로 분리하여 백그라운드에서 처리하고, 완료 시 결과를 메인 스레드로 전달하는 비동기 처리가 필수적입니다.

### 3.3 불필요한 객체 생성
*   **현상:** `CanvasRenderer.render()` 메서드(매 프레임 호출 가능) 내부에서 `window.matchMedia(...)`를 매번 호출하고 있습니다.
*   **제안:** 다크 모드 감지는 초기화 시 또는 이벤트 리스너를 통해 상태를 캐싱하여 사용하세요.

---

## 4. 로직 및 안정성 (Logic & Safety)

### 4.1 텍스트 선택 알고리즘 효율성
*   **현상:** 캔버스를 클릭할 때마다(`handleTextToolDown`), 텍스트 객체를 찾기 위해 전체 히스토리 스택을 역순으로 순회 검색합니다(O(N)).
*   **제안:** 텍스트 객체들만 관리하는 별도의 R-Tree나 공간 인덱스(Spatial Index), 또는 단순한 별도 리스트를 유지하여 검색 속도를 O(1) 또는 O(log N)으로 개선할 수 있습니다.

### 4.2 타입 안정성
*   **현상:** `tsconfig.json`에서 `strict: true`가 설정되어 있어 타입 안정성은 우수합니다.
*   **관찰:** 다만 `any` 타입 캐스팅이나 `!` (Non-null assertion) 사용이 일부 존재합니다(예: `undoStack.pop()!`). 로직상 확실한 경우라도 방어적 코딩(Optional Chaining 등)을 사용하는 것이 런타임 오류 방지에 좋습니다.

---

## 5. 코드 스타일 및 외형 (Style & Aesthetics)

*   **파일 명명 규칙:** `kebab-case` (예: `canvas-manager.ts`)를 일관되게 사용하여 아주 좋습니다.
*   **디렉토리 구조:** `src/actions`, `src/tools` 등으로 기능별 분리가 잘 되어 있어 이전보다 구조가 훨씬 명확해졌습니다.
*   **포맷팅:** 대부분 양호하나, `main.ts`의 이벤트 리스너 콜백 내부 등에서 들여쓰기 깊이가 깊어지는 경향이 있습니다. 조기 반환(Early Return) 패턴을 사용하여 가독성을 높이세요.

---

## 6. 종합 점수 및 결론 (Conclusion)

### 점수 Breakdown
*   **기능 완성도 (Functionality):** 85 / 100 (필수 기능 충실, 컬링 등 최적화 적용됨)
*   **아키텍처 (Architecture):** 65 / 100 (도구 처리 방식의 일관성 부족, SRP 위반)
*   **성능 (Performance):** 65 / 100 (컬링은 좋으나, Redraw/FloodFill 최적화 시급)
*   **코드 품질 (Code Quality):** 80 / 100 (타입스크립트 활용도 높음, 명명 규칙 준수)
*   **보안 (Security):** 85 / 100

### **최종 점수: 74점**

**총평:** idrawbook은 초기 프로토타입 단계를 넘어 안정적인 서비스로 발전하고 있습니다. viewport culling 등 중요한 최적화가 적용된 점은 긍정적입니다. 그러나 전문 드로잉 툴로서 대규모 작업(많은 스트로크)을 견디기 위해서는 **Redraw 최적화(스냅샷)** 와 **Web Worker 도입**이 최우선 과제입니다. 구조적으로는 도구 시스템을 균일하게 리팩토링하면 확장성이 크게 향상될 것입니다.
