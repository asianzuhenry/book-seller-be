// utils/emailTemplates.ts

/**
 * Generates the HTML email sent when a user requests a password reset.
 * @param resetUrl  The full URL containing the raw token, e.g.
 *                  https://yourdomain.com/reset-password?token=abc123
 */
export const passwordResetEmail = (resetUrl: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your EduBooks password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="
                    background:linear-gradient(135deg,#2563EB,#3B82F6);
                    border-radius:10px;
                    width:44px;height:44px;
                    text-align:center;
                    vertical-align:middle;
                    font-size:22px;
                    line-height:44px;
                  ">📚</td>
                  <td style="padding-left:10px;font-size:20px;font-weight:700;color:#0f172a;">
                    EduBooks
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="
              background:white;
              border-radius:14px;
              padding:40px 36px;
              box-shadow:0 4px 24px rgba(10,22,40,0.08);
            ">
              <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;font-weight:700;">
                Reset your password
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
                We received a request to reset the password for your EduBooks account.
                Click the button below to choose a new one.
              </p>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a
                      href="${resetUrl}"
                      style="
                        display:inline-block;
                        padding:13px 32px;
                        background:linear-gradient(135deg,#2563EB,#3B82F6);
                        color:white;
                        font-size:15px;
                        font-weight:700;
                        text-decoration:none;
                        border-radius:9px;
                        letter-spacing:0.2px;
                      "
                    >
                      Reset Password →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;text-align:center;">
                This link expires in <strong style="color:#64748b;">1 hour</strong>.
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 20px;" />

              <!-- Fallback URL -->
              <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;word-break:break-all;">
                <a href="${resetUrl}" style="color:#2563EB;text-decoration:none;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0 0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email.<br/>
                Your password will not be changed.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;">
                © ${new Date().getFullYear()} EduBooks · Uganda
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`;