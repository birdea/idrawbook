# iDrawBook 코드 리뷰 리포트

**리뷰 일자:** 2026-02-16
**리뷰어:** Software Engineering Expert (AI-assisted)
**대상 버전:** v0.1.0 (commit `64ef813`)
**총 소스 코드:** 5,312 라인 (9개 파일)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [아키텍처 분석](#2-아키텍처-분석)
3. [심각도별 이슈 요약](#3-심각도별-이슈-요약)
4. [Critical - 버그 및 로직 오류](#4-critical---버그-및-로직-오류)
5. [Major - 구조적 문제 및 안티패턴](#5-major---구조적-문제-및-안티패턴)
6. [Major - 성능 문제](#6-major---성능-문제)
7. [Minor - 코드 중복](#7-minor---코드-중복)
8. [Minor - 주석과 코드 불일치](#8-minor---주석과-코드-불일치)
9. [Cosmetic - 코드 스타일 및 포맷팅](#9-cosmetic---코드-스타일-및-포맷팅)
10. [CSS 이슈](#10-css-이슈)
11. [설정 및 빌드 환경](#11-설정-및-빌드-환경)
12. [소스트리 및 파일 구조](#12-소스트리-및-파일-구조)
13. [개선 권고 요약](#13-개선-권고-요약)
14. [최종 평가](#14-최종-평가)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프레임워크** | Vanilla TypeScript (프레임워크 없음) |
| **빌드 도구** | Vite 7.3.1 |
| **TypeScript** | 5.9.3 (strict mode) |
| **외부 의존성** | jsPDF 4.1.0 (PDF export용) |
| **배포** | Docker (nginx) |
| **소스 파일 수** | 9개 (TS 8 + CSS 1) |

### 파일별 라인 수

| 파일 | 라인 수 | 역할 |
|------|---------|------|
| `style.css` | 1,812 | 전체 UI 스타일 (Apple Design System) |
| `main.ts` | 982 | 앱 엔트리포인트, UI 이벤트 바인딩 |
| `canvas.ts` | 910 | 캔버스 매니저, 멀티페이지, 뷰포트 |
| `text-tool.ts` | 596 | 텍스트 편집 오버레이 |
| `tools.ts` | 220 | 드로잉 도구 유틸리티 |
| `google.ts` | 201 | Google Drive 연동 |
| `history.ts` | 149 | Undo/Redo 히스토리 관리 |
| `icons.ts` | 35 | SVG 아이콘 상수 |
| `config.ts` | 4 | 앱 설정 상수 |
| `index.html` | 403 | HTML 마크업 |

---

## 2. 아키텍처 분석

### 현재 구조

```
src/
├── canvas.ts        ← 핵심 캔버스 엔진 (910줄)
├── config.ts        ← 앱 상수
├── google.ts        ← Google Drive 서비스
├── history.ts       ← 히스토리 관리
├── icons.ts         ← SVG 아이콘
├── main.ts          ← 앱 엔트리 + 전체 UI 로직 (982줄)
├── style.css        ← 전체 스타일 (1,812줄)
├── text-tool.ts     ← 텍스트 도구
└── tools.ts         ← 드로잉 유틸리티
```

### 아키텍처 평가

**긍정적:**
- 프레임워크 없이 순수 TypeScript로 구현하여 번들 크기가 매우 작음
- jsPDF 외에 런타임 의존성이 없어 유지보수 부담이 적음
- `tsconfig.json`에서 strict mode 및 `noUnusedLocals`, `noUnusedParameters` 등 엄격한 설정 적용
- Canvas 기반의 효율적인 렌더링 파이프라인

**개선 필요:**
- `main.ts`(982줄)와 `canvas.ts`(910줄)가 과도하게 비대함
- `main.ts`에 UI 로직 전체가 하나의 `DOMContentLoaded` 콜백에 집중됨
- 모듈 간 관심사 분리가 불충분 (UI 이벤트, 상태 관리, DOM 조작이 혼재)
- `style.css` 단일 파일 1,812줄 — 섹션별 분리 없음

---

## 3. 심각도별 이슈 요약

| 심각도 | 건수 | 설명 |
|--------|------|------|
| **Critical** | 5 | 기능 버그, 데이터 손실 위험 |
| **Major** | 12 | 안티패턴, 성능 문제, 구조적 결함 |
| **Minor** | 10 | 코드 중복, 주석 불일치 |
| **Cosmetic** | 13 | 포맷팅, 불필요한 공백, 네이밍 |
| **합계** | **40** | |

---

## 4. Critical - 버그 및 로직 오류

### C-1. `(action as any).pageId` 타입 안전성 우회 — 데이터 손실 위험
**파일:** `canvas.ts:300, 538, 724, 756`

`StrokeAction`, `FillAction`, `ShapeAction` 객체에 `pageId`를 `(action as any).pageId = ...`로 런타임 주입합니다. `DrawingAction` 인터페이스에 `pageId`가 정의되어 있지 않아, TypeScript의 타입 체크를 완전히 우회합니다.

```typescript
// canvas.ts:538 — 타입 시스템 우회
(action as any).pageId = targetPage.id;

// canvas.ts:300 — redraw에서 any 타입으로 접근
if ((action as any).pageId && this.pages.has((action as any).pageId)) {
```

**위험:** `pageId` 주입이 누락되면, 해당 액션은 redraw 시 무시되어 사용자의 그림이 영구적으로 사라집니다. `TextAction`만 `pageId`를 정상적인 클래스 프로퍼티로 관리하고 있어 설계 불일치가 존재합니다.

**권고:** `DrawingAction` 인터페이스에 `pageId: string`을 추가하고, 모든 Action 생성자에서 `pageId`를 필수 매개변수로 받도록 수정.

---

### C-2. `uploadToDrive` MIME 타입 하드코딩
**파일:** `google.ts:143`

```typescript
const metadata: any = {
    name: filename,
    mimeType: 'image/png'  // ← JPEG, PDF일 때도 항상 PNG
};
```

사용자가 JPEG나 PDF로 내보내기 후 Google Drive에 저장하면, 실제 파일 형식과 메타데이터의 MIME 타입이 불일치합니다. Google Drive에서 파일을 올바르게 미리보기하거나 열 수 없을 수 있습니다.

**권고:** `uploadToDrive` 메서드에 `mimeType` 매개변수를 추가하여 실제 Blob의 타입을 전달.

---

### C-3. `safe-area-inset-bottom` 잘못된 CSS 문법
**파일:** `style.css:1298`

```css
padding-bottom: safe-area-inset-bottom;
/* 올바른 문법: padding-bottom: env(safe-area-inset-bottom); */
```

`env()` 함수 없이 사용되어 모든 브라우저에서 무시됩니다. iPhone의 홈 인디케이터와 UI가 겹치는 문제가 실제로 해결되지 않습니다.

---

### C-4. `menu-undo` 클릭 핸들러 누락
**파일:** `main.ts`

```typescript
// menu-redo는 이벤트 리스너가 등록되어 있지만
document.getElementById('menu-redo')?.addEventListener('click', () => canvasManager.redo());

// menu-undo에 대한 addEventListener는 코드 어디에도 없음
// menuUndo 변수는 183번 줄에서 참조만 하고, disable/enable만 관리
```

Edit > Undo 메뉴 클릭 시 아무 동작도 하지 않습니다. 키보드 단축키(Ctrl+Z)와 툴바 버튼은 동작합니다.

---

### C-5. Preview Limit 설정 UI가 동작하지 않음 (Dead Code)
**파일:** `main.ts:446-451`

설정 모달에서 Preview Limit 값을 검증하지만, 검증 통과 시 아무런 동작도 하지 않습니다.

```typescript
if (pLimit && pLimit >= 1 && pLimit <= 100) {
    // 빈 블록 — 값이 저장되거나 사용되지 않음
} else {
    ...
}
```

---

## 5. Major - 구조적 문제 및 안티패턴

### M-1. `main.ts` 전체가 하나의 DOMContentLoaded 콜백 내부
**파일:** `main.ts` (982줄)

앱의 전체 UI 로직, 이벤트 바인딩, 상태 관리가 단일 `DOMContentLoaded` 콜백 안에 있습니다. `ToolState` 인터페이스까지 함수 스코프 내에 선언되어 있습니다. 테스트 불가능하고 관심사 분리가 불가합니다.

---

### M-2. `window.addEventListener('keydown')` 3회 중복 등록
**파일:** `main.ts:480, 546, 672`

세 개의 개별 `keydown` 리스너가 각각 다른 단축키를 처리합니다:
- 480번: Ctrl+Z (Undo/Redo)
- 546번: Ctrl+L/R (패널 토글)
- 672번: 도구 단축키

**권고:** 단일 키보드 이벤트 핸들러로 통합.

---

### M-3. `alert()` / `confirm()` 네이티브 다이얼로그 사용
**파일:** `google.ts` (7건), `canvas.ts` (1건), `main.ts` (10건+)

총 18건 이상의 `alert()` 및 `confirm()` 호출이 있습니다. 메인 스레드를 차단하고, 크로스오리진 iframe에서 차단되며, Apple 디자인 철학과 일치하지 않습니다.

---

### M-4. GAPI 폴링 로드 — 무한 루프 위험
**파일:** `google.ts:37-43`

```typescript
const checkGapi = setInterval(() => {
    if (typeof gapi !== 'undefined') {
        loadPicker();
        clearInterval(checkGapi);
    }
}, 100);
```

GAPI가 로드되지 않으면 (광고 차단기 등), 이 인터벌은 영원히 실행됩니다. 타임아웃이나 에러 핸들링이 없습니다.

---

### M-5. `innerHTML` 반복 교체를 통한 비효율적 DOM 업데이트
**파일:** `main.ts:136-153` (`updatePreview`)

모든 업데이트마다 각 페이지 프리뷰의 `innerHTML`을 재설정하고 삭제 버튼 이벤트 리스너를 재등록합니다.

---

### M-6. `String.prototype.substr` 사용 (Deprecated)
**파일:** `canvas.ts:56`

```typescript
Math.random().toString(36).substr(2, 9)
```

`substr`은 더 이상 사용이 권장되지 않습니다. `substring(2, 11)`로 교체해야 합니다.

---

### M-7. TextTool의 `startEditing`과 `startReEditing` 보일러플레이트 중복
**파일:** `text-tool.ts:149-209`

두 메서드가 거의 동일한 초기화 로직을 공유합니다:
- `commitText()` 가드
- `currentPlacement`, `currentPageInfo` 할당
- `createOverlay()`, `positionOverlay()`, `requestAnimationFrame` 포커스
- `setTimeout` 이벤트 리스너 등록

차이점은 `editingActionIndex` 설정과 `textConfig` 복원뿐입니다.

---

### M-8. CSS의 `#main-canvas { background: white }` 불필요
**파일:** `style.css:461`

JavaScript의 `render()` 메서드에서 캔버스 배경을 프로그래밍으로 그리므로, CSS의 배경 설정은 첫 렌더링 전 잠깐만 보이고 즉시 덮어씌워집니다.

---

## 6. Major - 성능 문제

### P-1. `window.matchMedia()` 매 렌더링 프레임마다 호출
**파일:** `canvas.ts:782`

```typescript
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
```

포인터 이동 중 매 프레임마다 호출됩니다. `matchMedia`의 결과를 캐시하고 `change` 이벤트로만 갱신해야 합니다.

---

### P-2. `updatePreview()` — 모든 페이지의 썸네일을 매번 재생성
**파일:** `main.ts:135`

포인터 업, 채우기, 텍스트 커밋, undo/redo 등 모든 업데이트에서 전체 페이지의 `getThumbnail`을 호출합니다. `getThumbnail`은 임시 캔버스 생성 → 축소 렌더링 → `toDataURL` 변환을 동기적으로 수행합니다. 페이지가 많을수록 O(n)으로 증가합니다.

---

### P-3. `redraw()` — 전체 히스토리를 매번 처음부터 리플레이
**파일:** `canvas.ts:290-309`

Undo/redo 시 모든 페이지를 클리어하고 전체 액션을 처음부터 다시 그립니다. 변경된 페이지만 갱신하는 최적화가 없습니다.

---

### P-4. Flood Fill — Scanline 최적화 없음
**파일:** `tools.ts:195-207`

단순 4방향 스택 기반 flood fill입니다. 대형 캔버스(1024x1024)에서 빈 영역을 채울 경우:
- JavaScript 배열 스택이 수백만 항목까지 증가 가능
- visited 픽셀 추적 없이 이미 색칠된 픽셀을 중복 확인
- Scanline 알고리즘 대비 4배 이상 느림

---

### P-5. `render()`에서 매 페이지마다 그림자 렌더링
**파일:** `canvas.ts:789-812`

Canvas2D의 `shadowBlur`는 비용이 높은 연산이며, 매 프레임마다 모든 페이지에 대해 수행됩니다.

---

### P-6. `generatePalette()` 이중 호출
**파일:** `main.ts:251-252`

```typescript
generatePalette();
generatePalette();  // ← 불필요한 중복 호출
```

DOM을 한 번 생성한 후 즉시 파괴하고 다시 생성합니다.

---

## 7. Minor - 코드 중복

### D-1. Pressure 정규화 코드 중복
**파일:** `canvas.ts:444-445`, `canvas.ts:644-645`

```typescript
let pressure = e.pressure;
if (e.pointerType === 'mouse') pressure = 0.5;
```

`handlePointerDown`과 `handlePointerMove`에서 동일 코드 반복. 헬퍼 함수로 추출 권고.

---

### D-2. Save Local / Save Drive 파일명/형식 추출 로직 중복
**파일:** `main.ts:836-888`

두 저장 핸들러가 동일한 파일명, 형식, 품질, Blob 생성 로직을 반복합니다.

---

### D-3. `.hidden` CSS 클래스 이중 정의
**파일:** `style.css:1110, 1534`

```css
.hidden { display: none !important; }  /* 2회 정의 */
```

---

### D-4. `.h-separator` CSS 이중 정의
**파일:** `style.css:149, 345`

첫 번째 정의의 `margin: 4px 0`이 두 번째 정의의 `margin: 0`으로 덮어씌워짐.

---

### D-5. `.btn-primary` CSS 이중 정의 (충돌)
**파일:** `style.css:668, 1060`

두 정의의 `padding`, `border-radius`, `height` 값이 충돌합니다. 후자가 적용되지만 전자의 속성 중 일부(`height: 28px`)가 잔존할 수 있습니다.

---

### D-6. `// FILE` 주석 중복
**파일:** `main.ts:369-370`

```typescript
// FILE
// FILE  // ← 복사-붙여넣기 잔류물
```

---

### D-7. `// Initial preview` 주석 중복
**파일:** `main.ts:248-249`

```typescript
// Initial preview
// Initial preview  // ← 중복
```

---

## 8. Minor - 주석과 코드 불일치

### CM-1. 설계 질문 주석이 프로덕션에 남아있음
**파일:** `canvas.ts:126, 136-138, 231-234, 306`

```typescript
// canvas.ts:126
let y = 0; // Center vertically relative to 0? Or just stack horizontally

// canvas.ts:231-234
// Removed resizeWorld, replaced by clear/reset or just clear all pages?
// Requirement says "Book has 0 to n pages".
// clear() should probably remove all pages or just clear their content?
// "New Book" usually implies clearing everything.
```

개발 중 사고 과정이 주석으로 남아 있어, 코드의 의도를 오히려 모호하게 만듭니다.

---

### CM-2. `clear()` 메서드의 오해를 유발하는 주석
**파일:** `canvas.ts:243`

```typescript
// Wrapper for old clear() behavior if needed, but "New Book" now effectively resets
```

실제로는 두 개의 UI 동작(Clear canvas, Delete Book)에서 모두 활발히 사용됩니다.

---

### CM-3. `/* Minimal Tooltip */` 잘못된 위치
**파일:** `style.css:738`

`Minimal Tooltip` 주석이 `.zoom-controls` 앞에 위치해 있으나, 실제 tooltip 스타일은 1085번 줄에 있습니다.

---

### CM-4. CSS 주석 중복
**파일:** `style.css:1277`

```css
/* Transform Right Sidebar to Bottom Bar */
/* Transform Right Sidebar to Bottom Bar */  /* ← 동일 주석 반복 */
```

---

### CM-5. Deprecated 기능에 대한 미해결 주석
**파일:** `main.ts:156-163`

```typescript
// Prune if limit exceeded (User feature from before)
// Actually, "Book has 0 to n items". User requests scrollable list.
// The "Limit" feature from previous session might conflict?
```

Preview Limit 기능이 실제로 구현되지 않았음에도 관련 주석과 UI가 남아 있습니다.

---

### CM-6. `switchTool moved below` 위치 안내 주석이 부정확
**파일:** `main.ts:607-609`

```typescript
// switchTool moved below, definitions moved up
```

최종 코드 구조에서 더 이상 유효하지 않은 안내 주석입니다.

---

## 9. Cosmetic - 코드 스타일 및 포맷팅

### F-1. 라인 끝 불필요한 공백 (Trailing Whitespace)
**파일:** 2건 발견

| 파일 | 라인 |
|------|------|
| `canvas.ts` | 231번 줄 |
| `main.ts` | 614번 줄 |

---

### F-2. 불필요한 연속 공백 라인

| 파일 | 위치 |
|------|------|
| `canvas.ts` | 263번, 769-770번 |
| `main.ts` | 여러 곳 (5건+) |
| `style.css` | 여러 곳 (6건+) |

---

### F-3. CSS `z-index` 값 체계화 부재

사용된 z-index 값: `10, 100, 200, 201, 300, 999, 1000, 2000, 2001, 3000, 9999`

CSS 변수로 스택 순서를 관리하지 않아, 레이어 간 관계를 파악하기 어렵습니다.

```css
/* 권고: CSS 변수로 z-index 체계화 */
:root {
    --z-canvas-overlay: 200;
    --z-header: 1000;
    --z-dropdown: 2000;
    --z-modal: 3000;
    --z-toast: 9999;
}
```

---

### F-4. CSS 하드코딩된 색상 값 (7건+)

CSS 변수 시스템이 구축되어 있음에도, 여러 곳에서 하드코딩된 색상을 사용합니다:

| 위치 | 값 | 대상 |
|------|-----|------|
| `style.css:259` | `#FF9500` | `.text-todo` 색상 |
| `style.css:1002` | `rgba(0, 113, 227, 0.1)` | 폴더 선택 배경 |
| `style.css:1248` | `#ff3b30` | 삭제 버튼 호버 |
| `style.css:1484` | `#34C759` | 상태 뱃지 |
| `style.css:1607` | `#000000` | 텍스트 오버레이 |

---

### F-5. 버튼 네이밍 규칙 불일치

동일한 역할의 버튼 컴포넌트가 5가지 다른 네이밍을 사용합니다:
- `.header-icon-btn` (32x32, border-radius 8px)
- `.menu-icon-btn` (32x32, border-radius 6px)
- `.tool-btn` (40x40, border-radius 10px)
- `.icon-btn` (28x28, border-radius 6px)
- `.zoom-btn` (24x24, border-radius 6px)

BEM이나 체계적인 디자인 토큰 접근이 필요합니다.

---

## 10. CSS 이슈

### CSS-1. `.folder-list` Dead CSS
**파일:** `style.css:979, 1030`

원래 CSS(979줄)가 남아있으나, 1030줄에서 `display: none`으로 전체를 숨깁니다. `.folder-selector-ui`로 리팩토링 후 잔류물입니다.

---

### CSS-2. `.header-center` 사용되지 않는 CSS 클래스
**파일:** `style.css:66-69`

HTML에 `.header-center` 요소가 없습니다. Dead CSS입니다.

---

### CSS-3. `.mobile-bottom-bar` / `.hidden-desktop` 미사용 기능
**파일:** `style.css:1259`, `index.html:297`

`.mobile-bottom-bar`가 `display: none !important`로 항상 숨겨져 있고, `.hidden-desktop` CSS 클래스 정의가 존재하지 않습니다. 미구현된 기능의 잔류물입니다.

---

### CSS-4. Delete 버튼 `transform` 충돌
**파일:** `style.css:1242-1251`

```css
.preview-item:hover .delete-page-btn {
    transform: translateY(-50%) scale(1);
}
.delete-page-btn:hover {
    transform: scale(1.1);  /* ← translateY(-50%) 누락 */
}
```

삭제 버튼에 직접 호버하면 `translateY(-50%)`가 사라져 버튼이 아래로 점프합니다.

---

### CSS-5. `max-height: 1000px` 매직 넘버
**파일:** `style.css:549`

아코디언 애니메이션을 위한 매직 넘버. 컨텐츠가 1000px을 초과하면 클리핑됩니다.

---

## 11. 설정 및 빌드 환경

### B-1. 버전 불일치
- `package.json`: `"version": "0.0.0"` (Vite 기본값)
- `src/config.ts`: `VERSION: '0.1.0'`

### B-2. `vite.config.ts` 부재
커스텀 빌드 설정이 없습니다. SPA 라우팅 설정, base URL, 환경별 설정 등이 불가합니다.

### B-3. ESLint / Prettier 부재
`tsconfig.json`의 strict 설정은 있지만, 코드 스타일 린터가 없습니다. 팀 개발 시 일관성 유지가 어렵습니다.

### B-4. Dockerfile 개선 사항
- `npm install` → `npm ci`로 변경 권고 (deterministic builds)
- `.dockerignore` 파일 부재 (불필요한 파일이 빌드 컨텍스트에 포함)
- SPA 라우팅을 위한 nginx 설정 없음
- 노드 버전 고정 필요 (`node:20-alpine` → `node:20.18-alpine`)

### B-5. Favicon 미변경
`index.html`에서 기본 Vite SVG를 favicon으로 사용 중.

```html
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
```

### B-6. HTML Inline Style
`index.html`에 3곳의 인라인 `style` 속성이 존재합니다. CSS 클래스로 이동해야 합니다.

---

## 12. 소스트리 및 파일 구조

### 구조 평가

| 항목 | 상태 | 비고 |
|------|------|------|
| 불필요한 파일 | ✅ 양호 | 소스트리에 이상한 파일 없음 |
| 파일 이름 규칙 | ✅ 양호 | kebab-case 일관적 사용 |
| 디렉토리 구조 | ⚠️ 주의 | src/ 플랫 구조, 컴포넌트/유틸 분리 없음 |
| `.gitignore` | ✅ 양호 | 표준 Vite 템플릿 + `.claude/` 포함 |

### 권고 디렉토리 구조

현재 프로젝트 규모(5,300줄)에서는 모듈 분리를 시작해야 할 시점입니다:

```
src/
├── core/
│   ├── canvas.ts
│   ├── history.ts
│   └── tools.ts
├── ui/
│   ├── toolbar.ts
│   ├── menu.ts
│   ├── modals.ts
│   └── panels.ts
├── services/
│   └── google.ts
├── text/
│   └── text-tool.ts
├── styles/
│   ├── base.css
│   ├── components.css
│   └── responsive.css
├── constants/
│   ├── config.ts
│   └── icons.ts
└── main.ts
```

---

## 13. 개선 권고 요약

### 즉시 수정 필요 (Critical)

| # | 이슈 | 수정 난이도 |
|---|------|-----------|
| C-1 | `DrawingAction`에 `pageId` 추가 | 중 |
| C-2 | Drive 업로드 MIME 타입 매개변수화 | 하 |
| C-3 | `env(safe-area-inset-bottom)` 수정 | 하 |
| C-4 | `menu-undo` 클릭 핸들러 추가 | 하 |
| C-5 | Preview Limit 기능 구현 또는 UI 제거 | 하 |

### 단기 개선 (Major)

| # | 이슈 | 수정 난이도 |
|---|------|-----------|
| M-2 | keydown 리스너 통합 | 하 |
| M-3 | 커스텀 다이얼로그 컴포넌트 | 중 |
| M-4 | GAPI 타임아웃 추가 | 하 |
| P-1 | matchMedia 캐시 | 하 |
| P-6 | generatePalette 중복 호출 제거 | 하 |

### 중기 개선 (Architecture)

| # | 이슈 | 수정 난이도 |
|---|------|-----------|
| M-1 | main.ts 모듈 분리 | 상 |
| P-2 | 썸네일 dirty tracking | 중 |
| P-3 | 페이지별 히스토리 | 상 |
| P-4 | Scanline flood fill | 중 |

---

## 14. 최종 평가

### 점수

| 카테고리 | 점수 (10점 만점) | 비고 |
|----------|:---:|------|
| **기능 완성도** | 7.5 | 핵심 드로잉 기능 잘 구현, 일부 메뉴 버그 존재 |
| **코드 품질** | 5.5 | 타입 안전성 우회, 대형 파일, 중복 코드 |
| **아키텍처** | 5.0 | 관심사 분리 부족, 단일 파일에 로직 집중 |
| **성능** | 5.5 | 매 프레임 불필요한 연산, 최적화 여지 큼 |
| **CSS/UI** | 6.5 | Apple 디자인 잘 적용했으나 Dead CSS 다수 |
| **유지보수성** | 5.0 | 테스트 없음, 린터 없음, 주석 관리 부족 |
| **보안** | 7.0 | 민감한 보안 이슈 없음, OAuth 적절히 사용 |
| **빌드/배포** | 6.0 | Docker 지원, 그러나 최적화 미흡 |

### 종합 점수: **6.0 / 10.0**

---

### 총평

iDrawBook은 프레임워크 없이 순수 TypeScript로 구현된 인상적인 웹 드로잉 앱입니다. Canvas2D를 활용한 멀티페이지 시스템, 필압 지원 브러쉬, Google Drive 연동 등 야심찬 기능을 소수의 파일로 구현했습니다.

그러나 **초기 프로토타입에서 프로덕션으로 전환하는 과도기**에 해당하는 코드 상태입니다. `(action as any).pageId` 패턴과 같은 타입 안전성 우회, 982줄짜리 `main.ts`의 모놀리식 구조, 테스트/린터 부재 등은 기능이 추가될수록 기술 부채가 급격히 증가할 것입니다.

**가장 시급한 과제:**
1. Critical 버그 5건 즉시 수정
2. `main.ts` 모듈 분리를 통한 관심사 분리
3. ESLint + Prettier 도입으로 코드 품질 기준선 설정
4. 성능 핫스팟(matchMedia 캐시, 썸네일 최적화) 해결

기반이 탄탄하므로, 위 개선사항을 단계적으로 적용하면 **프로덕션 품질의 서비스**로 충분히 발전시킬 수 있습니다.

---

*이 리포트는 전체 소스 코드(5,312줄)를 파일별로 완전히 읽고 분석하여 작성되었습니다.*
