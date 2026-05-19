# Week 0 — Pre-Sprint 셋업

**기간**: 2026-05-19 (단일 세션)
**상태**: ✅ 완료
**검증**: `pnpm dev` → http://localhost:3000 에 "MindBridge" 랜딩 + 노란 데모 배너 표시

---

## 1. 목표

`mindbridge-dev-plan.md §1`에 따라 Week 1 Day 1 시작에 필요한 모든 토대 갖추기:
- 외부 서비스 계정·키 발급 (필수 4개로 압축)
- Next.js 15 프로젝트 부트스트랩
- Prisma 스키마 W1 P0 11개 엔티티 정의 + Neon DB 적용
- 로컬에서 빈 페이지 띄우기

기획·문서 단계(기획안·PRD·IA·dev plan)는 Week 0 이전에 이미 완료된 상태였음.

## 2. 완료한 작업

### 외부 서비스 (사용자 직접 가입)
- [x] GitHub repo `GUUNNIA/mindbridge` (Public)
- [x] Vercel project `mindbridge` (GitHub 연동, 기본 도메인 사용)
- [x] Neon Postgres (Free, Singapore region, Postgres 17)
- [x] Anthropic — **Day 9로 deferred** (결제 부담 회피, AI 기능은 Week 2 후반에 결정)
- [x] Sentry / Resend / Pusher — 각각 Day 7 / Day 12 / Day 15 로 deferred

### 코드·문서 (Claude 작성)
- [x] Next.js 15 + React 19 + Prisma 6 + Tailwind v4 + NextAuth v4 + CASL 부트스트랩
- [x] 디렉토리 구조: `app/`, `lib/`, `prisma/`, `docs/`
- [x] 기본 페이지 5개: layout / page / not-found / error / globals.css
- [x] middleware skeleton (롤별 prefix 라우팅 골격)
- [x] Prisma 스키마 (W1 P0 11 엔티티 + 9 enum + `encKeyVersion` 컬럼)
- [x] secretlint + husky pre-commit hook (커밋 시 비밀 자동 차단)
- [x] `docs/setup.md` (서비스별 가입 가이드 + Vercel CLI 동기화 워크플로우)
- [x] `.env.example` 템플릿
- [x] `.gitignore` (env / node_modules / .vercel / husky 내부 등 제외)
- [x] `README.md`

### 로컬 환경
- [x] `.env.local` + `.env` 두 파일 생성 (Prisma CLI가 `.env.local` 못 읽는 이슈 우회)
- [x] `NEXTAUTH_SECRET` / `ENCRYPTION_KEY` / `ANONYMIZATION_SALT` 로컬 생성 (base64 32byte)
- [x] Node.js v24.15.0 설치 확인
- [x] pnpm 9.15.0 (Corepack 경유) 활성화
- [x] `pnpm install` (500+ 패키지)
- [x] `pnpm db:push` → Neon에 11개 테이블·9개 enum 생성
- [x] `pnpm dev` → localhost:3000 동작 확인

## 3. 결정 사항

### Week 0에 추가로 확정한 결정 (PRD §11 Group A의 확장)

| 항목 | 결정 | 이유 |
|---|---|---|
| 데모 도메인 | Vercel 기본 도메인 (별도 도메인 없음) | 프로세스 실험, 외부 청중 없음 |
| Resend 이메일 발송 | Sandbox 모드만 사용 | 본인 도메인 인증 V2로 미룸 |
| 외부 서비스 미리 가입 | Sentry/Resend/Pusher는 코드 작성 시점에 가입 | 무료 티어 만료·잊혀짐 회피 |
| 환경변수 파일 정책 | `.env.local`과 `.env` 둘 다 유지 (같은 내용) | Prisma CLI가 `.env.local` 못 읽음. Week 1 후반에 `dotenv-cli`로 단일 출처화 예정 |
| repo 가시성 | Public | 프로세스 검증 산출물 = 포트폴리오 가치. Secret Scanning 자동 보호 |
| 시크릿 보관 위치 | `C:\Users\forcs\Desktop\API` (메모장 .txt) | 학습 단계 OK. 협업·장기 시점엔 1Password 권장 |

### 사용자의 명시 결정 (대화 중)
- **사업 검토 프레이밍 제거**: 기획안·dev plan에서 "사내 신규 사업 검토 / 임원 시연 / 사업성 자료" 섹션 모두 삭제. 진짜 목적은 **기획→개발 프로세스 검증**임을 명시
- **Anthropic 결제 보류**: AI 기능은 Day 9에 다시 결정. 정적 폼 fallback 가능
- **응답 톤 규칙**: 자동 동의·빈 칭찬 금지, 약점 먼저 검토 후 동의, 디자이너 입문자 톤 (메모리에 저장)

## 4. 이슈와 해결

| 이슈 | 원인 | 해결 |
|---|---|---|
| Vercel 배포가 "Application Preset: Other"로 잡힘 | GitHub에 코드 push 전이라 Vercel이 Next.js 못 감지 | 로컬 git init + push 후 Vercel 재import |
| `git push` 가 GitHub Push Protection으로 차단 | PAT를 프로젝트 폴더 내 `.txt`에 저장 → `git add .` 에 휩쓸림 | PAT 폐기·새로 발급, `.git` 폴더 삭제 후 재시작, 키 파일 폴더 밖으로 이동 |
| `corepack enable` EPERM 에러 | Windows에서 `C:\Program Files\nodejs\`는 일반 권한으로 못 씀 | Corepack의 lazy fetch 동작 활용 — `pnpm --version` 호출 시 자동 다운로드 프롬프트 → Y |
| `pnpm db:push` 실패: `Environment variable not found: DIRECT_URL` | Prisma CLI는 `.env.local` 기본 미인식, `.env`만 읽음 | `Copy-Item .env.local .env` 로 동일 내용 두 파일 유지 |
| 노란 데모 배너 안 보임 | `.env.local`에 `NEXT_PUBLIC_DEMO_BANNER=true` 추가 안 함 | 변수 추가 + 두 .env 파일 동기화 + dev 서버 재시작 |
| `pnpm install` `@casl/react` peer dep 경고 | CASL이 React 19 지원 표시 미반영 (React 19 출시 직후) | 경고만, 실 동작 무관. Day 3 사용 시점에 재확인 예정 |

## 5. 다음 주 시작점 — Week 1 Day 1

`mindbridge-dev-plan.md §2 Week 1` 참조.

### Day 1 (월) 작업 예정
- W1 P0 엔티티 스키마는 이미 작성·DB 반영 완료 ✅
- 남은 것: Tailwind·shadcn 컴포넌트 세팅 점검, 첫 shadcn 컴포넌트 (Button/Card) 설치
- DoD: `prisma migrate dev` 한 번 (지금은 db:push만 했음 → migration 히스토리 생성을 위해)

### Day 2 (화) NextAuth + 미들웨어
- NextAuth Credentials provider 설정
- bcrypt 12 라운드 비밀번호 해싱
- middleware.ts의 placeholder를 실제 인증 검증으로 교체
- 시드에 테스트 계정 임시 추가

### 미해결로 따라가는 항목
- `dotenv-cli` 도입 → `.env`·`.env.local` 이중 관리 해소 (Week 1 후반 또는 Day 11쯤)
- Vercel deploy 환경변수 등록 + Redeploy (Week 1 종료 시점에 한 번 시도)
- DB 비밀번호 회전 검토 (대화에 노출됐던 점, 사용자 판단)
- Prisma 6.19.3 → 7.x 메이저 업데이트 (V2 검토)

## 6. 참고 링크

- 부트스트랩 commit: `c6851d8` (Initial scaffold)
- 사이트 로컬: http://localhost:3000 (dev 서버 실행 시)
- Vercel project: GUUNNIA's projects / mindbridge (배포는 실패 상태, 환경변수 등록 후 재시도 예정)
- Neon DB: `mindbridge` (AWS Asia Pacific 1 Singapore, Postgres 17, 0/0.5GB 사용 중)

## 7. 학습 메모 (디자이너의 첫 1주)

- Git 비밀 누출은 **Push Protection이 잡아준다는 사실** 직접 확인 — 첫 사고가 다행히 인터넷 도달 전 차단
- 환경변수 보관 위치는 *프로젝트 폴더 밖* 이 절대 규칙
- 같은 서비스에서 무료 티어 한도·결제 옵션 처음 마주침 — 한도+알람 설정의 가치
- "에러 메시지의 첫 줄만 읽지 말고 끝까지 스크롤" 습관 필요 (Vercel·Prisma 모두)
- 개발은 **결정 미루기**가 중요한 기술 — Group A/B/C 트리아지가 실제로 작동함 확인
