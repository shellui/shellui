import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface IconProps {
  path: string;
  className?: string;
  size?: number;
}

/**
 * Icon component that loads SVG icons from a path and renders them inline
 * @param path - Path to the SVG file (e.g., '/icons/panel-left.svg')
 * @param className - Additional CSS classes
 * @param size - Icon size in pixels (default: 24)
 */
export const Icon: React.FC<IconProps> = ({ path, className, size = 24 }) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setError('Icon path is required');
      setLoading(false);
      return;
    }

    // Fetch SVG content
    fetch(path)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load icon: ${res.status} ${res.statusText}`);
        }
        return res.text();
      })
      .then((text) => {
        setSvgContent(text);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        console.error(`Failed to load icon from ${path}:`, err);
        setError(err.message);
        setLoading(false);
      });
  }, [path]);

  if (loading) {
    return null;
  }

  if (error || !svgContent) {
    return null;
  }

  // Parse SVG and inject className and size
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElement = svgDoc.documentElement;

  // Check for parsing errors
  const parserError = svgDoc.querySelector('parsererror');
  if (parserError) {
    console.error(`Failed to parse SVG from ${path}`);
    return null;
  }

  // Set attributes
  svgElement.setAttribute('width', size.toString());
  svgElement.setAttribute('height', size.toString());
  svgElement.setAttribute('class', cn('inline-block', className));
  
  // Ensure stroke and fill can be styled via CSS
  if (!svgElement.getAttribute('stroke')) {
    svgElement.setAttribute('stroke', 'currentColor');
  }
  if (!svgElement.getAttribute('fill')) {
    svgElement.setAttribute('fill', 'none');
  }

  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgElement.outerHTML }}
    />
  );
};

/**
 * Helper function to get icon component from icon path
 * @param iconPath - Path to the SVG file (e.g., '/icons/panel-left.svg')
 * @returns Icon component or null if path is invalid
 */
export const getIconComponent = (iconPath: string | undefined) => {
  if (!iconPath || typeof iconPath !== 'string') return null;
  
  return (props: { className?: string }) => (
    <Icon path={iconPath} className={props.className} size={16} />
  );
};
