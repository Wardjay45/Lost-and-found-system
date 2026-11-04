export function normalizeKnowledgeAnswers(value) {
  if (typeof value !== 'string') return null;
  const answers = value.trim();
  return !answers || answers.length > 1000 || /^n\/?a\.?$/i.test(answers) ? null : answers;
}
