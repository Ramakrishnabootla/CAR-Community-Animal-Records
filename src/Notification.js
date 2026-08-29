/**
 * CAR Platform - Notification Module
 * dispatches confirmation emails on successful save
 */

/**
 * Send confirmation email on profile creation to contributor
 * @param {string} contributorName - Contributor's Name
 * @param {string} emailAddress - Target Email Address
 * @param {string} animalName - Animal's Name
 * @param {string} carProfileId - Generated CAR ID
 */
function sendEmailConfirmation(contributorName, emailAddress, animalName, carProfileId) {
  try {
    const subject = `[CAR] Registration Confirmation for ${animalName}`;

    // HTML email body design
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2D7A5F; font-size: 22px; margin-top: 0;">Community Animal Records (CAR)</h2>
        <hr style="border: 0; height: 1px; background-color: #ddd; margin-bottom: 20px;">
        <p>Dear <strong>${contributorName}</strong>,</p>
        <p>Thank you for contributing to the Community Animal Records. A digital identity card has been generated for the animal you registered.</p>

        <div style="background-color: #f7f9f8; padding: 15px; border-left: 4px solid #2D7A5F; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #2D7A5F; font-size: 16px;">Registered Profile Details</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0; font-weight: bold; width: 140px;">CAR Profile ID:</td>
              <td style="padding: 5px 0; font-size: 16px; color: #d33c3c; font-family: monospace; font-weight: bold;">${carProfileId}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: bold;">Animal Name:</td>
              <td style="padding: 5px 0;">${animalName}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: bold;">Status:</td>
              <td style="padding: 5px 0;"><span style="background-color: #e6f3ef; color: #2d7a5f; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">Active</span></td>
            </tr>
          </table>
        </div>

        <p>Please keep this CAR Profile ID safe. You will need it to retrieve the profile or to record any future vaccinations, sterilisation events, or medical treatments.</p>

        <p style="margin-top: 30px; font-size: 12px; color: #777;">
          This is an automated confirmation email. Please do not reply directly.
        </p>
      </div>
    `;

    GmailApp.sendEmail(emailAddress, subject, '', {
      htmlBody: body,
      name: 'Community Animal Records (CAR)'
    });

    Logger.log('Confirmation email sent successfully to ' + emailAddress);
  } catch (err) {
    Logger.log('Error sending email notification: ' + err.toString());
  }
}
