function splitTranscript(transcript = '') {
  return transcript
    .split(/\n|。/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickLines(lines, keywords, fallback) {
  const matches = lines.filter((line) => keywords.some((keyword) => line.includes(keyword)));
  return matches.length > 0 ? matches.slice(0, 4).join('\n') : fallback;
}

export function createEmptyMeetingMinutes() {
  return {
    audioFileName: '',
    transcript: '',
    summary: '',
    decisions: '',
    homework: '',
    nextActions: '',
  };
}

export async function generateMeetingMinutesDraft({ transcript = '', audioFileName = '', customerName = '' }) {
  const lines = splitTranscript(transcript);
  const summaryBase = lines.slice(0, 4).join('\n');

  return {
    audioFileName,
    transcript,
    summary: summaryBase || `${customerName || '顧客'}との商談内容を文字起こし後に要約してください。`,
    decisions: pickLines(lines, ['決定', '採用', '見積', '送付', 'サンプル'], '決定事項は未抽出です。'),
    homework: pickLines(lines, ['宿題', '確認', '調整', '社内', '価格'], '宿題は未抽出です。'),
    nextActions: pickLines(lines, ['次回', 'フォロー', '連絡', '提案', '訪問'], '次回アクションを確認して入力してください。'),
  };
}
