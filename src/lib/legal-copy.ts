/** In-app legal copy for Trackr. Draft for product use — have counsel review before store submission. */

export const LEGAL_LAST_UPDATED = '20 July 2026';

export const LEGAL_REVIEW_NOTE =
  'This is product draft copy for Trackr. Have a qualified lawyer review it before App Store / Play Store submission or any commercial launch.';

export type LegalSection = {
  heading: string;
  body: string[];
};

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    body: [
      'Trackr (“the App”) is a local-first business tool published by Siryus Creatives (Trackr). This Privacy Policy explains what information the App handles and how.',
      'Trackr is designed so your business records stay on your device. We do not operate a Trackr cloud account that stores your sales, expenses, customers, inventory, notes, or backups on our servers.',
    ],
  },
  {
    heading: 'Data stored on your device',
    body: [
      'When you use Trackr, business data you enter (for example sales, expenses, products, customers, orders, notes, settings, and related attachments) is stored locally in an on-device SQLite database and related files on your phone or tablet.',
      'Optional app lock credentials (such as a PIN) and related security preferences may be stored using the device secure storage APIs provided by the platform.',
      'Because data lives on your device, uninstalling the App, clearing app storage, or losing the device can erase that data unless you have exported a backup you control.',
    ],
  },
  {
    heading: 'Permissions we may request',
    body: [
      'Trackr only asks for permissions when a feature needs them. You can deny or later revoke permissions in system settings; related features may then be unavailable.',
      'Notifications — to remind you about things like daily reviews, low stock, overdue amounts, orders, birthdays, or backup nudges, if you enable them.',
      'Biometrics / device credentials — to unlock the App if you turn on app lock with fingerprint or face unlock.',
      'Photos / media library — to attach images to products or records when you choose to.',
      'Contacts — to import people into your customer list when you choose that feature (when available). Trackr does not upload your address book to our servers.',
      'Microphone — to record voice notes when you choose that feature (when available). Audio stays on your device unless you include it in a backup file you export.',
    ],
  },
  {
    heading: 'Backups you create',
    body: [
      'Exporting a backup creates a file you can save wherever you choose (device storage, email, or a cloud drive you control). That file may include business records and, when voice notes ship, audio attachments.',
      'We do not receive your backup unless you deliberately send it to us (for example for support). You are responsible for where you store backups and who can access them.',
    ],
  },
  {
    heading: 'Analytics and third parties',
    body: [
      'Trackr does not require an online account. The App is built to work offline for core bookkeeping.',
      'Platform stores (Apple, Google) and your device OS may collect their own diagnostics or crash data under their policies. We do not sell your personal business content.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'Trackr is intended for business use by adults. It is not directed at children under 16 (or the equivalent minimum age in your country).',
    ],
  },
  {
    heading: 'Changes',
    body: [
      `We may update this policy in the App. The “Last updated” date at the top will change when we do. Continued use after an update means you accept the revised policy.`,
    ],
  },
  {
    heading: 'Contact',
    body: [
      'Questions about privacy: contact the publisher via the support channel listed on the Trackr store listing or project site for Siryus Creatives / Trackr.',
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Agreement',
    body: [
      'By downloading or using Trackr, you agree to these Terms of Use. If you do not agree, do not use the App.',
      LEGAL_REVIEW_NOTE,
    ],
  },
  {
    heading: 'What Trackr is',
    body: [
      'Trackr is software that helps small and medium businesses keep local records for money, stock, customers, notes, and related operations. It is a tool — not a substitute for a professional accountant, lawyer, or licensed advisor.',
      'You are solely responsible for business decisions, tax filings, payroll, and compliance with laws that apply to you.',
    ],
  },
  {
    heading: 'License',
    body: [
      'We grant you a personal, non-exclusive, non-transferable license to use Trackr on devices you own or control, for your legitimate business record-keeping, subject to these Terms and the store rules of Apple or Google where you obtained the App.',
      'You may not reverse engineer, redistribute, or misuse the App except as allowed by mandatory law.',
    ],
  },
  {
    heading: 'Your data and backups',
    body: [
      'You own the business content you enter. It is stored on your device unless you export it.',
      'You are responsible for exporting backups regularly and storing them safely. Uninstalling the App, device failure, or clearing storage may permanently delete local data. We are not liable for loss of data you did not back up.',
    ],
  },
  {
    heading: 'No warranties',
    body: [
      'Trackr is provided “as is” and “as available.” To the fullest extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement.',
      'We do not warrant that calculations, reminders, or reports are error-free or suitable for any specific financial, tax, or legal purpose.',
    ],
  },
  {
    heading: 'Limitation of liability',
    body: [
      'To the fullest extent permitted by law, Siryus Creatives and its contributors are not liable for indirect, incidental, special, consequential, or lost-profit damages, or for loss of data, arising from your use of Trackr.',
      'Where liability cannot be excluded, it is limited to the greater of the amount you paid for the App in the twelve months before the claim (if any) or the minimum amount required by applicable law.',
    ],
  },
  {
    heading: 'Acceptable use',
    body: [
      'Use Trackr only for lawful purposes. Do not use it to store or process content you are not entitled to hold, or in ways that harm others or violate store or platform rules.',
    ],
  },
  {
    heading: 'Changes and termination',
    body: [
      'We may update these Terms in the App. The “Last updated” date will change when we do. We may stop offering the App or particular features. You may stop using Trackr at any time; export a backup first if you need your data.',
    ],
  },
  {
    heading: 'Governing law',
    body: [
      'These Terms are governed by the laws applicable to the publisher’s principal place of business, without regard to conflict-of-law rules, except where mandatory consumer protections in your country require otherwise.',
    ],
  },
];

export const OFFLINE_SECTIONS: LegalSection[] = [
  {
    heading: 'Local-first by design',
    body: [
      'Trackr does not create a Trackr cloud account for your books. Core business data stays in on-device storage (SQLite and related files) so you can work without a network connection.',
      'Features that need the network (for example opening a web link, or using a store update) are separate from your local ledger.',
    ],
  },
  {
    heading: 'What happens if you uninstall',
    body: [
      'Removing Trackr or clearing app data typically deletes the local database and files. That can permanently erase your records unless you previously exported a backup and can restore it.',
    ],
  },
  {
    heading: 'Backups are your responsibility',
    body: [
      'Use Export backup from Settings or Data & backup to save a file you control. Store it somewhere safe. Restore only when you intend to replace the current on-device data with that file.',
      'When voice notes are available, backups may include audio under attachments — treat backup files as sensitive.',
    ],
  },
  {
    heading: 'Permissions and offline use',
    body: [
      'Denying optional permissions (contacts, microphone, notifications, photos, biometrics) does not stop you from using core offline bookkeeping; it only limits the related feature.',
    ],
  },
];
