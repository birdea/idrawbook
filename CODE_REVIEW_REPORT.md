# iDrawBook Code Review Report

## 1. 개요 (Overview)
본 문서는 `idrawbook` 웹 서비스의 소스 코드를 소프트웨어 전문가 관점에서 분석한 리포트입니다. 구조적, 성능적, 외형적 측면을 검토하였으며, 개선이 필요한 항목들을 정리하였습니다.

**평가 요약:**
*   **프로젝트:** idrawbook
*   **주요 기술:** TypeScript, Canvas API, Google Drive API
*   **최종 점수:** **72 / 100**

---

## 2. 코드 구조 및 아키텍처 (Structure & Architecture)

### 2.1 파일 및 디렉토리 구조의 비일관성 (Inconsistency)
소스 파일들이 역할에 따라 명확히 분리되지 않고 여러 위치에 산재해 있습니다.
*   **문제점:**
    *   `src/text-tool.ts`와 `src/text-action.ts`가 `src` 루트에 위치해 있습니다. 다른 도구(Pencil, Brush 등)는 `src/tools.ts`에, 다른 액션들은 `src/actions/`에 정의된 것과 대조적입니다.
    *   `src/tools.ts`는 도구 관련 타입과 `ToolUtils`라는 정적 헬퍼 클래스를 포함하고 있어 역할이 모호합니다.
    *   타입 정의가 `src/canvas/types.ts`, `src/tools.ts` (Point, ToolConfig), `src/actions/index.ts` 등에 분산되어 있습니다.
*   **개선 권장:**
    *   `src/tools/` 디렉토리를 생성하여 모든 도구 관련 파일(`TextTool`, `ToolUtils` 등)을 모으세요.
    *   `src/actions/` 디렉토리에 `TextAction`을 이동시키고 `index.ts`에서 통합 관리하세요.
    *   공통 타입(Point, Config 등)을 위한 루트 레벨의 `src/types/` 또는 `src/shared/types.ts`를 정의하세요.

### 2.2 'God Class' 및 책임 분리
*   **문제점:** `CanvasManager` 클래스가 렌더링 조정, 히스토리 관리, 도구 상태 관리, 페이지 관리 등 너무 많은 책임을 지고 있습니다.
*   **개선 권장:** 역할에 따라 로직을 더 세분화하거나, `EventManager` 등으로 이벤트를 디커플링하는 것을 고려해보세요.

---

## 3. 성능 및 최적화 (Performance)

### 3.1 비효율적인 다시 그리기 (Redraw Bottleneck) ⚠️ **[Critical]**
*   **문제점:** `CanvasManager.redraw()` 메서드는 Undo/Redo 또는 텍스트 편집 종료 시 **전체 히스토리 스택을 처음부터 끝까지 다시 그립니다.** 드로잉 액션이 수백 개 이상 쌓일 경우 심각한 렉(Lag)이 발생할 수 있습니다.
*   **개선 권장:**
    *   **비트맵 캐싱 (Bitmap Caching):** 일정 횟수의 액션마다 현재 캔버스 상태를 이미지로 저장(Snapshot)하고, 그 이후의 액션만 다시 그리도록 최적화해야 합니다.
    *   또는 각 Page마다 별도의 Canvas(Offscreen)를 유지하며 변경된 영역만 갱신하는 전략이 필요합니다.

### 3.2 렌더링 최적화 부재 (Rendering Optimization)
*   **문제점:** `CanvasRenderer.render()`는 현재 뷰포트(화면)에 보이지 않는 페이지까지 포함하여 **모든 페이지를 매 프레임 다시 그립니다.** 페이지가 많아질수록 렌더링 부하가 급증합니다.
*   **개선 권장:** 뷰포트 교차 판정(Viewport Culling)을 도입하여 화면에 보이는 페이지만 `drawImage` 하도록 수정하세요.

### 3.3 무거운 동기 연산 (Synchronous Heavy Operation)
*   **문제점:** `ToolUtils.floodFill` (채우기 도구)이 메인 스레드에서 동기적으로 실행됩니다. 큰 캔버스에서는 UI가 일시적으로 멈출 수 있습니다. (코드 내 TODO 주석 확인됨)
*   **개선 권장:** Web Worker를 도입하여 픽셀 처리 로직을 백그라운드 스레드로 격리하세요.

### 3.4 불필요한 DOM 쿼리
*   **문제점:** `CanvasRenderer.render()` 내부에서 `window.matchMedia`를 매 프레임 호출하고 있습니다.
*   **개선 권장:** 테마 변경 이벤트를 감지하여 캐시된 값을 사용하도록 변경하세요.

---

## 4. 로직 및 버그 잠재력 (Logic & Bugs)

### 4.1 비결정적 렌더링 (Non-deterministic Rendering)
*   **문제점:** `ToolUtils.drawPencilSegment`에서 연필 질감을 표현하기 위해 `Math.random()`을 사용합니다.
    *   Undo/Redo를 할 때마다 기존에 그렸던 선들의 모양(Jitter)이 미세하게 바뀝니다. 이는 사용자에게 혼란을 줄 수 있으며, 전문 드로잉 앱으로서 완성도를 떨어뜨립니다.
*   **개선 권장:** 난수 대신 고정된 시드(Seed) 기반의 난수 생성기를 사용하거나(좌표 기반 해싱), 노이즈 텍스처를 사용하여 언제나 동일한 모양이 나오도록 수정해야 합니다.

### 4.2 텍스트 도구 히트 테스트 (Hit Testing)
*   **문제점:** 사용자가 캔버스를 클릭할 때(`handleTextToolDown`), 클릭된 텍스트를 찾기 위해 전체 히스토리를 순회합니다(O(N)).
*   **개선 권장:** 현재 활성화된 페이지의 텍스트 액션만 필터링하여 검사하거나, 별도의 공간 인덱싱(QuadTree 등)을 도입하세요.

---

## 5. 코드 스타일 및 외형 (Style & Aesthetics)

### 5.1 불필요한 공백 및 포맷팅 (Formatting)
*   일부 파일에서 함수 정의 사이나 로직 블록 사이에 불필요한 연속 공백 라인이 관찰됩니다. (예: `main.ts`, `text-tool.ts` 등)
*   줄 끝(Trailing) 공백이 존재할 가능성이 있습니다.
*   **개선 권장:** 프로젝트에 `Prettier`와 같은 코드 포매터를 적용하고, `eslint` 규칙을 강화하여 커밋 시 자동으로 정리되도록 설정하는 것을 추천합니다.

### 5.2 파일 명명 규칙
*   대부분 `kebab-case`를 잘 따르고 있어 양호합니다.
*   `CODE_REVIEW_REPORT.md`는 일반적인 소스 파일이 아니므로 루트나 문서 디렉토리에 있는 것이 적절합니다.

---

## 6. 종합 평가 (Final Conclusion)

**idrawbook**은 TypeScript를 활용하여 웹 기반 드로잉 서비스의 핵심 기능(펜, 도형, 히스토리, 줌/팬 등)을 충실히 구현하였습니다. 특히 Google Drive 연동과 같은 고급 기능을 갖춘 점은 인상적입니다.

하지만, **성능 최적화(특히 Redraw 전략)** 와 **코드 구조의 일관성** 측면에서 개선이 필요합니다. 현재 구조는 프로토타입 단계를 넘어 상용 서비스로 확장하기에는 기술 부채가 쌓일 위험이 있습니다.

### 점수 Breakdown
*   **기능 완성도 (Functionality):** 85 / 100
*   **아키텍처/구조 (Architecture):** 60 / 100
*   **성능/최적화 (Performance):** 60 / 100
*   **코드 품질 (Code Quality):** 80 / 100
*   **보안 (Security):** 85 / 100 (환경변수 분리 적용됨)

### **최종 점수: 72점**
