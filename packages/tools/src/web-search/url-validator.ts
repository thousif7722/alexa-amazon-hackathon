export interface URLValidationResult {
  valid: boolean;
  reason?: string;
  url?: URL;
}

export function validateWebUrl(rawUrl: string): URLValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'URL string is required' };
  }

  const trimmed = rawUrl.trim();

  // Reject malicious pseudo-protocols explicitly
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('ftp:') ||
    trimmed.startsWith('gopher:')
  ) {
    return { valid: false, reason: `Forbidden protocol scheme in URL: ${trimmed.split(':')[0]}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (_err) {
    return { valid: false, reason: 'Malformed URL syntax' };
  }

  // Must strictly be HTTP or HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Only HTTP and HTTPS protocols are permitted (got ${parsed.protocol})` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Allow explicit opt-in for dev testing if environment variable set, otherwise REJECT
  const allowLocalhost = process.env.ALLOW_LOCALHOST === 'true';

  if (!allowLocalhost) {
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return { valid: false, reason: `Access to localhost and internal hostnames is strictly forbidden: ${hostname}` };
    }
  }

  // Check IPv4 private and link-local address ranges (SSRF protection)
  if (isPrivateOrLocalIPv4(hostname)) {
    return { valid: false, reason: `Access to private or link-local IP range is forbidden: ${hostname}` };
  }

  // Check IPv6 private address ranges
  if (isPrivateOrLocalIPv6(hostname)) {
    return { valid: false, reason: `Access to private IPv6 range is forbidden: ${hostname}` };
  }

  return { valid: true, url: parsed };
}

function isPrivateOrLocalIPv4(host: string): boolean {
  // Matches standard dotted decimal IPv4
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const [, oct1, oct2] = ipv4Match.map((n) => parseInt(n, 10));

  // 127.0.0.0/8 (Loopback)
  if (oct1 === 127) return true;

  // 10.0.0.0/8 (Private)
  if (oct1 === 10) return true;

  // 172.16.0.0/12 (Private)
  if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (oct1 === 192 && oct2 === 168) return true;

  // 169.254.0.0/16 (Link-Local & AWS Instance Metadata Server 169.254.169.254)
  if (oct1 === 169 && oct2 === 254) return true;

  // 0.0.0.0/8
  if (oct1 === 0) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (oct1 === 100 && oct2 >= 64 && oct2 <= 127) return true;

  return false;
}

function isPrivateOrLocalIPv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') return true;
  if (clean.startsWith('fe80:') || clean.startsWith('fc00:') || clean.startsWith('fd00:')) return true;
  return false;
}
