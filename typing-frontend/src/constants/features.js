export const featureFlags = Object.freeze({
  certificatePurchaseEnabled:
    process.env.NEXT_PUBLIC_CERTIFICATE_PURCHASE_ENABLED === 'true',
  developmentGallery: process.env.NODE_ENV !== 'production',
});
