# MindBridge — 한 달 회고 (프로세스 검증 중심)

**기간**: 2026-05-04 (W0 셋업) ~ 2026-05-29 (W4 D28)
**프로젝트 정의**: 정신건강 EAP 멀티롤 플랫폼 MVP. 5롤 · k-익명성 · Claude tool calling · 컬럼 암호화 · 위기 워크플로우.
**진짜 목적**: 사업 검토가 아니라 **기획 → PRD/IA → 4주 개발에 이르는 프로세스 자체를 검증하는 1개월 학습 프로젝트**. 외부 청중·임원 시연·V2 로드맵은 명시적으로 제외.

---

## 1. 4주 흐름 한 줄 요약

| 단계 | 내용 | 게이트 |
|---|---|---|
| **W0** | 셋업 (GitHub · Vercel · Neon · Anthropic) + 부트스트랩 + 11개 P0 엔티티 schema | 8개 체크리스트 통과 |
| **W1** | 5롤 인증·미들웨어·CASL + 5롤 layout + 시드 v1 (50직원·10상담사 등) | 권한 매트릭스 5롤 cross-check |
| **W2** | 자가진단 챗봇 + 매칭 BR-4 + 예약 동시성 + Outbox + 이메일 + W2 E2E | 직원 임계 경로 E2E 그린 |
| **W3** | 세션룸·SOAP·컬럼 암호화(AES-256-GCM)·assess_risk·Escalation·피드백 | **위기 감지 1.5s** (게이트 30s 대비) |
| **W4** | HR k-anon · 차트 · PDF · 시드 v2 · /admin/audit-logs · /admin/risk-queue · E2E | k<5 마스킹 0건 위반 + 5롤 풀 E2E 그린 |

**최종 코드 카운트**: 36 commits · TypeScript clean · vitest 156/156 · Playwright 4 specs 그린.

---

## 2. 잘 작동한 패턴 (반복 가치 있는 것)

### 2.1 mock provider 우선 + 환경변수로 실 API 전환

D9 (classify_category) → D17 (generate_soap) → D19 (assess_risk) → D24 (generate_hr_insight) 4종 Claude tool 모두 같은 패턴:

```ts
export const fn = isAIEnabled ? fnClaude : fnMock;
```

`ANTHROPIC_API_KEY` 환경변수만으로 mock ↔ real 전환. Anthropic 결제 보류 상태에서도 풀 구현·E2E 통과. **디자인의 "토큰 vs 하드코딩" 분리와 같은 원리** — 한 곳에서 추상화하면 위·아래 흐름이 자유.

같은 패턴이 messaging(Pusher fallback, D15), 이메일(Resend mock, D12), 암호화 키 회전 (`ENCRYPTION_KEY_V1`, D18) 에도 일관 적용.

### 2.2 권한 cross-check 룰 (메모리 기반 자동 회귀)

W2 D10·D11 에서 같은 회귀 두 번 — EMPLOYEE의 CounselorRecommendation·slot 접근 거부 가드. 두 번째 데인 후 메모리에 룰 신설(`feedback_ability_crosscheck.md`):

> "새 server action 도입 시 abilities.test.ts 에 5롤 케이스 같이 추가"

W3 신규 subject 3건(RiskAlert · Escalation · Feedback) + W4 신규 2건(HRReport는 기존, AuditLog는 ADMIN read 명시, RiskAlert 5롤) 모두 cross-check 같이 들어가서 **W3·W4 동안 권한 회귀 0**. 메모리 룰이 자동 가드로 작동한 좋은 사례.

### 2.3 3단 익명성 가드 (BR-12 모집단 → BR-5 셀 → BR-7 발행)

W4 D22 HR 집계에서 한 모듈(`lib/hr/aggregate.ts`)에 익명성 가드를 3단으로 분리:

1. **BR-12** — STATISTICS 동의자만 모집단에 포함 (`listStatisticsConsenterUserIds`)
2. **BR-5** — 셀 카운트 < 5 면 `masked: true` (`maskCell`)
3. **BR-7** — 회사 직원 < 20 + 동의자 < 10 이면 발행 자체 차단 (`checkPublishable`)

각 단계가 단위 테스트로 독립 검증 가능 (vitest 11건 → D23 +4, 익명성 가드 단독 검증). **분자 < k 일 때 비율도 마스킹** 같은 미묘한 가드(역추정 차단)도 명시.

### 2.4 임계 경로 E2E 가드

W2 D14 employee-journey + W3 D21 회귀 + W4 D27 demo-scenario 3개 spec 이 5롤 풀 회귀를 자동화. **위기 감지 30초 게이트가 측정 가능한 assertion 으로 옮겨진 것**(D21 — 실측 1.5초)이 핵심.

매 commit 마다 사람이 시연 시나리오를 손으로 도는 대신 spec 이 자동 가드. **PRD 명시 게이트가 코드 안 assertion 으로 변환**되는 흐름이 본 프로젝트에서 가장 큰 안전망.

### 2.5 트랜잭션 = 데이터 정합성의 마지막 방어선

W3 동안 신규 정합성 케이스 5건 모두 `prisma.$transaction` 안에서:
- D12 `createBooking` + outbox enqueue
- D18 `ClinicalNote enc` + `SessionMessage enc` 동시 갱신
- D20 `assessAndFlag` 안에서 RiskFlag + Escalation 자동 생성
- D21 `submitFeedback` + Counselor rating·ratingCount 재계산
- D25 `dismissRiskFlag` + AuditLog 동시 기록

부분 실패 시 일관성 깨지면 사용자 신뢰가 무너지는 케이스들(위기 신호가 RiskFlag 만 생기고 Escalation 빠짐 등). 트랜잭션 안에서 묶는 게 코드 한 줄로 막아주는 가치가 큼.

---

## 3. 실패 교훈 (다음 사이클에 피할 것)

### 3.1 시드 stale JWT 문제 (D24 → D25 fix)

W3 D24 PDF route handler 에서 `prisma.auditLog.create({ actorId: session.user.id })` 가 **시드 재실행 후 외래키 위반**. 원인: `randomUUID()` 로 user.id 매번 새로 생성되는데 NextAuth JWT 는 이전 user.id 유지. **시드는 멱등이라 가정했지만 그 가정이 JWT 와 충돌**.

fix: D25 에서 핵심 5롤만 `FIXED_USER_IDS` 로 고정. 시드 재실행 후에도 JWT 세션 유효.

**교훈**: 시드 정책은 단순히 "wipe + reseed" 가 아니라 **외부 상태(브라우저 세션·다른 시스템) 와의 정합성**까지 고려해야. 학습 프로젝트에선 5롤 고정으로 충분하지만 production 에선 더 엄격한 정책(seed = idempotent + ID 유지) 필요.

### 3.2 `Button asChild + disabled` 함정 (D22 → 메모리 룰 신설)

shadcn `<Button asChild>` 로 `<Link>` 감쌀 때 `disabled` prop 이 **silent fail**. 시각도 안 바뀌고 클릭도 막히지 않은 채 `href="#"` 점프만. 사용자가 활성 버튼으로 보고 누르지만 아무 일도 안 일어나는 silent UX bug.

메모리 룰로 저장(`feedback_button_aschild_disabled.md`): "Link 로 갈 버튼은 조건부 렌더링으로 분기, disabled prop X".

**교훈**: shadcn/Slot 패턴은 강력하지만 React prop 자동 머지의 함정이 있음. 새 컴포넌트 라이브러리 도입 시 **API 표면 한계를 명시적으로 학습**해야.

### 3.3 sed 일괄 치환 함정 (D25)

D25 에서 시드의 `encryptField` 호출을 `enc` 헬퍼로 일괄 변경:
```powershell
sed -i 's/encryptField(/enc(/g' prisma/seed.ts
```
**헬퍼 정의 내부의 `encryptField` 호출도 같이 치환**되어 무한 재귀 함정. 즉시 fix 했지만 typecheck 가 안 잡았다면 시드 실행 시 stack overflow.

**교훈**: 동일 이름 헬퍼와 원래 함수가 한 파일에 같이 있을 때 sed 일괄 치환은 위험. **명시적 Edit 으로 한 줄씩** 또는 헬퍼와 호출부를 다른 파일로 분리.

### 3.4 PDF 콜드 스타트 + Neon cold start

W4 D24 PDF 첫 호출 5~10초. 원인 분석:
- Pretendard CDN fetch (jsdelivr)
- @react-pdf/renderer + yoga-layout WASM 동적 import
- Neon free tier suspend → 첫 쿼리 지연

production build 로 전환해도 Neon cold start 는 동일. 본 프로젝트는 학습용이라 그대로 두지만 production 가려면 **로컬 폰트 + connection pooler + warm-up endpoint** 필요.

**교훈**: dev 서버 한계와 production 한계는 별개. **시연용 안정성 작업은 시연 전용 환경에서 별도** (D28 vercel.json + setup.md Vercel 가이드 분리한 이유).

### 3.5 spec assertion 의 fragile selector

D27 demo-scenario E2E 작성 시 4번 fail → fix 사이클:
1. ACK 후 즉시 DB 조회 (race condition)
2. `<header>` selector 가 글로벌 layout header 잡음
3. `getByText("자가진단 응답")` strict mode violation (CardTitle + CardDescription 양쪽 매칭)
4. KPI 텍스트 다른 곳 substring 매칭

**교훈**: shadcn 컴포넌트는 의미 있는 텍스트가 여러 곳에 등장. spec 의 selector 는 처음부터 `exact: true` 또는 role-based · data-attribute 사용해야 회귀 적음.

---

## 4. Claude 활용 회고

### 4.1 어디까지 의존했는가

| 항목 | Claude 비중 | 내가 직접 |
|---|---|---|
| Prisma 스키마 작성 | 90% | 임계값 (k=5, BR-7) 결정 |
| Server Action 코드 | 85% | 회사 격리 등 자원 단위 권한 |
| CASL ability + 미들웨어 | 80% | 5롤 권한 매트릭스 의사결정 |
| UI 와이어업 (shadcn) | 95% | 디자인 톤·여백·색상 토큰 |
| 시드 데이터 생성 | 90% | 시드의 의도된 분포 (40명 동의자 등) |
| Vitest unit spec | 95% | 어떤 케이스를 테스트할지 |
| Playwright E2E | 85% | 시나리오 설계 (5롤 풀 흐름) |
| 진행 기록 문서 | 80% | 결정 의도·맥락 |

**대부분의 코드 작성은 Claude**, **결정·의도·맥락은 내가**. 디자이너 입장에선 "기획·설계·검증" 에 시간 쓰고 "구현" 은 위임한 셈.

### 4.2 잘 작동한 점

- **mock provider 패턴을 일관 적용한 것** — 결정 한 번에 4개 tool 모두 같은 구조로 자동 생성. 일관성 = 학습 가능성
- **회귀 가드를 함께 작성** — server action 한 건 만들 때 abilities cross-check + unit test 까지 같이. 메모리 룰이 트리거
- **PRD/IA 문서와 코드의 연결** — 새 server action 마다 PRD § 참조를 주석에 박음. 코드가 곧 PRD 의 거울
- **직설·비판 우선 스타일 메모리** — Claude 가 자동 동의 대신 트레이드오프 명시. 디자이너 입장에서 결정 부담 적음

### 4.3 잘 작동하지 않은 점

- **E2E spec 의 selector** — UI 작성 시 spec 친화적 attribute(data-testid 등)를 같이 박았으면 D27 4번 fail 안 났음. 다음 사이클엔 UI 작성 단계에서 spec 친화적 설계
- **시드 정책의 외부 상태 고려** — 시드를 wipe + reseed 단순 패턴으로 두고 JWT 같은 외부 상태 무시. D24 까지 발견 못함
- **first-time 작업의 hidden complexity** — react-pdf 한글 폰트, recharts 마스킹 시각화, NextAuth callback URL 등 처음 만나는 라이브러리는 작업 30~50% 더 걸림. **2주 차부터는 hidden cost 가 줄어듦**

### 4.4 다음 사이클에 바꿀 것

1. **UI 작성 시 spec 친화 attribute 같이** — data-testid 또는 role-based 명시
2. **시드 정책을 별도 결정 회의로** — 단순 fixture 가 아니라 stale state 회피·외부 상태 고려까지 한 번에
3. **첫날 dev infra 베이스라인** — production build + Neon connection pooler + warm-up 까지 W0 에 포함

---

## 5. 다음 학습 사이클 가이드

본 프로젝트 다음에 비슷한 1개월 사이클을 돈다면:

### 5.1 동일하게 가져갈 것
- mock provider 패턴
- 메모리 기반 회귀 룰 (직설·비판·cross-check·주차 push)
- 3단 정합성 가드 (트랜잭션·k-anon·외래키)
- PRD § 참조를 코드 주석에
- 매 day commit + 매 week summary + 자동 push

### 5.2 새로 시도할 것
- **D1 부터 production build 시연 환경 분리** — dev/prod 차이를 알고 작업
- **UI 와 spec 동시 작성** — 페이지 만들 때 spec 도 같이. E2E 가 후행이 아니라 선행
- **시드 정책을 W0 결정 사항으로 포함** — 단순 fixture 가 아니라 멱등성·외부 상태·시연 환경 분리까지
- **2주 차부터 hidden cost 가 줄어든다는 가정으로 W1 계획** — W1 은 의도적으로 더 적게 잡고 후반에 여유

### 5.3 V2 또는 다른 도메인으로 옮길 때 챙길 것

본 프로젝트의 V2 backlog (PRD §11.B / IA §12.B / week-4.md V2 미룬 항목) — 진짜로 V2 가려면 다음이 선행:
- 컬럼 암호화 키 회전 메커니즘
- Postgres RLS (V1 의 앱 레이어 CASL 위에)
- 영상·음성 세션
- L4 응급 자동 외부 연계
- 임상 노트 검색 페이지 (검색 가능 암호화)
- 슈퍼비전 워크플로우 자동화
- 다국어
- /admin/escalations · /counselor/calendar · /counselor/availability · /app/settings · /app/notifications 등 V1 에서 미룬 페이지

다른 도메인(예: 학습 관리·고객 지원·문서 자동화 EAP 외)으로 옮길 때 본 프로젝트의 **5롤 권한 골격 + Claude tool 4종 패턴 + k-anon 가드 + Outbox 알림**은 그대로 재활용 가능.

---

## 6. 결론

본 프로젝트는 **사업 산출물이 아니다**. 한 달 동안 검증한 것:
- 기획서 한 장에서 4주 후 36 commits · 156 단위 테스트 · 4 E2E spec 까지 가는 흐름이 가능한가
- Claude 와의 협업에서 디자이너 입장의 의사결정 단위는 어디까지인가
- 메모리·자동 룰·cross-check 같은 메타-도구가 학습 속도를 얼마나 올리는가
- mock-first · k-anon · 트랜잭션 · spec 가드 같은 코드 패턴이 V1 MVP 에 충분히 정합한가

**답은 "가능하다" + "디자이너가 결정·맥락에 시간 쓰면 Claude 가 구현에 같은 시간만큼 기여한다" + "메타-도구가 매주 회귀를 줄여준다"**.

다음 사이클은 새 도메인 또는 본 프로젝트의 V2 일부 (Postgres RLS + 키 회전) 로 진행 가능.

---

## 7. 참고

- [docs/progress/README.md](progress/README.md) — 진행 기록 인덱스
- [docs/progress/week-{0,1,2,3,4}.md](progress/) — 주차별 상세
- [docs/prd.md](prd.md) — 제품 요구사항
- [docs/ia.md](ia.md) — 정보 아키텍처
- [mindbridge-dev-plan.md](../mindbridge-dev-plan.md) — 4주 개발 일정
- 메모리: `MEMORY.md` (6개 룰 — project · feedback × 4 · user role)
