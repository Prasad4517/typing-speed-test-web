export const AUTH_VIEW = Object.freeze({
  signIn: 'sign-in',
  signUp: 'sign-up',
  forgotPassword: 'forgot-password',
});

export const AUTH_COPY = Object.freeze({
  views: Object.freeze({
    [AUTH_VIEW.signIn]: Object.freeze({
      eyebrow: 'Your Keystroke account',
      title: 'Welcome back.',
      description:
        'Sign in to manage your profile and protect future certificates.',
      submit: 'Sign in',
      switchPrompt: 'New to Keystroke?',
      switchAction: 'Create an account',
    }),
    [AUTH_VIEW.signUp]: Object.freeze({
      eyebrow: 'Keep your results close',
      title: 'Make your progress yours.',
      description:
        'Create an account to manage your profile and verified records.',
      submit: 'Create account',
      switchPrompt: 'Already have an account?',
      switchAction: 'Sign in instead',
    }),
    [AUTH_VIEW.forgotPassword]: Object.freeze({
      eyebrow: 'Account recovery',
      title: 'Reset your password.',
      description:
        'Enter your email address. If an account is eligible, reset instructions will be sent.',
      submit: 'Request reset link',
    }),
  }),
  fields: Object.freeze({
    fullName: 'Full name',
    email: 'Email address',
    password: 'Password',
    confirmPassword: 'Confirm password',
  }),
  passwordHint: 'Use at least 12 characters.',
  forgotPasswordAction: 'Forgot password?',
  backToSignIn: 'Back to sign in',
  resetComplete:
    'Your password has been reset. Sign in with your new password.',
  profile: Object.freeze({
    eyebrow: 'Account settings',
    title: 'Your profile.',
    description:
      'Keep the name shown on your verified typing records accurate.',
    save: 'Save changes',
    securityTitle: 'Session security',
    securityDescription:
      'Sign out of this account on every device and browser.',
    logoutAll: 'Sign out everywhere',
  }),
});

export const AUTH_VALIDATION = Object.freeze({
  passwordMinLength: 12,
  passwordMaxLength: 128,
  fullNameMaxLength: 150,
  emailMaxLength: 254,
});
