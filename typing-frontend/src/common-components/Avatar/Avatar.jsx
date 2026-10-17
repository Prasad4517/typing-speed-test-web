import { cn } from '@/utils/cn';

import { Icon } from '../Icon';
import styles from './Avatar.module.scss';

function getInitials(name) {
  if (!name) return null;

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** @param {{ name?: string, imageUrl?: string, size?: 'sm'|'md', className?: string }} props */
export function Avatar({ name, imageUrl, size = 'md', className }) {
  const initials = getInitials(name);

  return (
    <span
      aria-hidden="true"
      className={cn(styles.avatar, styles[`avatar--${size}`], className)}
    >
      {imageUrl ? (
        <img alt="" src={imageUrl} />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <Icon name="user" size={size === 'sm' ? 16 : 20} />
      )}
    </span>
  );
}
