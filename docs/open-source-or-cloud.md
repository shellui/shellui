---
title: Open source or Cloud
sidebar_label: Open Source or Cloud
description: 'Choose the MIT-licensed Shellui source on infrastructure you run, or the invite-only waitlist for a hosted service.'
---

Shellui is an open-source web app platform under the [MIT license](https://github.com/shellui/shellui/blob/main/LICENSE). You can run the shell and its services on infrastructure you control. Shellui does not offer that stack as a hosted service today.

On this page, Cloud means the hosted service on the [waitlist](https://shellui.com/waitlist/). You leave an email there. Shellui sends an invite when a spot opens. Use this page to choose who operates the stack, then open the guide that matches that choice.

## Choose self-hosting when you need control

Self-hosting means you run the processes. Choose it when you need the source on hosts you administer. You pick where data sits, and you keep provider credentials there.

You still pay for the machines, database, Redis, object storage, and mail provider you select. The MIT license covers the software. Your host and provider bills stay yours.

`shellui build` writes the shell as static files under `dist/web/`. Sign-in, files, previews, and mail are separate services you run beside it. Shellui does not publish one Docker Compose file that starts every service for production. Follow each service's production section.

## Join the waitlist when you want a hosted service later

Join the [hosted Shellui waitlist](https://shellui.com/waitlist/) when you want a hosted service and you can wait for an invite. The waitlist page says the hosted service opens by invite, and that you can self-host today.

That page does not list regions, backups, a support commitment, or a status page. It does not list a feature set that exists only on the hosted service. The [pricing page](https://shellui.com/pricing/) says Shellui is free to use, modify, and distribute. It describes paid help as consulting, and it says that help is not a hosted plan or a usage meter.

Hosted operations on this page are future work, and they are subject to availability. Where the table says nothing is published, that is an absence of a commitment. It is not a promise that Shellui will do the work.

## Separate contributor setup from a deployment

Changing Shellui and running a deployment are different jobs.

Use [Development](/development) when you change `@shellui/cli`, `@shellui/core`, or `@shellui/sdk` in this repository.

Use the [local dev stack](/dev-stack) when you want the shell and the service checkouts on your machine. That Docker Compose file mounts your code and reloads on save. Some repositories in its clone list are private. Treat that page as a development environment.

For a deployment, follow the production section of each service you enable. Start with identity-service. storage-service, hosting-service, and email-service check the tokens it issues.

## Compare the operating model

The shell, authentication, administration, and storage behave as these docs describe them. The table says who operates the surrounding infrastructure. It does not split product features between the two columns.

| Responsibility            | Self-hosted                                                                                                                              | Hosted Shellui (Cloud)                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Software                  | MIT source. You may run, modify, and redistribute it.                                                                                    | Same MIT project. The waitlist publishes no second feature set.                                       |
| Hosting                   | You run the static shell and each service image you enable.                                                                              | Invite-only. [Join the waitlist](https://shellui.com/waitlist/). The waitlist publishes no host list. |
| Configuration             | You set `shellui.config.json` and each service environment.                                                                              | The waitlist stores an email. It does not open an account or a console.                               |
| Updates                   | You pin npm versions and image tags, then apply them.                                                                                    | No update policy is published.                                                                        |
| Backups and recovery      | You keep PostgreSQL or the service data volume, Redis, and the file store. The production sections do not document a Shellui backup job. | No recovery commitment is published.                                                                  |
| Monitoring                | You scrape Prometheus where a service documents metrics. You can set [Sentry](/sentry) on production shell builds.                       | No uptime commitment is published in these docs.                                                      |
| Credentials and providers | You create the OAuth apps and store the mail provider credentials.                                                                       | No credential vault is published.                                                                     |
| Data placement            | You choose the hosts, the database, and the blob backend.                                                                                | No region or residency claim is published.                                                            |

## Shared shell capabilities

Your app runs in an iframe inside the shell. The shell shares navigation, authentication, administration, and storage. You point them at the origins you run:

- [Connect a backend](/backend): set `backend.url` to identity-service, use Supabase Auth, or omit sign-in
- [Authentication](/features/authentication): `/login`, sessions, and `requiresAuth`
- [Administration](/features/administration): the staff admin iframe at `backend.adminUrl`
- [Storage](/features/storage): `storage.url`, quota, and `shellui.storage`

Email and hosting are further origins in the same config. Set `email.url` for [email-service](/email) and `hosting.url` for [hosting-service](/hosting). On the shell identity server, the shell forwards those URLs to the iframe app. It does not start the services.

## Open the next guide

Run the stack yourself:

1. [Install the CLI](/installation), then [create a project](/quickstart).
2. [Build the static shell](/quickstart#build-for-production). Put `dist/web/` on an origin you control.
3. [Run identity-service](/identity/getting-started), then follow [Deploy to production](/identity/getting-started#deploy-to-production) and [Security hardening](/identity/security-hardening).
4. Add the services you need. Each guide has a production section: [Run storage-service](/storage/getting-started#run-it-in-production), [Run hosting-service](/hosting/getting-started#run-it-in-production), and [Run email-service](/email/getting-started#run-it-in-production).
5. For previews, [Deploy with the CLI](/hosting/deploy-with-cli). `shellui deploy` uploads a 7-day preview to hosting-service. It does not replace the production sections above.
6. Optional checks: [identity metrics](/identity/metrics), [email metrics](/email/metrics), and [Sentry](/sentry) for production shell builds.

Try a shell before you install, or ask for a hosted invite:

- [Playground](https://playground.shellui.com): a running shell in the browser
- [Join the waitlist](https://shellui.com/waitlist/): an invite when the hosted service has a spot

Change the Shellui source:

- [Development](/development): this repository
- [Local dev stack](/dev-stack): service checkouts on your machine

Source is on [GitHub](https://github.com/shellui/shellui). The content plan for this page is [Open source or Cloud plan](/plans/open-source-or-cloud).
