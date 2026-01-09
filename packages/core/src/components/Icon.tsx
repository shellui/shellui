import React from 'react';
import { cn } from '@/lib/utils';

interface IconProps {
  path: string;
  className?: string;
  size?: number;
}

/**
 * Icon component that displays SVG icons using an img tag
 * @param path - Path to the SVG file (e.g., '/icons/panel-left.svg')
 * @param className - Additional CSS classes
 * @param size - Icon size in pixels (default: 24)
 */
const IconComponent: React.FC<IconProps> = ({ path, className, size = 24 }) => {
  if (!path) {
    return null;
  }

  return (
    <img
      src={path}
      alt=""
      className={cn('inline-block', className)}
      style={{ width: size, height: size }}
      loading="eager"
      decoding="sync"
    />
  );
};

IconComponent.displayName = 'Icon';

export const Icon = React.memo(IconComponent);

// Cache for icon component factories to prevent recreation
const iconComponentCache = new Map<string, (props: { className?: string }) => React.ReactElement>();

/**
 * Helper function to get icon component from icon path
 * @param iconPath - Path to the SVG file (e.g., '/icons/panel-left.svg')
 * @returns Icon component or null if path is invalid
 */
export const getIconComponent = (iconPath: string | undefined) => {
  if (!iconPath || typeof iconPath !== 'string') return null;
  
  // Return cached component if it exists
  if (iconComponentCache.has(iconPath)) {
    return iconComponentCache.get(iconPath)!;
  }
  
  // Create and cache new component
  const component = (props: { className?: string }) => (
    <Icon path={iconPath} className={props.className} size={16} />
  );
  iconComponentCache.set(iconPath, component);
  return component;
};
