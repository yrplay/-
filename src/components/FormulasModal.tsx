import React, { useState } from 'react';
import { BookOpen, Copy, Check, Calculator, Sparkles } from 'lucide-react';

interface FormulasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FormulasModal: React.FC<FormulasModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sections = [
    {
      title: '1. معادلات ورقة المبيعات (Sales)',
      badge: '6 معادلات أساسية',
      items: [
        {
          key: 's1',
          name: 'توليد كود الفاتورة التلقائي (A2)',
          formula: '="INV-" & TEXT(ROW()-1, "0000")',
          explanation: 'ينشئ أرقام فواتير متسلسلة تلقائياً مثل INV-0001, INV-0002 بمجرد ملء الصف.',
        },
        {
          key: 's2',
          name: 'إجمالي الطلب (J2)',
          formula: '=G2*I2',
          explanation: 'الكمية (G) مضروبة في سعر الوحدة (I).',
        },
        {
          key: 's3',
          name: 'الصافي بعد الخصم (M2)',
          formula: '=K2-L2',
          explanation: 'إجمالي الفاتورة (K) ناقصاً قيمة الخصم (L).',
        },
        {
          key: 's4',
          name: 'المتبقي على العميل (P2)',
          formula: '=M2-O2',
          explanation: 'الصافي (M) ناقصاً المدفوع فعلياً (O).',
        },
        {
          key: 's5',
          name: 'حالة السداد الذكية (Q2)',
          formula: '=IF(P2=0, "✅ مسدد", IF(P2=M2, "🔴 غير مسدد", "🟡 مسدد جزئي"))',
          explanation: 'يحدد فوراً ما إذا كانت الفاتورة مسددة بالكامل، أو جزئياً، أو غير مسددة بالرموز التعبيرية.',
        },
        {
          key: 's6',
          name: 'حساب أيام التأخير (V2)',
          formula: '=IF(AND(S2<TODAY(), T2<>"تم التسليم"), TODAY()-S2, "—")',
          explanation: 'إذا تجاوز تاريخ اليوم موعد التسليم ولم يكن الطلب مسلماً، يحسب عدد أيام التأخير تلقائياً.',
        },
      ],
    },
    {
      title: '2. معادلات ورقة المشتريات (Purchases)',
      badge: '4 معادلات',
      items: [
        {
          key: 'p1',
          name: 'تاريخ اليوم التلقائي (A2)',
          formula: '=TODAY()',
          explanation: 'يدرج تاريخ التسجيل الحالي تلقائياً.',
        },
        {
          key: 'p2',
          name: 'إجمالي الشراء (G2)',
          formula: '=E2*F2',
          explanation: 'الكمية (E) مضروبة في سعر الشراء (F).',
        },
        {
          key: 'p3',
          name: 'المتبقي للمورد (K2)',
          formula: '=G2-J2',
          explanation: 'إجمالي الفاتورة (G) ناقصاً المبلغ المدفوع (J).',
        },
        {
          key: 'p4',
          name: 'حالة سداد المورد (L2)',
          formula: '=IF(K2=0, "✅ مسدد", IF(K2=G2, "🔴 غير مسدد", "🟡 مسدد جزئي"))',
          explanation: 'تحديد دقيق لذمم الموردين والتزامات المحل.',
        },
      ],
    },
    {
      title: '3. معادلات ورقة المخزون (Inventory)',
      badge: 'معادلة تنبيه النواقص',
      items: [
        {
          key: 'i1',
          name: 'تنبيه حالة الخامات (G2)',
          formula: '=IF(E2<=F2, "🛒 طلب شراء", IF(E2<=F2*1.5, "🟡 منخفض", "🟢 كافي"))',
          explanation: 'يقارن الكمية الحالية بالحد الأدنى؛ ويظهر طلب شراء فوراً عند بلوغ الحد الأدنى، أو منخفض عند الاقتراب منه.',
        },
      ],
    },
    {
      title: '4. معادلات ورقة الداشبورد والتقارير (Dashboard)',
      badge: 'المؤشرات الثمانية',
      items: [
        { key: 'd1', name: 'إجمالي المبيعات (B2)', formula: '=SUM(المبيعات!M:M)', explanation: 'مجموع عمود الصافي في ورقة المبيعات.' },
        { key: 'd2', name: 'إجمالي المشتريات (B3)', formula: '=SUM(المشتريات!G:G)', explanation: 'مجموع فواتير الخامات في ورقة المشتريات.' },
        { key: 'd3', name: 'إجمالي المصروفات (B4)', formula: '=SUM(المصروفات!D:D)', explanation: 'مجموع كافة المصروفات والرواتب والإيجار.' },
        { key: 'd4', name: 'صافي الربح الفعلي (B5)', formula: '=B2-B3-B4', explanation: 'المبيعات ناقصاً المشتريات والمصروفات.' },
        { key: 'd5', name: 'المستحقات من العملاء (B6)', formula: '=SUM(المبيعات!P:P)', explanation: 'مجموع الديون المعلقة على العملاء.' },
        { key: 'd6', name: 'المستحقات للموردين (B7)', formula: '=SUM(المشتريات!K:K)', explanation: 'مجموع المستحقات المتبقية لشركات الخامات.' },
        { key: 'd7', name: 'التدفق النقدي المتوقع (B8)', formula: '=B5+B6-B7', explanation: 'الربح مضافاً إليه مستحقات العملاء مطروحاً منه ديون الموردين.' },
        { key: 'd8', name: 'عدد الفواتير غير المسددة (B9)', formula: '=COUNTIF(المبيعات!Q:Q, "🔴 غير مسدد")', explanation: 'إحصاء الفواتير التي لم يسدد منها العميل أي دفعة.' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] my-auto">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">دليل معادلات وصيغ النظام المحاسبي</h3>
              <p className="text-xs text-indigo-200">
                صيغ Google Sheets الجاهزة للنسخ والمضمنة تلقائياً في جداول البيانات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs overscroll-contain">
          {sections.map((sec, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                <h4 className="font-bold text-slate-800 text-sm">{sec.title}</h4>
                <span className="bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded text-[11px]">
                  {sec.badge}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {sec.items.map((item) => (
                  <div
                    key={item.key}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 hover:border-slate-300 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{item.name}</span>
                      <button
                        onClick={() => copyToClipboard(item.formula, item.key)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition"
                      >
                        {copiedKey === item.key ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ الصيغة</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="font-mono text-emerald-800 bg-white p-2 rounded-lg border border-slate-200 text-[11px] select-all overflow-x-auto">
                      {item.formula}
                    </div>

                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      {item.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
