# MindBridge 진행 기록

> 매주 끝에 그 주에 한 일·결정·이슈·다음 단계를 기록. **새 머신/새 Claude 세션에서 이어서 작업할 때 가장 먼저 읽을 파일**.

## 현재 상태 (2026-05-20)

| 단계 | 상태 |
|---|---|
| Week 0 — 셋업·부트스트랩 | ✅ 완료 |
| Week 1 — Foundation (인증·5롤 화면·시드) | ✅ 완료 (Day 6·7 예비 미수행) |
| Week 2 — 직원 여정 | ⏳ 시작 대기 |
| Week 3 — 상담·위기·피드백 | 대기 |
| Week 4 — HR 대시보드·정리 | 대기 |

## 주차별 요약 (작성 완료된 것)

- [Week 0 — 셋업](week-0.md)
- [Week 1 — Foundation](week-1.md)

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
