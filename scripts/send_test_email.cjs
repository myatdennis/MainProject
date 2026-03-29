#!/usr/bin/env node

const recipient = process.argv[2];

if (!recipient) {
  console.error('Usage: node scripts/send_test_email.cjs test@example.com');
  process.exit(1);
}

(async () => {
  try {
    const { sendEmail, isEmailEnabled, getEmailConfigSummary } = await import('../server/services/emailService.js');
    const configSummary = getEmailConfigSummary();

    if (!isEmailEnabled()) {
      console.error('[send_test_email] SMTP not configured', configSummary);
      process.exit(2);
    }

    const result = await sendEmail({
      to: recipient,
      subject: 'SMTP test email',
      text: 'This is a test email confirming SMTP delivery.',
    });

    if (result.delivered) {
      console.log(`[send_test_email] Email sent successfully. messageId=${result.id || 'unknown'}`);
      process.exit(0);
    }

    console.error(`[send_test_email] Email failed: ${result.reason || 'unknown_error'}`);
    process.exit(3);
  } catch (error) {
    console.error('[send_test_email] Unexpected error', error?.message || error);
    process.exit(4);
  }
})();
