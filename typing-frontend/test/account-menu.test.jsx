import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountMenu } from '@/common-components';

describe('AccountMenu', () => {
  it('gives anonymous visitors a single sign-in action', () => {
    render(<AccountMenu />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(
      screen.queryByRole('button', { name: /open account menu/i }),
    ).not.toBeInTheDocument();
  });

  it('shows profile management actions only for an authenticated user', async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountMenu
        onSignOut={onSignOut}
        user={{
          id: 'user-1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /open account menu for ada lovelace/i }),
    );

    expect(screen.getByText('ada@example.com')).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /edit profile/i })).toHaveAttribute(
      'href',
      '/profile',
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /^sign out$/i }));
    await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce());
  });
});
