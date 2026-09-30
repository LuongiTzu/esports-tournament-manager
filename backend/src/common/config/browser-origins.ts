const DEFAULT_BROWSER_ORIGIN = 'http://localhost:3000';

type BrowserOriginEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, 'ALLOWED_ORIGINS' | 'FRONTEND_URL'>
>;

export function parseBrowserOrigins(value?: string): string[] {
  const origins = (value ?? DEFAULT_BROWSER_ORIGIN)
    .split(',')
    .map((origin) => normalizeBrowserOrigin(origin))
    .filter((origin): origin is string => origin !== null);

  if (origins.length === 0) {
    throw new Error('At least one browser origin must be configured');
  }

  return [...new Set(origins)];
}

export function configuredBrowserOrigins(
  env: BrowserOriginEnvironment = process.env,
): string[] {
  return parseBrowserOrigins(env.ALLOWED_ORIGINS ?? env.FRONTEND_URL);
}

export function isConfiguredBrowserOrigin(
  origin: string | undefined,
  configuredOrigins: readonly string[] = configuredBrowserOrigins(),
): boolean {
  if (!origin) return true;
  const normalizedOrigin = normalizeBrowserOrigin(origin);
  return (
    normalizedOrigin !== null && configuredOrigins.includes(normalizedOrigin)
  );
}

export function configuredCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  try {
    callback(null, isConfiguredBrowserOrigin(origin));
  } catch (error) {
    callback(error instanceof Error ? error : new Error(String(error)));
  }
}

function normalizeBrowserOrigin(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`Invalid browser origin: ${candidate}`);
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Invalid browser origin: ${candidate}`);
  }

  return url.origin;
}
