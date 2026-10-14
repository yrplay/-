import React, { useState, useRef, useEffect } from 'react';
import {
  Printer,
  X,
  Building2,
  Image as ImageIcon,
  Upload,
  Receipt,
  FileCheck2,
  Download,
  FileDown,
  Stamp,
  Loader2,
  QrCode,
  ExternalLink,
  ChevronDown,
  History,
} from 'lucide-react';
import { SaleItem, AgencySettings } from '../types';
import {
  exportSafePdf,
  exportSafePng,
  generateQrDataUrl,
  openCleanPrintWindow,
  smartPrintDocument,
} from '../lib/printUtils';
import { AuditTimelineModal } from './AuditTimelineModal';

interface InvoicePrintModalProps {
  sale: SaleItem | null;
  onClose: () => void;
  agencySettings: AgencySettings;
  onUpdateAgencySettings: (settings: AgencySettings) => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  sale,
  onClose,
  agencySettings,
  onUpdateAgencySettings,
}) => {
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showQrCode, setShowQrCode] = useState<boolean>(agencySettings.showQrCode ?? true);
  const [showStamp, setShowStamp] = useState<boolean>(Boolean(agencySettings.agencyStampUrl));
  const [showTimelineModal, setShowTimelineModal] = useState<boolean>(false);
  const [showVatNumber, setShowVatNumber] = useState<boolean>(
    agencySettings.showVatNumber ?? true
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [actionNotification, setActionNotification] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stampInputRef = useRef<HTMLInputElement | null>(null);
  const customQrInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceContainerRef = useRef<HTMLDivElement | null>(null);

  // Generate QR Code data safely
  useEffect(() => {
    if (!sale) return;
    const qrPayload = [
      `المنشأة: ${agencySettings.agencyName || 'وكالة الدعاية والإعلان'}`,
      showVatNumber && agencySettings.agencyVatNumber
        ? `الرقم الضريبي: ${agencySettings.agencyVatNumber}`
        : '',
      `رقم الفاتورة: ${sale.invoiceNo}`,
      `تاريخ الإصدار: ${sale.receiptDate}`,
      `المبلغ الإجمالي: ${sale.netTotal.toFixed(2)} ر.س`,
      sale.isTaxInvoice ? `الضريبة (15%): ${(sale.taxAmount || 0).toFixed(2)} ر.س` : '',
    ]
      .filter(Boolean)
      .join('\n');

    generateQrDataUrl(qrPayload).then((url) => {
      setQrCodeDataUrl(url);
    });
  }, [sale, agencySettings, showVatNumber]);

  if (!sale) return null;

  // Smart Print Handler (Works in browser, iframes, and sandboxes)
  const handlePrint = async () => {
    if (!invoiceContainerRef.current) return;
    setActionNotification({
      type: 'info',
      message: 'جاري تجهيز أمر الطباعة...',
    });

    try {
      const res = await smartPrintDocument(invoiceContainerRef.current, `فاتورة-${sale.invoiceNo}`);
      if (res.method === 'pdf') {
        setActionNotification({
          type: 'success',
          message: `تم تنزيل ملف الفاتورة (${sale.invoiceNo}.pdf) بجودة A4 للطباعة الفورية!`,
        });
      } else {
        setActionNotification({
          type: 'success',
          message: 'تم إرسال أمر الطباعة بنجاح.',
        });
      }
    } catch (err) {
      console.warn('Print trigger fallback to PDF:', err);
      handleExportPdf();
    }
  };

  const formatSAR = (n: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
    }).format(n);
  };

  // Safe Export to PDF (A4 size)
  const handleExportPdf = async () => {
    if (!invoiceContainerRef.current) return;
    setIsExportingPdf(true);
    setActionNotification({
      type: 'info',
      message: 'جاري إنشاء ملف PDF وتجهيزه للتحميل...',
    });

    const result = await exportSafePdf(invoiceContainerRef.current, `فاتورة-${sale.invoiceNo}`);
    setIsExportingPdf(false);

    if (result.success) {
      setActionNotification({
        type: 'success',
        message: `تم تحميل ملف الفاتورة (${sale.invoiceNo}.pdf) بنجاح!`,
      });
    } else {
      console.warn('PDF direct canvas export failed:', result.error);
      setActionNotification({
        type: 'error',
        message: 'تعذر التنزيل التلقائي لـ PDF. يمكنك استخدام زر "طباعة" لحفظه كـ PDF فوراً.',
      });
    }
  };

  // Safe Export to PNG
  const handleExportPng = async () => {
    if (!invoiceContainerRef.current) return;
    setIsExportingPng(true);
    setActionNotification({
      type: 'info',
      message: 'جاري تجهيز صورة الفاتورة للتحميل...',
    });

    const result = await exportSafePng(invoiceContainerRef.current, `فاتورة-${sale.invoiceNo}`);
    setIsExportingPng(false);

    if (result.success) {
      setActionNotification({
        type: 'success',
        message: `تم تحميل صورة الفاتورة (${sale.invoiceNo}.png) بنجاح!`,
      });
    } else {
      setActionNotification({
        type: 'error',
        message: 'تعذر تنزيل الصورة، يرجى استخدام زر الطباعة المباشر كبديل.',
      });
    }
  };

  // Toggle QR Code and persist in agencySettings
  const handleToggleQr = () => {
    const nextVal = !showQrCode;
    setShowQrCode(nextVal);
    onUpdateAgencySettings({
      ...agencySettings,
      showQrCode: nextVal,
    });
    setActionNotification({
      type: 'info',
      message: nextVal ? 'تم تفعيل كود QR في الفاتورة' : 'تم إخفاء كود QR من الفاتورة',
    });
  };

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onUpdateAgencySettings({
        ...agencySettings,
        agencyLogoUrl: result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    onUpdateAgencySettings({
      ...agencySettings,
      agencyLogoUrl: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Stamp upload handler
  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار صورة صالحة لختم المحل');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onUpdateAgencySettings({
        ...agencySettings,
        agencyStampUrl: result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveStamp = () => {
    onUpdateAgencySettings({
      ...agencySettings,
      agencyStampUrl: null,
    });
    if (stampInputRef.current) {
      stampInputRef.current.value = '';
    }
  };

  const handleCustomQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح لرمز QR');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onUpdateAgencySettings({
        ...agencySettings,
        customQrUrl: result,
        showQrCode: true,
      });
      setShowQrCode(true);
      setActionNotification({
        type: 'success',
        message: 'تم رفع وحفظ رمز QR المخصص للوكالة بنجاح!',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomQr = () => {
    onUpdateAgencySettings({
      ...agencySettings,
      customQrUrl: undefined,
    });
    if (customQrInputRef.current) {
      customQrInputRef.current.value = '';
    }
    setActionNotification({
      type: 'info',
      message: 'تمت إزالة رمز QR المخصص والعودة للرمز التلقائي.',
    });
  };

  const isTaxInvoice = Boolean(sale.isTaxInvoice);
  const agencyVat = (sale.agencyVatNumber || agencySettings.agencyVatNumber || '').trim();
  const customerVat = (sale.customerVatNumber || '').trim();
  const customerPhone = (sale.customerPhone || '').trim();
  const paymentMethod = (sale.paymentMethod || '').trim();
  const deliveryDate = (sale.deliveryDate || '').trim();
  const hasNotes = Boolean(sale.notes && sale.notes.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-w-none flex flex-col max-h-[96vh] my-auto print:max-h-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between print:hidden gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            {isTaxInvoice ? (
              <FileCheck2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Receipt className="w-5 h-5 text-teal-400" />
            )}
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>{isTaxInvoice ? 'فاتورة ضريبية' : 'فاتورة مبيعات'}</span>
                {isTaxInvoice && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40">
                    ضريبة 15%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                رقم الفاتورة: <span className="font-mono text-slate-200">{sale.invoiceNo}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Toggle Agency VAT Visibility */}
            <label
              className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                showVatNumber
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="إظهار أو إخفاء الرقم الضريبي للوكالة"
            >
              <input
                type="checkbox"
                checked={showVatNumber}
                onChange={(e) => setShowVatNumber(e.target.checked)}
                className="w-3 h-3 rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer"
              />
              <span>الضريبة</span>
            </label>

            {/* Toggle QR Code Visibility */}
            <label
              className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                showQrCode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="إظهار أو إخفاء رمز QR في الفاتورة"
            >
              <input
                type="checkbox"
                checked={showQrCode}
                onChange={handleToggleQr}
                className="w-3 h-3 rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer"
              />
              <span>QR</span>
            </label>

            {/* Toggle Official Stamp & Quick Upload beside QR button */}
            <div className="flex items-center gap-0.5">
              <label
                className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                  showStamp && agencySettings.agencyStampUrl
                    ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-xs'
                    : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="إظهار أو إخفاء ختم المنشأة في الفاتورة"
              >
                <input
                  type="checkbox"
                  checked={showStamp && Boolean(agencySettings.agencyStampUrl)}
                  disabled={!agencySettings.agencyStampUrl}
                  onChange={(e) => setShowStamp(e.target.checked)}
                  className="w-3 h-3 rounded text-emerald-500 focus:ring-emerald-400 cursor-pointer disabled:opacity-50"
                />
                <Stamp className="w-3 h-3" />
                <span>ختم</span>
              </label>

              <label
                className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700 flex items-center"
                title={agencySettings.agencyStampUrl ? 'تغيير صورة الختم' : 'رفع صورة الختم الرسمي للمحل'}
              >
                <Upload className="w-3 h-3" />
                <input
                  ref={stampInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleStampUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Merged Print & PDF/Image Save Button */}
            <div className="relative inline-flex items-stretch rounded-md shadow-sm">
              <button
                type="button"
                id="btn-invoice-print-pdf"
                onClick={handlePrint}
                className="px-3 py-1 rounded-r-md bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                title="طباعة الفاتورة أو حفظها كملف PDF"
              >
                <Printer className="w-3 h-3" />
                <span>طباعة</span>
              </button>
              <button
                type="button"
                id="btn-invoice-export-options"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-1.5 py-1 rounded-l-md bg-teal-700 hover:bg-teal-800 text-white text-xs border-r border-teal-800/80 transition cursor-pointer"
                title="خيارات إضافية (PDF، صور)"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {showExportMenu && (
                <div className="absolute left-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1.5 z-50 min-w-[170px] text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportPdf();
                    }}
                    disabled={isExportingPdf}
                    className="w-full text-right px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-rose-400" />}
                    <span>تحميل ملف PDF مباشر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      handleExportPng();
                    }}
                    disabled={isExportingPng}
                    className="w-full text-right px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    {isExportingPng ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-indigo-400" />}
                    <span>تحميل صورة PNG</span>
                  </button>
                </div>
              )}
            </div>

            {/* Close Modal Button */}
            <button
              type="button"
              id="btn-close-invoice-modal"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Notification Banner */}
        {actionNotification && (
          <div
            className={`px-4 py-2 text-xs flex items-center justify-between print:hidden border-b transition-all ${
              actionNotification.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700'
                : actionNotification.type === 'error'
                ? 'bg-rose-900/90 text-rose-100 border-rose-700'
                : 'bg-indigo-900/90 text-indigo-100 border-indigo-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">
                {actionNotification.type === 'success'
                  ? '✅'
                  : actionNotification.type === 'error'
                  ? '⚠️'
                  : 'ℹ️'}
              </span>
              <span>{actionNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotification(null)}
              className="text-white/70 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Printable Invoice Container (A4 Printable Area) */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-6 print:p-0 print:bg-white flex justify-center overscroll-contain">
          <div
            ref={invoiceContainerRef}
            id="printable-invoice"
            className="w-full max-w-[210mm] bg-white p-6 sm:p-8 text-slate-800 space-y-5 rounded-xl shadow-xs print:shadow-none print:rounded-none print:p-8"
          >
            {/* Header: Logo & Agency Details */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 gap-4">
              <div className="flex items-center gap-4 flex-1">
                {agencySettings.agencyLogoUrl && (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-slate-200 p-1.5 flex items-center justify-center bg-white shadow-xs shrink-0">
                    <img
                      src={agencySettings.agencyLogoUrl}
                      alt="شعار الوكالة"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-slate-900 leading-tight">
                    {agencySettings.agencyName || 'وكالة الدعاية والإعلان والمطبوعات'}
                  </h1>
                  {agencySettings.agencySubtitle && (
                    <p className="text-xs text-slate-500 mt-1">
                      {agencySettings.agencySubtitle}
                    </p>
                  )}
                  {agencySettings.agencyPhone && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      هاتف: <span className="font-mono font-semibold">{agencySettings.agencyPhone}</span>
                    </p>
                  )}
                  {(agencySettings.agencyAddress || agencySettings.agencyCountry) && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      العنوان:{' '}
                      <span>
                        {[agencySettings.agencyCountry, agencySettings.agencyAddress]
                          .filter(Boolean)
                          .join(' - ')}
                      </span>
                    </p>
                  )}
                  {showVatNumber && agencyVat ? (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-[11px] font-mono font-bold border border-slate-200">
                      <span className="font-sans text-slate-500">الرقم الضريبي للمنشأة:</span>
                      <span>{agencyVat}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Invoice Meta Box */}
              <div className="text-left shrink-0">
                <span
                  className={`inline-block px-3 py-1 text-white font-black text-xs rounded mb-1.5 ${
                    isTaxInvoice ? 'bg-emerald-700' : 'bg-slate-900'
                  }`}
                >
                  {isTaxInvoice ? 'فاتورة ضريبية' : 'فاتورة مبيعات'}
                </span>
                <div className="text-base font-black text-emerald-800 font-mono tracking-wide">
                  {sale.invoiceNo}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  تاريخ الإصدار: <span className="font-mono text-slate-800 font-semibold">{sale.receiptDate}</span>
                </div>
                {deliveryDate ? (
                  <div className="text-xs text-slate-500 mt-0.5">
                    موعد التسليم: <span className="font-mono text-slate-800 font-semibold">{deliveryDate}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Customer & Payment Information (ONLY render fields that exist) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200">
              <div>
                <span className="text-slate-400 block mb-0.5 font-medium">بيانات العميل:</span>
                <strong className="text-slate-900 text-sm block">{sale.customerName || 'عميل نقدي'}</strong>
                {customerPhone ? (
                  <div className="text-slate-600 font-mono mt-0.5">
                    رقم الجوال: {customerPhone}
                  </div>
                ) : null}
                {customerVat ? (
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono font-bold text-[11px]">
                    <span className="font-sans text-slate-500">الرقم الضريبي للعميل:</span>
                    <span>{customerVat}</span>
                  </div>
                ) : null}
              </div>

              <div className="sm:text-left space-y-1">
                <span className="text-slate-400 block mb-0.5 font-medium">بيانات الدفع والسداد:</span>
                {paymentMethod ? (
                  <div className="text-slate-700">
                    طريقة الدفع: <strong className="text-slate-900">{paymentMethod}</strong>
                  </div>
                ) : null}
                <div>
                  حالة السداد:{' '}
                  <strong
                    className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                      sale.remainingAmount === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : sale.paidAmount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {sale.paymentStatus}
                  </strong>
                </div>
              </div>
            </div>

            {/* Service Breakdown Table */}
            <table className="w-full text-right text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800">
                  <th className="border border-slate-300 p-2.5 font-bold w-10 text-center">#</th>
                  <th className="border border-slate-300 p-2.5 font-bold">الخدمة / الصنف</th>
                  <th className="border border-slate-300 p-2.5 font-bold">المواصفات الفنية</th>
                  <th className="border border-slate-300 p-2.5 text-center font-bold">الكمية</th>
                  <th className="border border-slate-300 p-2.5 font-bold">سعر الوحدة</th>
                  <th className="border border-slate-300 p-2.5 text-left font-bold">
                    {isTaxInvoice ? 'الإجمالي قبل الضريبة' : 'الإجمالي'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.items && sale.items.length > 0 ? (
                  sale.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="border border-slate-300 p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="border border-slate-300 p-2.5 font-bold text-slate-900">{it.serviceType}</td>
                      <td className="border border-slate-300 p-2.5 text-slate-600">
                        {it.specifications ? it.specifications : null}
                      </td>
                      <td className="border border-slate-300 p-2.5 text-center font-mono font-bold">
                        {it.quantity} {it.unitType ? it.unitType : ''}
                      </td>
                      <td className="border border-slate-300 p-2.5 font-mono">
                        {it.unitPrice ? `${it.unitPrice.toFixed(2)} ر.س` : '0.00 ر.س'}
                      </td>
                      <td className="border border-slate-300 p-2.5 text-left font-mono font-bold text-slate-900">
                        {it.itemTotal ? `${it.itemTotal.toFixed(2)} ر.س` : '0.00 ر.س'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="border border-slate-300 p-2.5 text-center font-mono text-slate-500">1</td>
                    <td className="border border-slate-300 p-2.5 font-bold text-slate-900">{sale.serviceType}</td>
                    <td className="border border-slate-300 p-2.5 text-slate-600">{sale.specifications || null}</td>
                    <td className="border border-slate-300 p-2.5 text-center font-mono font-bold">
                      {sale.quantity} {sale.unitType || ''}
                    </td>
                    <td className="border border-slate-300 p-2.5 font-mono">
                      {sale.unitPrice ? `${sale.unitPrice.toFixed(2)} ر.س` : '0.00 ر.س'}
                    </td>
                    <td className="border border-slate-300 p-2.5 text-left font-mono font-bold text-slate-900">
                      {sale.invoiceTotal ? `${sale.invoiceTotal.toFixed(2)} ر.س` : '0.00 ر.س'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Financial Totals & Dedicated Notes Box (Notes rendered ONLY if not empty) */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch gap-4 pt-1">
              {/* Dedicated Notes Area - rendered ONLY if non-empty */}
              {hasNotes ? (
                <div className="flex-1 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">
                      ملاحظات الفاتورة:
                    </div>
                    <div className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">
                      {sale.notes}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1"></div>
              )}

              {/* Calculations Summary Box */}
              <div className="w-full sm:w-80 space-y-1.5 text-xs bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 shrink-0">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">إجمالي البنود:</span>
                  <span className="font-mono font-bold">{sale.invoiceTotal.toFixed(2)} ر.س</span>
                </div>

                {sale.discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-200 text-rose-600 font-semibold">
                    <span>
                      الخصم الممنوح
                      {sale.discountType === 'percentage' ||
                      (sale.discountPercent && sale.discountPercent > 0)
                        ? ` (نسبة ${sale.discountPercent}%):`
                        : ' (مبلغ محدد):'}
                    </span>
                    <span className="font-mono font-bold">-{sale.discount.toFixed(2)} ر.س</span>
                  </div>
                )}

                {isTaxInvoice && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-200 text-slate-700">
                      <span>المبلغ الخاضع للضريبة:</span>
                      <span className="font-mono font-bold">
                        {(sale.subtotalBeforeTax ?? (sale.invoiceTotal - sale.discount)).toFixed(2)} ر.س
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-800 font-bold bg-emerald-50/60 px-1.5 rounded">
                      <span>ضريبة القيمة المضافة ({sale.taxRate ?? 15}%):</span>
                      <span className="font-mono font-bold">
                        +{(sale.taxAmount ?? 0).toFixed(2)} ر.س
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-between py-1.5 border-b-2 border-slate-900 text-sm font-black text-slate-900">
                  <span>{isTaxInvoice ? 'الإجمالي شامل الضريبة:' : 'الصافي المطلوب:'}</span>
                  <span className="font-mono text-emerald-800">{formatSAR(sale.netTotal)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">المدفوع:</span>
                  <span className="font-mono font-bold text-slate-800">{sale.paidAmount.toFixed(2)} ر.س</span>
                </div>

                {sale.remainingAmount > 0 ? (
                  <div className="flex justify-between py-1 text-sm font-black">
                    <span className="text-rose-700">المتبقي:</span>
                    <span className="font-mono text-rose-700">{formatSAR(sale.remainingAmount)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer Row: Right = QR Code slot | Center = Centered Footer text | Left = Stamp (ONLY if present) */}
            <div className="border-t-2 border-slate-900/20 pt-4 flex items-center justify-between gap-4">
              {/* Right Side in RTL: QR Code slot */}
              <div className="flex flex-col items-center shrink-0 w-28">
                {showQrCode && (
                  <div className="flex flex-col items-center">
                    {agencySettings.customQrUrl ? (
                      <div className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center shadow-xs">
                        <img
                          src={agencySettings.customQrUrl}
                          alt="كود QR الوكالة"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : qrCodeDataUrl ? (
                      <div className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center shadow-xs">
                        <img
                          src={qrCodeDataUrl}
                          alt="QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center text-slate-400">
                        <QrCode className="w-8 h-8 animate-pulse" />
                      </div>
                    )}
                    <span className="text-[9px] text-slate-500 font-bold mt-1 text-center">
                      {agencySettings.customQrUrl ? 'رمز QR الوكالة' : 'رمز QR للتحقق'}
                    </span>
                  </div>
                )}
              </div>

              {/* Center: Footer text strictly centered at the bottom */}
              <div className="text-center flex-1 px-4">
                <p className="font-semibold text-slate-800 text-xs sm:text-sm leading-relaxed">
                  {agencySettings.invoiceFooterText || 'شكراً لتعاملكم معنا • نسعد دائماً بخدمتكم'}
                </p>
                {(agencySettings.agencyAddress || agencySettings.agencyCountry) && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {[agencySettings.agencyCountry, agencySettings.agencyAddress]
                      .filter(Boolean)
                      .join(' - ')}
                  </p>
                )}
              </div>

              {/* Left Side in RTL: Shop Stamp (ONLY if uploaded and enabled - NO placeholder buttons) */}
              <div className="flex flex-col items-center shrink-0 w-28">
                {showStamp && agencySettings.agencyStampUrl ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-bold mb-1">ختم المنشأة</span>
                    <div className="w-20 h-20 flex items-center justify-center p-0.5">
                      <img
                        src={agencySettings.agencyStampUrl}
                        alt="ختم المحل"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Timeline Modal */}
        <AuditTimelineModal
          isOpen={showTimelineModal}
          onClose={() => setShowTimelineModal(false)}
          targetSale={sale}
        />
      </div>
    </div>
  );
};
