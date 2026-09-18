export interface EmailDetailRow {
  label: string;
  value: string;
}

export interface BaseEmailOptions {
  logoUrl?: string;
  emailTitle?: string;
  badgeText?: string;
  mainHeading: string;
  userName?: string;
  messageText: string;
  otp?: {
    code: string;
    label?: string;
    validityNote?: string;
  };
  details?: EmailDetailRow[];
  cta?: {
    text: string;
    url: string;
  };
  footerNote?: string;
}

/**
 * Renders the official HiChandra branded base email template.
 */
export function renderBaseEmailTemplate(options: BaseEmailOptions): string {
  const title = options.emailTitle || options.mainHeading || 'HiChandra';
  const userName = options.userName || 'Customer';
  const logoSrc = options.logoUrl || 'cid:hichandra-logo';

  const badgeHtml = options.badgeText
    ? `<span style="display: inline-block; padding: 6px 14px; border-radius: 50px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
        ${options.badgeText}
      </span>`
    : '';

  const otpHtml = options.otp
    ? `
      <!-- OTP Block -->
      <div style="margin: 28px 0; padding: 24px; background-color: #f8fafc; border-radius: 16px; border: 2px dashed #cbd5e1; text-align: center;">
        <span style="display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1.5px; margin-bottom: 8px;">
          ${options.otp.label || 'Your One-Time Password'}
        </span>
        <div style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #047857; margin: 8px 0; font-family: monospace;">
          ${options.otp.code}
        </div>
        <span style="display: inline-block; font-size: 12px; color: #b45309; font-weight: 600; background-color: #fffbeb; padding: 4px 12px; border-radius: 12px; margin-top: 8px;">
          ${options.otp.validityNote || '⏱ Valid for 10 minutes'}
        </span>
      </div>
    `
    : '';

  const detailsHtml =
    options.details && options.details.length > 0
      ? `
      <!-- Details Table -->
      <div style="margin: 24px 0; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background-color: #ffffff;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          ${options.details
        .map(
          (row, index) => `
            <tr style="border-bottom: ${index === options.details!.length - 1 ? 'none' : '1px solid #f1f5f9'};">
              <td style="padding: 12px 18px; font-size: 13px; color: #64748b; font-weight: 600; width: 38%; background-color: #f8fafc; border-bottom: ${index === options.details!.length - 1 ? 'none' : '1px solid #f1f5f9'}; vertical-align: top;">
                ${row.label}
              </td>
              <td style="padding: 12px 18px; font-size: 13px; color: #0f172a; font-weight: 700; border-bottom: ${index === options.details!.length - 1 ? 'none' : '1px solid #f1f5f9'}; vertical-align: top;">
                ${row.value}
              </td>
            </tr>
          `,
        )
        .join('')}
        </table>
      </div>
    `
      : '';

  const ctaHtml = options.cta
    ? `
      <!-- Call To Action Button -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px auto 16px auto; width: 100%; max-width: 280px;">
        <tr>
          <td align="center" style="border-radius: 12px; background-color: #059669; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);" bgcolor="#059669">
            <a href="${options.cta.url}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; padding: 14px 28px; background-color: #059669; border: 1px solid #059669; border-radius: 12px; font-size: 15px; font-weight: 700; color: #ffffff !important; text-decoration: none; text-align: center;">
              <span style="color: #ffffff !important; text-decoration: none; font-weight: 700;">${options.cta.text}</span>
            </a>
          </td>
        </tr>
      </table>
    `
    : '';

  const footerNoteHtml = options.footerNote
    ? `
      <!-- Security Note / Disclaimer -->
      <p style="margin: 24px 0 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5; font-style: italic;">
        ${options.footerNote}
      </p>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Master Email Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Top Accent Gradient Line -->
          <tr>
            <td style="height: 6px; background-color: #059669; background: linear-gradient(90deg, #059669 0%, #10b981 50%, #06b6d4 100%);" bgcolor="#059669"></td>
          </tr>

          <!-- Header / Brand Logo Bar -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <a href="https://hichandra.com" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="${logoSrc}" alt="HiChandra" height="38" style="display: block; height: 38px; width: auto; max-width: 190px; border: 0;" />
                    </a>
                  </td>
                  ${badgeHtml
      ? `
                  <!-- Optional Status Badge Pill -->
                  <td style="text-align: right; vertical-align: middle;">
                    ${badgeHtml}
                  </td>`
      : ''
    }
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Email Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              
              <!-- Subject / Action Heading -->
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                ${options.mainHeading}
              </h1>
              
              <!-- Personal Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 600; color: #334155; line-height: 1.6;">
                Hi ${userName},
              </p>

              <!-- Main Description Message -->
              <div style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                ${options.messageText}
              </div>

              ${otpHtml}

              ${detailsHtml}

              ${ctaHtml}

              ${footerNoteHtml}

            </td>
          </tr>

          <!-- Footer Bar -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #475569;">
                Need help? Contact HiChandra 24/7 Support
              </p>
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748b;">
                Email: <a href="mailto:support@hichandra.com" style="color: #059669; text-decoration: none; font-weight: 600;">support@hichandra.com</a> | Web: <a href="https://hichandra.com" style="color: #059669; text-decoration: none; font-weight: 600;">hichandra.com</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} HiChandra Home Services Inc. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
