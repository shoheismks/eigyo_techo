export async function createGmailDraft({ to, subject, body }) {
  if (!to) {
    throw new Error('Recipient email is required.');
  }

  if (!subject || !body) {
    throw new Error('Subject and body are required.');
  }

  // Future replacement point:
  // - authenticate with Google OAuth
  // - call Gmail API users.drafts.create
  // - pass a base64url encoded RFC 2822 message
  await wait(500);

  return {
    id: `mock-gmail-draft-${Date.now()}`,
    provider: 'Gmail',
    status: 'created',
    to,
    subject,
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
