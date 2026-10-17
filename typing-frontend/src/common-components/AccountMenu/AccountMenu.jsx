'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

import { Avatar } from '../Avatar';
import { Icon } from '../Icon';
import styles from './AccountMenu.module.scss';

function menuItems(container) {
  return Array.from(
    container?.querySelectorAll('[data-account-menu-item]') || [],
  );
}

/**
 * Account navigation only. Authentication remains owned by the future auth
 * provider; passing a user enables the authenticated menu.
 *
 * @param {{ user?: { id: string, name: string, email?: string, imageUrl?: string }|null, signInHref?: string, profileHref?: string, onSignOut?: () => Promise<void>|void, className?: string }} props
 */
export function AccountMenu({
  user = null,
  signInHref = ROUTES.signIn,
  profileHref = ROUTES.profile,
  onSignOut,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const isAuthenticated = Boolean(user?.id);

  useEffect(() => {
    if (!open) return undefined;

    const firstItem = menuItems(panelRef.current)[0];
    firstItem?.focus();

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  function moveFocus(event) {
    const items = menuItems(panelRef.current);
    const currentIndex = items.indexOf(document.activeElement);
    if (!items.length || currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
    if (event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = items.length - 1;

    if (nextIndex !== currentIndex) {
      event.preventDefault();
      items[nextIndex].focus();
    }
  }

  async function handleSignOut() {
    if (!onSignOut || isSigningOut) return;

    setIsSigningOut(true);
    setSignOutError('');
    try {
      await onSignOut();
      closeMenu();
      triggerRef.current?.focus();
    } catch {
      setSignOutError('We could not sign you out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <Link
        aria-label="Sign in"
        className={cn(styles.guest, className)}
        href={signInHref}
      >
        <Avatar size="sm" />
        <span>Sign in</span>
      </Link>
    );
  }

  return (
    <div className={cn(styles.root, className)} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Open account menu for ${user.name}`}
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        type="button"
      >
        <Avatar imageUrl={user.imageUrl} name={user.name} size="sm" />
      </button>

      {open ? (
        <div
          aria-label="Account menu"
          className={styles.panel}
          onKeyDown={moveFocus}
          ref={panelRef}
          role="menu"
        >
          <div className={styles.identity}>
            <Avatar imageUrl={user.imageUrl} name={user.name} />
            <div>
              <strong>{user.name}</strong>
              {user.email ? <span>{user.email}</span> : null}
            </div>
          </div>
          <div className={styles.divider} />
          <Link
            className={styles.item}
            data-account-menu-item
            href={profileHref}
            onClick={closeMenu}
            role="menuitem"
          >
            <Icon name="user" size={16} />
            Edit profile
          </Link>
          <button
            className={cn(styles.item, styles.signOut)}
            data-account-menu-item
            disabled={!onSignOut || isSigningOut}
            onClick={handleSignOut}
            role="menuitem"
            type="button"
          >
            <Icon name="sign-out" size={16} />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
          {signOutError ? (
            <p className={styles.error} role="alert">
              {signOutError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
