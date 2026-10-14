import React, { useState } from 'react';
import { Download, Smartphone, Laptop, X, CheckCircle2, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'button',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(() => {
    return sessionStorage.getItem('pwa_banner_dismissed') === 'true';
  });

  // If running in standalone mode (already installed), do not show
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const handleDismissBanner = () => {
    setDismissedBanner(true);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (variant === 'banner') {
    if (dismissedBanner) return null;

    return (
      <>
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white px-4 py-2.5 border-b border-emerald-500/30 flex items-center justify-between gap-3 text-xs shadow-md animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="font-extrabold text-emerald-300">تثبيت التطبيق على جهازك: </span>
              <span className="text-slate-300">
                احصل على تجربة سريعة تعمل بدون شريط المتصفح وتفتح مباشرة كبرنامج مستقل
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-sm transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تثبيت الآن</span>
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              className="text-slate-400 hover:text-white p-1 cursor-pointer transition"
              title="إخفاء التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Guide */}
        {showGuideModal && renderGuideModal()}
      </>
    );
  }

  // Standard Button variant
  return (
    <>
      <button
        type="button"
        id="btn-pwa-install-header"
        onClick={handleInstallClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition border border-emerald-500 cursor-pointer ${className}`}
        title="تثبيت النظام كتطبيق على الجوال أو الكمبيوتر"
      >
        <Download className="w-3.5 h-3.5" />
        <span>التثبيت</span>
      </button>

      {showGuideModal && renderGuideModal()}
    </>
  );

  function renderGuideModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 max-w-sm w-full text-slate-900 border border-slate-200 text-right">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">تثبيت التطبيق على جهازك</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isIOS ? (
            <div className="space-y-3 text-xs leading-relaxed text-slate-600">
              <p className="font-bold text-slate-800">
                لتثبيت التطبيق على iPhone أو iPad (متصفح Safari):
              </p>
              <ol className="space-y-2 pr-4 list-decimal text-slate-700">
                <li className="flex items-start gap-1.5">
                  <Share2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>اضغط على زر <strong>المشاركة (Share)</strong> في شريط Safari بالأسفل.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <PlusSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>مرر للأسفل واضغط على <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</span>
                </li>
                <li>
                  اضغط على <strong>إضافة (Add)</strong> بالأعلى ليظهر التطبيق في شاشتك الرئيسية فوراً.
                </li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 text-xs leading-relaxed text-slate-600">
              <p className="font-bold text-slate-800">
                لتثبيت التطبيق على الكمبيوتر أو هواتف أندرويد:
              </p>
              <ul className="space-y-2 pr-4 list-disc text-slate-700">
                <li>
                  <strong>متصفح Chrome / Edge:</strong> اضغط على أيقونة التثبيت (🖥️ أو ⬇️) الموجودة في شريط العنوان أعلى المتصفح.
                </li>
                <li>
                  <strong>جوال أندرويد:</strong> اضغط على قائمة الخيارات (⋮) أعلى المتصفح ثم اختر <strong>"تثبيت التطبيق"</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong>.
                </li>
              </ul>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>سيعمل البرنامج كأنه تطبيق محمل بدون الحاجة لفتح المتصفح في كل مرة.</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowGuideModal(false)}
            className="w-full mt-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    );
  }
};
