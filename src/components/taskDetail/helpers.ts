export const parseCommentContent = (content: string) => {
  if (!content) return { text: '', images: [] as string[] };
  const regex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    images.push(match[1]);
  }
  const cleanText = content.replace(regex, '').trim();
  return {
    text: cleanText,
    images,
  };
};

export const formatActivityTime = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const isImageUrl = (url: string): boolean => {
  const clean = url.trim();
  if (
    !clean.startsWith('http://') &&
    !clean.startsWith('https://') &&
    !clean.startsWith('data:image/')
  )
    return false;
  if (clean.startsWith('data:image/')) return true;

  try {
    const urlObj = new URL(clean);
    const pathname = urlObj.pathname.toLowerCase();
    const cleanUrl = clean.toLowerCase();

    // Check extension in pathname
    if (
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.webp') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.bmp') ||
      pathname.endsWith('.tiff') ||
      pathname.endsWith('.ico')
    ) {
      return true;
    }

    // Check keywords anywhere in the URL (case-insensitive)
    if (
      cleanUrl.includes('/uploads/') ||
      cleanUrl.includes('/image') ||
      cleanUrl.includes('/img/') ||
      cleanUrl.includes('/avatar') ||
      cleanUrl.includes('/photo') ||
      cleanUrl.includes('/pic/') ||
      cleanUrl.includes('placeholder')
    ) {
      return true;
    }

    // Check query params for format
    const format = urlObj.searchParams.get('format') || urlObj.searchParams.get('fmt');
    if (format && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(format.toLowerCase())) {
      return true;
    }
  } catch {
    const lower = clean.toLowerCase();
    return (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp')
    );
  }

  return false;
};
