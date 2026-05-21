/**
 * 자가진단 챗봇 응답 로직 (Day 9 mock 단계).
 *
 * - assistantReply(turnIndex): turn 번호에 따른 mock 질문/응답
 * - shouldComplete(turnIndex, transcript): 4~6턴 후 종료 조건
 *
 * Real Claude 전환 시:
 *   - assistantReply 는 SSE 스트리밍으로 대체
 *   - shouldComplete 는 모델이 자체 판단 (또는 turn cap 만 유지)
 */

const MOCK_QUESTIONS = [
  "어떤 점이 가장 힘드신가요? 편한 말투로 적어 주셔도 됩니다.",
  "그 상태가 얼마나 오래 지속되셨나요? 최근에 더 심해졌나요?",
  "잠은 잘 주무시나요? 식욕이나 의욕은 어떠세요?",
  "최근에 큰 변화가 있으셨나요? 일·관계·건강 어느 쪽이든 좋습니다.",
  "지금 상태를 한 줄로 표현하신다면 어떻게 표현하시겠어요?",
];

/**
 * turnIndex: 0 = 첫 user 메시지 직후 첫 AI 응답.
 * 4번째 user 메시지 후 (turnIndex >= 3) AI 가 종합 멘트 + classify_category 호출 트리거.
 */
export function assistantReply(turnIndex: number): string {
  if (turnIndex < MOCK_QUESTIONS.length) return MOCK_QUESTIONS[turnIndex];
  return "충분히 이해됐어요. 잠시만요, 지금까지 말씀해 주신 내용을 정리해 분류해 드릴게요.";
}

export function shouldComplete(turnIndex: number, transcript: string): boolean {
  // assistantReply 가 turn >= MOCK_QUESTIONS.length 부터 종합 멘트만 반복하므로
  // 길이와 무관하게 강제 완료해야 봇 발언과 redirect 가 동기화됨.
  if (turnIndex >= MOCK_QUESTIONS.length) return true;
  return turnIndex >= 3 && transcript.length >= 20;
}

/** 위기 키워드 감지 (Day 19 assess_risk tool 의 자리. 지금은 단순 키워드). */
const CRISIS_KEYWORDS = ["죽고", "자살", "사라지고", "끝내고", "뛰어내"];
export function detectCrisis(text: string): boolean {
  return CRISIS_KEYWORDS.some((k) => text.includes(k));
}
