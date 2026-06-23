const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5.2';

export function hasOpenAIConfig() {
  return Boolean(OPENAI_API_KEY);
}

export async function generateSalesMailDrafts(input) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured.');
  }

  // Production note:
  // Vite environment variables are visible in the browser. Before public
  // deployment, move this call to a backend endpoint and keep the API key there.
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: buildPrompt(input),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const data = await response.json();
  return normalizeDrafts(parseDrafts(extractOutputText(data)));
}

function buildPrompt(input) {
  return `あなたは日本語の法人営業メール作成アシスタントです。
得意先情報、商材、営業目的から、自然で使いやすい営業メールを3パターン作成してください。

厳守事項:
- 個人メールアドレスを推測しない
- 過度に誇張した表現を避ける
- 食品営業でも違和感なく使える自然な日本語にする
- 返答はJSON配列のみ
- 各要素は title, subject, body を持つ
- title は「丁寧版」「簡潔版」「提案型」の3つ
- body には宛名、自己紹介、相手企業に合わせた一言、商材提案、サンプルまたは商談提案、署名欄を含める

入力:
companyName: ${input.companyName}
industry: ${input.industry}
area: ${input.area}
email: ${input.email || '未取得'}
inquiryUrl: ${input.inquiryUrl || '未取得'}
memo: ${input.memo || 'なし'}
productName: ${input.productName}
purpose: ${input.purpose}
senderName: ${input.senderName}`;
}

function extractOutputText(data) {
  if (data.output_text) {
    return data.output_text;
  }

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? '')
    .join('\n')
    .trim();
}

function parseDrafts(text) {
  return JSON.parse(stripCodeFence(text));
}

function normalizeDrafts(drafts) {
  if (!Array.isArray(drafts)) {
    throw new Error('OpenAI response is not an array.');
  }

  const fallbackTitles = ['丁寧版', '簡潔版', '提案型'];
  const fallbackIds = ['polite', 'short', 'proposal'];

  return drafts
    .slice(0, 3)
    .map((draft, index) => ({
      id: draft.id || fallbackIds[index] || `draft-${index}`,
      title: draft.title || fallbackTitles[index] || 'メール案',
      subject: draft.subject || 'ご提案のご連絡',
      body: draft.body || '',
    }))
    .filter((draft) => draft.body);
}

function stripCodeFence(text) {
  return text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}
