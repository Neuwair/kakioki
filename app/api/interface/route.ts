import { NextResponse } from "next/server";
import type { LinkPreview } from "@/lib/media/MediaTypes";

const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function getDomain(url: URL): string {
  return url.hostname.replace(/^www\./i, "");
}

function buildYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

async function buildYouTubePreview(
  targetUrl: URL
): Promise<LinkPreview | null> {
  const match = targetUrl.href.match(YOUTUBE_REGEX);
  if (!match) {
    return null;
  }
  const videoId = match[1];
  let title: string | undefined;
  let description: string | undefined;
  let thumbnail: string | undefined;
  try {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", targetUrl.href);
    endpoint.searchParams.set("format", "json");
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });
    if (response.ok) {
      const data = (await response.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      title = data.title ?? title;
      description = data.author_name ?? description;
      thumbnail = data.thumbnail_url ?? thumbnail;
    }
  } catch {}
  return {
    url: targetUrl.href,
    type: "youtube",
    title: title ?? "YouTube Video",
    description,
    image: thumbnail ?? buildYouTubeThumbnail(videoId),
    youtubeId: videoId,
    domain: getDomain(targetUrl),
  };
}

function extractMeta(
  html: string,
  attribute: "property" | "name",
  key: string
): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern);
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return undefined;
}

function toAbsoluteUrl(base: URL, value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value, base).href;
  } catch {
    return undefined;
  }
}

async function buildWebsitePreview(targetUrl: URL): Promise<LinkPreview> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(targetUrl.href, {
      signal: controller.signal,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      next: { revalidate: 300 },
    });
    const domain = getDomain(targetUrl);
    if (!response.ok) {
      return {
        url: targetUrl.href,
        type: "website",
        title: domain,
        domain,
      };
    }
    const html = await response.text();
    const title =
      extractMeta(html, "property", "og:title") ??
      extractMeta(html, "name", "twitter:title") ??
      extractTitle(html) ??
      domain;
    const description =
      extractMeta(html, "property", "og:description") ??
      extractMeta(html, "name", "description") ??
      extractMeta(html, "name", "twitter:description");
    const image = toAbsoluteUrl(
      targetUrl,
      extractMeta(html, "property", "og:image") ??
        extractMeta(html, "name", "twitter:image")
    );
    return {
      url: targetUrl.href,
      type: "website",
      title,
      description,
      image,
      domain,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function ensureHttpUrl(value: string): URL {
  const trimmed = value.trim();
  const prefixed = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(prefixed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }
  return url;
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const urlValue =
    typeof raw === "object" && raw !== null
      ? (raw as { url?: string }).url
      : undefined;
  if (!urlValue || typeof urlValue !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  let target: URL;
  try {
    target = ensureHttpUrl(urlValue);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (YOUTUBE_REGEX.test(target.href)) {
    const youtubePreview = await buildYouTubePreview(target);
    if (youtubePreview) {
      return NextResponse.json(youtubePreview);
    }
  }
  try {
    const websitePreview = await buildWebsitePreview(target);
    return NextResponse.json(websitePreview);
  } catch {
    return NextResponse.json({ error: "Preview unavailable" }, { status: 502 });
  }
}
