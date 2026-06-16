import { spawnSync } from 'child_process';

function run(cmd: string, args: string[], env?: Record<string, string>): number {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  return result.status ?? 1;
}

function main() {
  const updateBaseline = process.argv.includes('--update-baseline');

  // Step 1: build
  const buildT0 = Date.now();
  const buildCode = run('npm', ['run', 'build']);
  if (buildCode !== 0) process.exit(buildCode);
  const buildMs = Date.now() - buildT0;

  // Step 2: measure bundle
  const bundleCode = run('tsx', ['scripts/measure-bundle.ts']);
  if (bundleCode !== 0) process.exit(bundleCode);

  // Step 3: playwright perf spec
  const pwCode = run('npx', ['playwright', 'test', '--config=playwright.perf.config.ts']);
  if (pwCode !== 0) process.exit(pwCode);

  // Step 4: generate report
  const reportArgs = ['scripts/perf-report.ts'];
  if (updateBaseline) reportArgs.push('--update-baseline');
  const reportCode = run('tsx', reportArgs, { PERF_BUILD_MS: String(buildMs) });
  process.exit(reportCode);
}

main();
