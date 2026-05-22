# MindBridge 진행 기록

> 매주 끝에 그 주에 한 일·결정·이슈·다음 단계를 기록. **새 머신/새 Claude 세션에서 이어서 작업할 때 가장 먼저 읽을 파일**.

## 현재 상태 (2026-05-22)

| 단계 | 상태 |
|---|---|
| Week 0 — 셋업·부트스트랩 | ✅ 완료 |
| Week 1 — Foundation (인증·5롤 화면·시드) | ✅ 완료 (Day 6·7 예비 미수행) |
| Week 2 — 직원 여정 | ✅ 완료 |
| Week 3 — 상담·위기·피드백 | ✅ 완료 (W3 게이트 통과: 위기 감지 ~1.5s) |
| Week 4 — HR + 운영자 큐 + 회고 | 🟡 시작 (D22 — HR k-anon + bookings 목록) |

### W4 일정 재배치 (2026-05-22 결정)

PRD·IA 대비 갭 분석 결과로 dev plan §5 W4가 재배치됨. 핵심 변경:

- **D27 데모 스크립트·D28 리허설 영상 → 회고로 전환**: 본 프로젝트는 외부 청중 없는 학습 목적(`project_mindbridge.md` 명시). 데모 산출물은 본 목적과 어긋남
- **D26에 `/admin/risk-queue` 추가**: D19에 만든 `acknowledgeRiskFlag` server action의 UI 공백 닫기. L2 운영자 ack 경로(PRD §5.4·§8)가 코드만 있고 화면 없는 상태 해소
- **`/app/bookings` 목록 D22에 끼움**: IA 2.2 명시인데 누락. 30분 작업
- **V2로 미룬 IA 페이지**: `/admin/escalations`, `/admin/counselors`, `/admin/companies`, `/admin/payments`, `/admin/notifications`, `/app/notifications`, `/app/settings/*` 5개, `/counselor/calendar`, `/counselor/availability`, `/forgot-password`·`/reset-password`·`/terms`·`/privacy`·`/faq` 등 비-임계 페이지. **이유**: 본 프로젝트 목적이 사업 검토가 아니라 프로세스 검증이라 임계 경로(직원 여정 + HR 익명성 + 위기 워크플로우)만 V1에서 닫고 나머지는 PRD §11.B V2 Backlog로 이관

## 주차별 요약 (작성 완료된 것)

- [Week 0 — 셋업](week-0.md)
- [Week 1 — Foundation](week-1.md)
- [Week 2 — 직원 여정](week-2.md)
- [Week 3 — 상담·위기·피드백](week-3.md)
- [Week 4 — HR + 운영자 큐 + 회고](week-4.md) (진행 중)

## 새 환경에서 재개하는 법

### 사용자 (디자이너) 입장

새 머신·새 시간 가서 작업 이어갈 때:

1. repo 클론: `git clone https://github.com/GUUNNIA/mindbridge.git`
2. 비밀 키 복원: `vercel env pull .env.local --environment=development` (자세한 건 `docs/setup.md §7`)
3. 의존성 설치: `pnpm install`
4. DB 동기화 확인: `pnpm db:push`
5. 개발 서버: `pnpm dev` → http://localhost:3000

### Claude 세션 재개

새 Claude 대화 시작 시 다음 한 줄로 충분:

> "MindBridge 프로젝트 이어서 진행하자. `docs/progress/README.md` 와 가장 최근 week 파일을 읽어줘."

Claude가 자동으로:
1. 이 파일에서 현재 단계 파악
2. 가장 최근 `week-N.md`에서 직전 작업·결정·미해결 항목 확인
3. 그 다음 단계부터 자연스럽게 이어감

## 핵심 문서 빠른 참조

| 문서 | 내용 |
|---|---|
| `../../golden-hugging-hamster.md` | 기획안 (5롤·워크플로우·기술) |
| `../prd.md` | 제품 요구사항 + Deferred Decisions + V2 Backlog |
| `../ia.md` | 정보 아키텍처 (Sitemap·화면·플로우) |
| `../../mindbridge-dev-plan.md` | 4주 Day별 작업·DoD |
| `../setup.md` | 외부 서비스 가입·환경변수·비밀 관리·Vercel CLI 동기화 |

## 작성 규칙

각 `week-N.md`는 다음 6개 섹션을 가짐:

1. **목표** — 그 주에 만들기로 한 것 (dev plan 기준)
2. **완료한 작업** — 체크리스트 (실제로 한 것)
3. **결정 사항** — 새로 정해진 것 (스택·정책·생략 범위)
4. **이슈와 해결** — 막힌 곳·우회법
5. **다음 주 시작점** — 곧바로 들어갈 작업
6. **참고 링크** — 관련 commit·문서

길이는 100~200줄 사이로 유지. 코드 자체는 git diff로 확인 가능하니 여기엔 *맥락·이유*를 적음.
