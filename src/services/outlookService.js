export async function createOutlookDraft({ to, subject, body }) {
  if (!to) {
    throw new Error('Recipient email is required.');
  }

  if (!subject || !body) {
    throw new Error('Subject and body are required.');
  }

  // Future replacement point:
  // - authenticate with Microsoft OAuth
  // - call Microsoft Graph API /me/messages
  // - save the message as a draft without sending
  await wait(500);

  return {
    id: `mock-outlook-draft-${Date.now()}`,
    provider: 'Outlook',
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
