import WebApp from '@twa-dev/sdk';

export const triggerHaptic = (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
  if (typeof window !== 'undefined' && WebApp.HapticFeedback) {
    WebApp.HapticFeedback.impactOccurred(style);
  }
};

export const shareVideo = (url: string, title: string) => {
  triggerHaptic('light');
  if (typeof window !== 'undefined' && WebApp.openTelegramLink) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('🎬 Watch this drama: ' + title)}`;
    WebApp.openTelegramLink(shareUrl);
  }
};

export const getThemeColor = (type: 'bg' | 'text' | 'button') => {
  return typeof window !== 'undefined' ? WebApp.themeParams : {};
};