export const CERTIFICATE_PRICE = '₹21';

export const CERTIFICATE_COPY = Object.freeze({
  eyebrow: 'Verified results',
  heading: Object.freeze({ before: 'My ', emphasis: 'certificates.' }),
  verifyAction: 'Verify a certificate',
  readyToClaim: 'Ready to claim',
  getCertificate: 'Get certificate',
  paymentsOpeningSoon: 'Payments opening soon',
  certificateTitle: 'Certificate of typing proficiency',
  previewName: 'Your name',
  accuracy: 'accuracy',
  test: 'test',
  resultVerified: 'Result verified by Keystroke',
  certificateIdOnIssue: 'Certificate ID generated on issue',
  issued: 'Issued',
  noCertificates: 'No certificates yet',
  issuedDescription:
    'Issued certificates will appear here with their ID, download, and public verification link.',
  completeness: 'Completeness',
  verifiedTestTaken: 'Verified test taken',
  nameAdded: 'Name added',
  certificateIssued: 'Certificate issued',
  personalizeTitle: 'Prepare your certificate',
  nameLabel: 'Full name on certificate',
  nameHint: 'Use the exact name you want to see on the issued certificate.',
  nameError: 'Use letters, spaces, apostrophes, hyphens, or full stops only.',
  saveName: 'Save name to preview',
  paymentNotice:
    'Payments are not live yet. Saving a name updates only this local preview; no certificate is issued and no charge is made.',
  noResultTitle: 'Complete a verified test first.',
  noResultDescription:
    'A verified result is required before a certificate can be claimed.',
  takeTest: 'Take the typing test',
});

export const CERTIFICATE_CHECKLIST = Object.freeze([
  Object.freeze({
    key: 'verifiedResult',
    label: CERTIFICATE_COPY.verifiedTestTaken,
  }),
  Object.freeze({ key: 'name', label: CERTIFICATE_COPY.nameAdded }),
  Object.freeze({ key: 'issued', label: CERTIFICATE_COPY.certificateIssued }),
]);
