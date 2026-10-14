/**
 * Public URL of an RFP's page, or null when the deployment's address isn't known. Uses RFPMANAGER_API_BASE_URL,
 * else Vercel's production domain. Telegram URL buttons need https, so anything else counts as unknown.
 */
export function rfpPageUrl(rfpId: string): string | null {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const base = process.env.RFPMANAGER_API_BASE_URL?.trim() || (productionHost ? `https://${productionHost}` : "");
  if (!/^https:\/\/[^\s/]+/.test(base)) return null;
  return `${base.replace(/\/+$/, "")}/rfp/${encodeURIComponent(rfpId)}`;
}
