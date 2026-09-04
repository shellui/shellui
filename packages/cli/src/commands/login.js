import pc from 'picocolors';
import { writeCredentials } from '../auth/credentials.js';
import { runLoginFlow } from '../auth/login-flow.js';
import { resolveAuthTarget, validateAuthTarget } from '../auth/resolve-target.js';

/**
 * @param {string} [root]
 * @param {{ config?: string, provider?: string }} options
 */
export async function loginCommand(root = '.', options = {}) {
  const target = resolveAuthTarget({
    root: root || '.',
    config: options.config,
  });
  const targetError = validateAuthTarget(target);
  if (targetError) {
    console.error(pc.red(targetError));
    process.exitCode = 1;
    return;
  }

  console.log(
    pc.dim(
      `Config: ${target.configDir} → identity ${target.backendUrl} · company ${target.companyId}`,
    ),
  );

  let tokens;
  try {
    tokens = await runLoginFlow({
      backendUrl: target.backendUrl,
      companyId: /** @type {string} */ (target.companyId),
      provider: options.provider,
    });
  } catch (err) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
    return;
  }

  writeCredentials({
    backendUrl: target.backendUrl,
    companyId: target.companyId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    tokenType: tokens.tokenType,
  });

  console.log(pc.green('Logged in successfully.'));
  console.log(pc.dim('Run shellui whoami to verify your account.'));
}
