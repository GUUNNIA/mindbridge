# MindBridge

정신건강 EAP 멀티롤 플랫폼 MVP. **본 프로젝트의 진짜 목적은 기획→개발 프로세스 자체를 검증하는 것** (사업 검토 아님). 가상 도메인으로 5롤·익명성·임상 자동화 등 풍부한 제약을 가진 학습 케이스로 선택됨.

## 문서

| 문서 | 내용 |
|---|---|
| [기획안](golden-hugging-hamster.md) | 도메인·롤·워크플로우·기술 아키텍처 통합 정의 |
| [PRD](docs/prd.md) | 제품 요구사항 (롤별 User Stories·AC·NFR·Deferred Decisions·V2 Backlog) |
| [IA](docs/ia.md) | 정보 아키텍처 (Sitemap·URL·Nav·Screen Inventory·User Flow) |
| [4주 개발 플랜](mindbridge-dev-plan.md) | Day별 작업·DoD·의존성·리스크 |
| [Setup 가이드](docs/setup.md) | Week 0 외부 서비스 가입·키 발급·환경변수 |

## 빠른 시작 (Week 1 Day 1 이후)

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경변수 설정 (docs/setup.md 참조)
cp .env.example .env.local
# .env.local 에 Neon DATABASE_URL, Anthropic API key 등 채우기

# 3. DB 마이그레이션
pnpm db:migrate

# 4. 시드 (Week 1 Day 5 부터)
pnpm db:seed

# 5. 개발 서버
pnpm dev
```

## 스택

- Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- Prisma 6 + Neon Postgres
- NextAuth v4 + CASL (앱 레이어 권한)
- `@anthropic-ai/sdk` (Claude — sonnet 4.6 / opus 4.7)
- Pusher (세션룸 실시간 채팅, Day 15부터)
- Resend (이메일, Day 12부터, sandbox 모드)
- Sentry (에러 추적, Day 7부터)
- Pino (구조화 로그)
- Vitest + Playwright

## 디렉토리 구조

```
.
├── app/                    # Next.js App Router (5롤별 라우트)
├── components/             # UI 컴포넌트 (shadcn 포함)
├── lib/
│   ├── db.ts               # Prisma 클라이언트 싱글톤
│   ├── logger.ts           # Pino 로거
│   ├── utils.ts            # cn() 등 헬퍼
│   ├── ai/                 # Claude tool 통합 (Week 2~4)
│   ├── auth/               # NextAuth 설정 (Day 2)
│   ├── crypto/             # 컬럼 암호화 (Day 18)
│   └── notifications/      # Outbox 패턴 (Day 12)
├── prisma/
│   ├── schema.prisma       # 데이터 모델
│   └── seed.ts             # 시드 (Day 5 / Day 25)
├── docs/                   # PRD, IA, Setup 가이드
├── middleware.ts           # 1차 권한 검증
├── golden-hugging-hamster.md
└── mindbridge-dev-plan.md
```

## 진행 상태

- [x] 기획안·PRD·IA·개발 플랜 작성
- [x] Open Questions 트리아지 (A 7 / B 21 / C 9)
- [x] Week 0 셋업 가이드·프로젝트 부트스트랩
- [ ] Week 0 외부 서비스 가입 (사용자 작업)
- [ ] Week 1 Day 1 — Prisma 스키마 마이그레이션 + 시드
