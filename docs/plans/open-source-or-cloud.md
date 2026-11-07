---
title: Open source or Cloud plan
sidebar_label: Open Source or Cloud Plan
description: 'Content plan for the Open source or Cloud page: goal, audience, outline, and open questions.'
---

This plan is the spec for [Open source or Cloud](/open-source-or-cloud). The page is Conceptual. This docs site has no content-type frontmatter field, so the type is recorded here.

An AI assistant drafted the page and this plan. The draft names no model and no provider. The author is accountable for the claims. A reviewer should check them against the sources below.

## Goal

Explain how to choose infrastructure you run versus the invite-only hosted service, and send you to an existing guide.

## Audience

Developers deciding where a Shellui shell and its services will run. Contributors who need a local checkout are a second audience, in one section, so they do not follow the production path by mistake.

## Outline

1. Define self-hosting and Cloud. Cloud means the hosted service on the waitlist.
2. Say when self-hosting fits, including infrastructure cost.
3. Say when the waitlist fits, and mark unpublished hosted operations as future and subject to availability.
4. Separate contributor setup from a production deployment.
5. Compare operating responsibility. Do not invent a feature split.
6. Link the shared shell, authentication, administration, and storage pages.
7. Link the next install, production, preview, playground, waitlist, and contributor guides.

## Sources checked

- `LICENSE` and root `package.json`: MIT
- [Waitlist](https://shellui.com/waitlist/): invite-only hosted service; self-hosting remains available
- [Pricing](https://shellui.com/pricing/): free under MIT; paid help is consulting, not a hosted plan or a usage meter
- [Run identity-service](/identity/getting-started), [Security hardening](/identity/security-hardening), [Metrics](/identity/metrics)
- [Run storage-service](/storage/getting-started) and [Security hardening](/storage/security)
- [Run hosting-service](/hosting/getting-started), [Security hardening](/hosting/security-hardening), and [Deploy with the CLI](/hosting/deploy-with-cli)
- [Run email-service](/email/getting-started), [Security](/email/security), [Metrics](/email/metrics), and [Providers](/email/providers)
- [Create a project](/quickstart), [Connect a backend](/backend), [Authentication](/features/authentication), [Administration](/features/administration), [Storage](/features/storage), [Sentry](/sentry)
- [Development](/development) and [Local dev stack](/dev-stack)

## Open questions

- The waitlist does not say whether a future hosted service would run the shell only, or also identity-service, storage-service, hosting-service, and email-service.
- No doc lists a hosted-only feature. The page assumes the MIT docs are the feature set. Confirm before adding a gate.
- Regions, backups, monitoring, support, and any uptime commitment for the hosted service are unpublished. Leave those table cells as unpublished until a source exists.
- `shellui login` documents a default `backend.url` of `https://id.shellui.com`. This page does not treat that host as Cloud. Confirm what that origin is before linking it here.
- The website privacy policy names processors for waitlist email. That is form handling. It is not a residency claim for a hosted product, so the page omits it.
- No production Compose file for every service showed up in the handbooks above. [Issue 88](https://github.com/shellui/shellui/issues/88) asks for one. The page does not invent that file.
- The production sections name Postgres or a data volume. They do not document a backup job. Confirm before adding backup steps.
