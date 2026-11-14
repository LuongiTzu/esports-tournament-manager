/** The production gateway is the only proxy hop; direct deployments trust none. */
export function trustedProxyHops(env: NodeJS.ProcessEnv = process.env): 0 | 1 {
  const configured = env.TRUST_PROXY_HOPS?.trim() || '0';
  if (configured === '0') return 0;
  if (configured === '1') return 1;
  throw new Error(
    'TRUST_PROXY_HOPS must be 0 (direct) or 1 (behind the gateway)',
  );
}
