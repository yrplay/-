import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { ShieldCheck, ShieldAlert, LogIn, LogOut, Lock, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { AgencySettings } from '../types';

interface AuthGateProps {
  user: User | null;
  isAuthLoading: boolean;
  agencySettings: AgencySettings;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

// Master Admin / Owner email that always has access
const MASTER_ADMIN_EMAIL = 'yr.play.com@gmail.com'.toLowerCase();

export const AuthGate: React.FC<AuthGateProps> = ({
  user,
  isAuthLoading,
  agencySettings,
  onLogin,
  onLogout,
  children,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // 1. Loading State while checking existing session
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white" dir="rtl">
        {agencySettings.agencyLogoUrl ? (
          <div className="w-20 h-20 rounded-2xl bg-white p-2 border border-slate-700 shadow-xl mb-4 flex items-center justify-center overflow-hidden animate-pulse">
            <img
              src={agencySettings.agencyLogoUrl}
              alt={agencySettings.agencyName || 'شعار الوكالة'}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
            <Lock className="w-8 h-8" />
          </div>
        )}
        <h2 className="text-xl font-bold mb-2">جاري التحقق من أمان الجلسة...</h2>
        <p className="text-sm text-slate-400">يرجى الانتظار ثوانٍ للتحقق من هوية المستخدم وصلاحيات الوصول</p>
      </div>
    );
  }

  // 2. Not Logged In State -> Enforce Strict Authentication Gate
  if (!user) {
    const handleGoogleClick = async () => {
      try {
        setIsLoggingIn(true);
        setLoginError(null);
        await onLogin();
      } catch (err: any) {
        console.error('Login error:', err);
        setLoginError(err?.message || 'تعذر إتمام تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.');
      } finally {
        setIsLoggingIn(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-emerald-500 selection:text-white" dir="rtl">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
          {/* Subtle Glow Header Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600"></div>

          {/* Agency Badge & Shield */}
          <div className="flex flex-col items-center text-center mb-6">
            {agencySettings.agencyLogoUrl ? (
              <div className="w-24 h-24 rounded-2xl bg-white p-2.5 border border-slate-700/80 shadow-2xl shadow-emerald-500/10 mb-4 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={agencySettings.agencyLogoUrl}
                  alt={agencySettings.agencyName || 'شعار الوكالة'}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-4">
                <Building2 className="w-8 h-8" />
              </div>
            )}

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              نظام إداري ومحاسبي مشفر ومحمي
            </span>

            <h1 className="text-2xl font-black text-white tracking-tight">
              {agencySettings.agencyName || 'وكالة الدعاية والإعلان والمطبوعات'}
            </h1>
            {agencySettings.agencySubtitle && (
              <p className="text-xs text-slate-300 font-medium mt-1.5 max-w-xs leading-relaxed">
                {agencySettings.agencySubtitle}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-2">
              بوابة الدخول المحمية • الوصول مقتصر على الفريق المصرح له فقط
            </p>
          </div>

          {/* Security Notice */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 mb-6 text-xs text-slate-300 space-y-2.5">
            <div className="flex items-start gap-2 text-slate-200 font-medium">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>لحماية فكرة التطبيق والبيانات المحاسبية وسجلات العملاء:</span>
            </div>
            <ul className="space-y-1.5 text-slate-400 pr-5 list-disc">
              <li>لا يمكن لأي زائر خارجي تصفح الفواتير أو لوحة التحكم بدون إذن.</li>
              <li>يجب تسجيل الدخول باستخدام حساب Google المعتمد من إدارة الوكالة.</li>
              <li>جميع العمليات المحاسبية مشفرة ومتزامنة سحابياً بشكل فوري.</li>
            </ul>
          </div>

          {loginError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 mb-5 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={isLoggingIn}
            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-3 transition shadow-lg hover:shadow-xl active:scale-[0.99] disabled:opacity-50 cursor-pointer text-sm"
          >
            {isLoggingIn ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                <span>جاري تسجيل الدخول والتحقق...</span>
              </>
            ) : (
              <>
                {/* Official Google 'G' Icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>تسجيل الدخول باستخدام Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-slate-500 mt-4">
            المالك المعتمد للنظام: <span className="font-mono text-slate-400">{MASTER_ADMIN_EMAIL}</span>
          </p>
        </div>
      </div>
    );
  }

  // 3. User is Logged In -> Verify Authorization Whitelist
  const userEmail = (user.email || '').toLowerCase().trim();

  // Check if user is authorized
  const isMasterAdmin = userEmail === MASTER_ADMIN_EMAIL;
  const isOwnerProfile = (agencySettings.userProfile?.email || '').toLowerCase().trim() === userEmail;
  const isCollaborator = (agencySettings.collaborators || []).some(
    (c) => (c.email || '').toLowerCase().trim() === userEmail && c.status === 'نشط'
  );

  const isAuthorized = isMasterAdmin || isOwnerProfile || isCollaborator;

  // 4. Logged in, but NOT authorized in the team whitelist -> Access Denied Screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-rose-500 selection:text-white" dir="rtl">
        <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/20 text-center relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">غير مصرح لك بالوصول إلى هذا النظام</h2>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            تم تسجيل الدخول بنجاح بحساب Google، لكن هذا البريد الإلكتروني غير مدرج ضمن قائمة المستخدمين المعتمدين لهذه الوكالة.
          </p>

          <div className="bg-slate-800/80 rounded-xl p-3 mb-6 border border-slate-700 text-xs">
            <span className="text-slate-400 block mb-1">البريد الإلكتروني الحالي:</span>
            <span className="font-mono font-semibold text-emerald-400 break-all">{user.email}</span>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 mb-6 text-right text-xs text-amber-300">
            <p className="font-semibold mb-1">كيف تحصل على صلاحية الوصول؟</p>
            <p className="text-amber-200/80">
              يرجى التواصل مع مدير الوكالة (<span className="font-mono text-white">{MASTER_ADMIN_EMAIL}</span>) لإضافة بريدك الإلكتروني في قائمة المحررين المصرح لهم داخل إعدادات البرنامج.
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-xs"
          >
            <LogOut className="w-4 h-4 text-slate-300" />
            <span>تسجيل الخروج والتبديل لحساب آخر</span>
          </button>
        </div>
      </div>
    );
  }

  // 5. User is Authenticated AND Authorized -> Render Full Application
  return <>{children}</>;
};
