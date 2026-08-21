import React from 'react';

export default function DocumentationWordmark({alt, height = 28}) {
  return (
    <svg
      viewBox="0 0 268 24"
      height={height}
      role="img"
      aria-label={alt}
      overflow="visible">
      <title>{alt}</title>
      <text
        x="0"
        y="18"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="16.5">
        <tspan fontWeight="700" letterSpacing="-0.02em">
          shellui
        </tspan>
        <tspan fontWeight="400"> | documentation</tspan>
      </text>
    </svg>
  );
}
