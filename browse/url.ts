// Address bar helpers for /browse/.

// "roblox.com/games/1" → https://www.roblox.com/games/1; anything else → a Roblox search.
export function toUrl(text: string): string {
  const value = text.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) return `https://${value}`;
  return `https://www.roblox.com/discover/?Keyword=${encodeURIComponent(value)}`;
}

// The real address of the page in the frame, from its proxied location.
export function realUrl(href: string, framePrefix: string): string | null {
  const url = new URL(href);
  if (!url.pathname.startsWith(framePrefix)) return null;
  try {
    return decodeURIComponent(url.pathname.slice(framePrefix.length) + url.search + url.hash);
  } catch {
    return null;
  }
}
