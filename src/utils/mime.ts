export function detectMimeType(mimetype: string): 'image' | 'video' | 'gif' | null {
  if (mimetype === 'image/gif') return 'gif';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return null;
}

export function isImageMessage(msg: Record<string, unknown>): boolean {
  return 'imageMessage' in msg;
}

export function isVideoMessage(msg: Record<string, unknown>): boolean {
  return 'videoMessage' in msg;
}

export function isGifMessage(msg: Record<string, unknown>): boolean {
  const videoMsg = msg.videoMessage as Record<string, unknown> | undefined;
  return videoMsg?.gifPlayback === true;
}
