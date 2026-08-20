import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useThemeConfig} from '@docusaurus/theme-common';

function DocumentationWordmark({alt}) {
  return (
    <svg
      viewBox="0 0 268 24"
      height={22}
      role="img"
      aria-label={alt}
      overflow="visible"
    >
      <title>{alt}</title>
      <text
        x="0"
        y="18"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="16.5"
      >
        <tspan fontWeight="700" letterSpacing="-0.02em">
          shellui
        </tspan>
        <tspan fontWeight="400"> | documentation</tspan>
      </text>
    </svg>
  );
}

export default function Logo(props) {
  const {
    siteConfig: {title},
  } = useDocusaurusContext();
  const {
    navbar: {title: navbarTitle, logo},
  } = useThemeConfig();

  const {imageClassName, titleClassName, ...propsRest} = props;
  const logoLink = useBaseUrl(logo?.href || '/');
  const fallbackAlt = navbarTitle ? '' : title;
  const alt = logo?.alt ?? fallbackAlt;

  return (
    <Link
      to={logoLink}
      {...propsRest}
      {...(logo?.target && {target: logo.target})}
    >
      {logo && (
        <div className={imageClassName}>
          <DocumentationWordmark alt={alt} />
        </div>
      )}
      {navbarTitle != null && <b className={titleClassName}>{navbarTitle}</b>}
    </Link>
  );
}
