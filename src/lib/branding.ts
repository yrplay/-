import { AgencySettings } from '../types';

let currentManifestBlobUrl: string | null = null;

/**
 * Updates browser tab title, favicon, touch icons, and PWA Web App Manifest dynamically
 * based on the user's custom AgencySettings.
 */
export function updateDynamicBranding(settings?: AgencySettings): void {
  if (!settings) return;

  const agencyName = settings.agencyName?.trim() || 'نظام محاسبة الدعاية والإعلان';
  const shortName = settings.appShortName?.trim() || agencyName.slice(0, 16);
  const subtitle = settings.agencySubtitle?.trim() || 'نظام محاسبي متكامل للطباعة واللوحات';
  const logoUrl = settings.agencyLogoUrl;

  // 1. Update Document Title
  document.title = agencyName;

  // 2. Update Meta Description and OpenGraph
  updateOrCreateMeta('description', subtitle);
  updateOrCreateMeta('og:title', agencyName, true);
  updateOrCreateMeta('og:description', subtitle, true);
  updateOrCreateMeta('application-name', agencyName);
  updateOrCreateMeta('apple-mobile-web-app-title', shortName);

  // 3. Update Favicon & Apple Touch Icon
  if (logoUrl) {
    updateOrCreateLink('icon', logoUrl, 'image/png');
    updateOrCreateLink('apple-touch-icon', logoUrl);
  } else {
    // Generate an elegant SVG favicon with the initial of the agency
    const initialChar = agencyName.charAt(0) || 'م';
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="24" fill="#0f766e"/>
        <text x="50" y="65" font-size="52" font-family="system-ui, sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">${initialChar}</text>
      </svg>
    `.trim();
    const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgIcon)}`;
    updateOrCreateLink('icon', svgDataUri, 'image/svg+xml');
    updateOrCreateLink('apple-touch-icon', svgDataUri);
  }

  // 4. Generate and update dynamic PWA Web App Manifest
  try {
    const manifestJson = {
      name: agencyName,
      short_name: shortName,
      description: subtitle,
      start_url: window.location.pathname || '/',
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#0f766e',
      lang: 'ar',
      dir: 'rtl',
      icons: logoUrl
        ? [
            {
              src: logoUrl,
              sizes: '192x192 512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ]
        : [],
    };

    const manifestBlob = new Blob([JSON.stringify(manifestJson)], { type: 'application/json' });
    if (currentManifestBlobUrl) {
      URL.revokeObjectURL(currentManifestBlobUrl);
    }
    currentManifestBlobUrl = URL.createObjectURL(manifestBlob);
    updateOrCreateLink('manifest', currentManifestBlobUrl);
  } catch (err) {
    console.warn('Unable to create dynamic PWA manifest:', err);
  }
}

function updateOrCreateMeta(nameOrProperty: string, content: string, isProperty: boolean = false) {
  const selector = isProperty ? `meta[property="${nameOrProperty}"]` : `meta[name="${nameOrProperty}"]`;
  let element = document.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    if (isProperty) {
      element.setAttribute('property', nameOrProperty);
    } else {
      element.setAttribute('name', nameOrProperty);
    }
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function updateOrCreateLink(rel: string, href: string, type?: string) {
  let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
  if (type) {
    element.setAttribute('type', type);
  }
}
