import QRCode from 'qrcode';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

/**
 * Generate a safe base64 data URL for a QR Code.
 * Data URLs do not have an origin and will never cause canvas taint errors.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 256,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code data URL:', err);
    return '';
  }
}

/**
 * Renders a source element into a high-fidelity HTML Canvas using an isolated off-screen clone.
 * This guarantees:
 * 1. Consistent desktop A4 dimensions regardless of device screen size (mobile, tablet, desktop).
 * 2. Complete document height capture (no scroll clipping or white empty cutoffs).
 * 3. Arabic letter connection preservation (forces normal letter-spacing).
 * 4. Strips any interactive buttons, upload inputs, or print:hidden elements.
 */
async function renderOffscreenCanvas(sourceElement: HTMLElement): Promise<HTMLCanvasElement> {
  // Standard A4 width at 96 DPI is 794px (210mm)
  const A4_WIDTH_PX = 794;
  const A4_MIN_HEIGHT_PX = 1123; // 297mm at 96 DPI

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = `${A4_WIDTH_PX}px`;
  container.style.minHeight = `${A4_MIN_HEIGHT_PX}px`;
  container.style.background = '#ffffff';
  container.style.zIndex = '-99999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  container.style.direction = 'rtl';
  container.style.fontFamily = "'Cairo', system-ui, -apple-system, sans-serif";

  // Deep clone the printable sheet
  const clone = sourceElement.cloneNode(true) as HTMLElement;

  // Remove interactive buttons, file inputs, and print-hidden elements from the export clone
  clone.querySelectorAll('button, .print\\:hidden, input[type="file"], .no-print').forEach((el) => {
    el.remove();
  });

  // Force pure document layout and clean typography
  clone.style.width = `${A4_WIDTH_PX}px`;
  clone.style.maxWidth = `${A4_WIDTH_PX}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.padding = '32px';
  clone.style.background = '#ffffff';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0px';
  clone.style.letterSpacing = 'normal';

  // Critical for Arabic: Ensure all nested elements have normal letter spacing so letters do not detach
  clone.querySelectorAll('*').forEach((child) => {
    const el = child as HTMLElement;
    if (el.style) {
      el.style.letterSpacing = 'normal';
    }
  });

  container.appendChild(clone);
  document.body.appendChild(container);

  // Wait for all images inside the clone (logo, stamp, QR) to be fully loaded
  const images = Array.from(clone.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 2000); // 2s timeout fallback
      });
    })
  );

  // Brief pause for font layout stabilization
  await new Promise((r) => setTimeout(r, 180));

  try {
    const calculatedHeight = Math.max(clone.scrollHeight, clone.offsetHeight, A4_MIN_HEIGHT_PX);

    const canvas = await html2canvas(clone, {
      scale: 2, // High resolution (retina 2x)
      width: A4_WIDTH_PX,
      height: calculatedHeight,
      windowWidth: A4_WIDTH_PX,
      windowHeight: calculatedHeight,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      scrollY: 0,
      scrollX: 0,
    });

    return canvas;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Highly robust document printing that works across:
 * 1. Regular desktop & mobile browsers (via isolated hidden iframe print)
 * 2. Embedded iframes (like Google AI Studio preview sandbox)
 * 3. Pop-up blocked environments (gracefully falls back to high-res PDF export if system print dialog is restricted)
 */
export async function smartPrintDocument(
  sourceElement: HTMLElement,
  docTitle: string
): Promise<{ success: boolean; method: 'iframe' | 'window' | 'pdf'; error?: string }> {
  // Method 1: Try printing via an isolated hidden iframe
  // This extracts ONLY the document HTML, styles, and images into a pristine page without modals or overlays
  try {
    const printIframe = document.createElement('iframe');
    printIframe.setAttribute('id', 'isolated-print-frame');
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0px';
    printIframe.style.height = '0px';
    printIframe.style.border = 'none';
    printIframe.style.opacity = '0';
    printIframe.style.pointerEvents = 'none';
    printIframe.style.zIndex = '-9999';
    printIframe.setAttribute('title', docTitle);
    document.body.appendChild(printIframe);

    const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
    if (iframeDoc) {
      // Gather stylesheets
      const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((tag) => tag.outerHTML)
        .join('\n');

      // Clone element and strip buttons
      const clone = sourceElement.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('button, .print\\:hidden, input, .no-print').forEach((el) => el.remove());

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  ${styleTags}
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
      letter-spacing: normal !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    * {
      letter-spacing: normal !important;
      box-sizing: border-box !important;
    }
    .print\\:hidden, button, input {
      display: none !important;
    }
    #print-wrap {
      width: 100% !important;
      max-width: 210mm !important;
      margin: 0 auto !important;
      background: #ffffff !important;
      padding: 0 !important;
    }
  </style>
</head>
<body>
  <div id="print-wrap">
    ${clone.outerHTML}
  </div>
</body>
</html>`);
      iframeDoc.close();

      // Wait for images in iframe to load
      const images = Array.from(iframeDoc.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 2000);
          });
        })
      );

      await new Promise((r) => setTimeout(r, 200));

      let printed = false;
      try {
        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
        printed = true;
      } catch (err) {
        console.warn('iframe.contentWindow.print was blocked or threw error:', err);
      }

      // Cleanup iframe after a delay
      setTimeout(() => {
        if (document.body.contains(printIframe)) {
          document.body.removeChild(printIframe);
        }
      }, 60000);

      if (printed) {
        return { success: true, method: 'iframe' };
      }
    }
  } catch (iframeErr) {
    console.warn('Hidden iframe print error:', iframeErr);
  }

  // Method 2: Try direct window.print()
  try {
    window.focus();
    window.print();
    return { success: true, method: 'window' };
  } catch (windowErr) {
    console.warn('window.print direct failed:', windowErr);
  }

  // Method 3: Fallback to direct high-res PDF generation and download
  try {
    const pdfRes = await exportSafePdf(sourceElement, docTitle);
    return { success: pdfRes.success, method: 'pdf', error: pdfRes.error };
  } catch (pdfErr: any) {
    return { success: false, method: 'pdf', error: pdfErr?.message || 'Print execution failed' };
  }
}

/**
 * Print an element reliably across all devices.
 * Uses direct window.print() combined with active document focus.
 */
export function printElementDirectly(): void {
  try {
    window.focus();
    window.print();
  } catch (err) {
    console.error('Error triggering window.print():', err);
  }
}

/**
 * Backward-compatible helper for printing.
 */
export function openCleanPrintWindow(_title: string, _element: HTMLElement): void {
  printElementDirectly();
}

/**
 * Safely export an element to a crisp, professional A4 PDF file.
 * Automatically fits single-page documents onto exactly 1 page with zero cutoff and zero blank slivers.
 */
export async function exportSafePdf(
  element: HTMLElement,
  filename: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const canvas = await renderOffscreenCanvas(element);
    const imgData = canvas.toDataURL('image/jpeg', 0.96);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pdfWidth = 210; // mm
    const pdfHeight = 297; // mm
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    // If the content fits on 1 page (or is close to 1 page, within 5% tolerance), scale it cleanly into 1 page
    if (imgHeight <= pdfHeight * 1.06) {
      const renderedHeight = Math.min(pdfHeight, imgHeight);
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, renderedHeight, undefined, 'FAST');
    } else {
      // Clean multi-page pagination with exact page-boundary slices
      let position = 0;
      let remainingHeight = imgHeight;

      while (remainingHeight > 5) {
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        remainingHeight -= pdfHeight;
        position -= pdfHeight;

        if (remainingHeight > 5) {
          pdf.addPage();
        }
      }
    }

    const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    try {
      pdf.save(safeName);
    } catch {
      // Fallback blob download
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    }

    return { success: true };
  } catch (err: any) {
    console.error('exportSafePdf error:', err);
    return {
      success: false,
      error: err?.message || 'تعذر استخراج ملف PDF تلقائياً.',
    };
  }
}

/**
 * Safely export an element to a crisp PNG image.
 */
export async function exportSafePng(
  element: HTMLElement,
  filename: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const canvas = await renderOffscreenCanvas(element);
    const imgData = canvas.toDataURL('image/png');
    const safeName = filename.endsWith('.png') ? filename : `${filename}.png`;

    const link = document.createElement('a');
    link.download = safeName;
    link.href = imgData;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 1000);

    return { success: true };
  } catch (err: any) {
    console.error('exportSafePng error:', err);
    return {
      success: false,
      error: err?.message || 'تعذر حفظ المستند كصورة.',
    };
  }
}
