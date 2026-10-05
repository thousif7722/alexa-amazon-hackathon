import { validateWebUrl } from './url-validator.js';

export interface PageFetchResult {
  url: string;
  title: string;
  text: string;
  contentType: string;
  isTruncated?: boolean;
  contentLength?: number;
  isMock?: boolean;
}

export async function fetchAndExtractWebPage(targetUrl: string): Promise<PageFetchResult> {
  const validation = validateWebUrl(targetUrl);
  if (!validation.valid || !validation.url) {
    throw new Error(`Invalid URL: ${validation.reason || 'Validation failed'}`);
  }

  const url = validation.url;
  const timeoutMs = process.env.WEB_SEARCH_TIMEOUT_MS ? parseInt(process.env.WEB_SEARCH_TIMEOUT_MS, 10) : 10000;
  const maxBytes = process.env.WEB_PAGE_MAX_BYTES ? parseInt(process.env.WEB_PAGE_MAX_BYTES, 10) : 2000000;
  const maxChars = process.env.WEB_PAGE_MAX_TEXT_CHARS ? parseInt(process.env.WEB_PAGE_MAX_TEXT_CHARS, 10) : 30000;

  // Handle mock URLs (e.g. example.com domains from MockSearchProvider)
  if (url.hostname === 'example.com' || url.hostname.endsWith('.example.com')) {
    return generateMockPageContent(url.toString());
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ActionOS-WebSearchBot/1.0 (+https://actionos.onewayfix.com)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} fetching URL`);
    }

    const contentType = response.headers.get('content-type') || 'text/html';

    // Enforce max bytes stream reading
    const reader = response.body?.getReader();
    let rawData = '';
    let totalBytes = 0;

    if (reader) {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      while (totalBytes < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          rawData += decoder.decode(value, { stream: true });
        }
      }
      if (totalBytes >= maxBytes) {
        reader.cancel();
      }
    } else {
      rawData = await response.text();
    }

    // Extract title & text
    const titleMatch = rawData.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : url.hostname;

    let cleanText = extractReadableTextFromHTML(rawData);
    let isTruncated = false;

    if (cleanText.length > maxChars) {
      cleanText = cleanText.substring(0, maxChars) + '\n\n[Content truncated due to size limit]';
      isTruncated = true;
    }

    return {
      url: url.toString(),
      title,
      text: cleanText,
      contentType,
      isTruncated,
      contentLength: cleanText.length,
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Web page request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

function extractReadableTextFromHTML(html: string): string {
  // Strip script, style, noscript, svg, head, template tags
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Insert line breaks for block tags
  cleaned = cleaned.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|section|article)>/gi, '\n');

  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  cleaned = decodeHTMLEntities(cleaned);

  // Normalize whitespace & empty lines
  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.join('\n');
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function generateMockPageContent(rawUrl: string): PageFetchResult {
  const urlObj = new URL(rawUrl);
  const path = urlObj.pathname.toLowerCase();

  let title = 'Example Domain - Information Guide';
  let text = `Welcome to the official information guide for ${urlObj.hostname}.\n\nThis web page provides details about attractions, travel options, and local guidance.`;

  if (path.includes('hyderabad')) {
    title = 'Hyderabad Tourism - Official City Guide';
    text = `Hyderabad is the capital city of Telangana state in southern India.

Key Attractions & Heritage Sites:
1. Charminar: Built in 1591 by Sultan Muhammad Quli Qutb Shah, located in the Old City.
2. Golconda Fort: Famous medieval fortress known for acoustics, diamond mines, and royal palaces.
3. Hussain Sagar Lake: Large heart-shaped lake featuring a 18-meter monolithic Gautama Buddha statue.
4. Ramoji Film City: Certified by Guinness World Records as the world's largest film studio complex.
5. Salar Jung Museum: One of India's premier national museums housing ancient artifacts and European clock collections.

Local Cuisine:
Famous for Hyderabad Biryani, Haleem, and Irani Chai with Osmania biscuits.`;
  } else if (path.includes('bangalore')) {
    title = 'Bangalore Tourism - Garden City Guide';
    text = `Bangalore (Bengaluru) is the capital of Karnataka state, known as India's Silicon Valley and Garden City.

Top Attractions:
- Lalbagh Botanical Garden: 240-acre historic garden with famous Glass House.
- Bangalore Palace: Tudor-style royal palace.
- Cubbon Park: 300-acre green park in central Bengaluru.
- ISKCON Temple: Grand neo-classical temple complex.`;
  } else if (path.includes('bedrock')) {
    title = 'Amazon Bedrock - Managed Generative AI';
    text = `Amazon Bedrock is a fully managed service that offers choice of high-performing foundation models from AI startups and Amazon via a single API.

Features:
- Access to Amazon Nova Lite, Nova Pro, and leading third-party models.
- Converse API for multi-turn structured tool calling.
- Enterprise security and compliance.`;
  }

  return {
    url: rawUrl,
    title,
    text,
    contentType: 'text/html',
    isTruncated: false,
    contentLength: text.length,
    isMock: true,
  };
}
