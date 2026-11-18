import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  Printer,
  Trash2,
  Package,
  AlertTriangle,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  X,
  Eye,
  Flame,
} from 'lucide-react';
import {
  ReturnRecord,
  ReturnLineItem,
  ReturnKind,
  ReturnActionType,
  SaleItem,
  PurchaseItem,
  InventoryItem,
  InventoryMovement,
  AgencySettings,
  UserRole,
} from '../types';
import { getNextSequenceNumber, roundMoney } from '../lib/dataStore';
import { canDeleteItem } from '../lib/permissions';
import { CreditNotePrintModal } from './CreditNotePrintModal';

interface ReturnsViewProps {
  returns: ReturnRecord[];
  sales: SaleItem[];
  purchases: PurchaseItem[];
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  agencySettings: AgencySettings;
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  onAddReturn: (
    rec: ReturnRecord,
    restockAdjustments: { inventoryId: string; quantityDelta: number; reason: string }[],
    createCashVoucher: boolean
  ) => void;
  onDeleteReturn: (id: string) => void;
  onRecordWastage: (
    inventoryId: string,
    quantity: number,
    reason: string,
    referenceDocNo?: string
  ) => void;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  returns,
  sales,
  purchases,
  inventory,
  movements,
  agencySettings,
  userRole = 'owner',
  currentLang = 'ar',
  onAddReturn,
  onDeleteReturn,
  onRecordWastage,
}) => {
  const isEn = currentLang === 'en';
  const [activeSubTab, setActiveSubTab] = useState<'sale_returns' | 'purchase_returns' | 'wastage'>('sale_returns');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWastageModalOpen, setIsWastageModalOpen] = useState(false);
  const [printRecord, setPrintRecord] = useState<ReturnRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Return Modal Form States
  const [returnKind, setReturnKind] = useState<ReturnKind>('sale_return');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnType, setReturnType] = useState<ReturnActionType>('partial');
  const [refundMethod, setRefundMethod] = useState<'cash_voucher' | 'account_deduction' | 'exchange_replacement'>('cash_voucher');
  const [paymentMethod, setPaymentMethod] = useState<string>('كاش');
  const [restockToInventory, setRestockToInventory] = useState<boolean>(true);
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lineDrafts, setLineDrafts] = useState<
    {
      id: string;
      itemName: string;
      specifications: string;
      unitType: string;
      originalQty: number;
      alreadyReturnedQty: number;
      returnQty: number;
      unitPrice: number;
      restockInventoryId: string;
      restockQty: number;
    }[]
  >([]);
  const [formError, setFormError] = useState<string>('');

  // Wastage Form States
  const [wastageInventoryId, setWastageInventoryId] = useState<string>(inventory[0]?.id || '');
  const [wastageQty, setWastageQty] = useState<number>(1);
  const [wastageReason, setWastageReason] = useState<string>('تالف أثناء الطباعة أو القص الحراري');
  const [wastageRefInvoice, setWastageRefInvoice] = useState<string>('');

  // Calculate already returned quantities per document and line
  const getAlreadyReturnedQty = (docId: string, lineName: string): number => {
    return returns
      .filter((r) => r.originalDocId === docId)
      .reduce((sum, r) => {
        const matched = r.items.find((it) => it.itemName === lineName);
        return sum + (matched ? Number(matched.returnQty) || 0 : 0);
      }, 0);
  };

  const openNewReturnModal = (kind: ReturnKind) => {
    setReturnKind(kind);
    setSelectedDocId('');
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnType('partial');
    setRefundMethod('cash_voucher');
    setPaymentMethod('كاش');
    setRestockToInventory(true);
    setReason('');
    setNotes('');
    setLineDrafts([]);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSelectDocument = (docId: string) => {
    setSelectedDocId(docId);
    setFormError('');
    if (!docId) {
      setLineDrafts([]);
      return;
    }

    if (returnKind === 'sale_return') {
      const sale = sales.find((s) => s.id === docId);
      if (!sale) return;
      const lines =
        sale.items && sale.items.length > 0
          ? sale.items
          : [
              {
                id: 'line-0',
                serviceType: sale.serviceType,
                specifications: sale.specifications,
                quantity: sale.quantity,
                unitType: sale.unitType,
                unitPrice: sale.unitPrice,
                itemTotal: sale.invoiceTotal,
              },
            ];

      setLineDrafts(
        lines.map((l) => {
          const already = getAlreadyReturnedQty(sale.id, l.serviceType);
          const remainingQty = Math.max(0, l.quantity - already);
          // محاولة مطابقة الصنف في المخزون تلقائياً بالاسم
          const matchedInv = inventory.find(
            (inv) =>
              l.serviceType.includes(inv.item) ||
              (l.specifications && l.specifications.includes(inv.item))
          );
          return {
            id: l.id,
            itemName: l.serviceType,
            specifications: l.specifications || '',
            unitType: l.unitType || 'قطعة',
            originalQty: l.quantity,
            alreadyReturnedQty: already,
            returnQty: returnType === 'full' ? remainingQty : 0,
            unitPrice: l.unitPrice,
            restockInventoryId: l.inventoryItemId || matchedInv?.id || '',
            restockQty: returnType === 'full' ? remainingQty : 0,
          };
        })
      );
    } else {
      const purch = purchases.find((p) => p.id === docId);
      if (!purch) return;
      const lines =
        purch.items && purch.items.length > 0
          ? purch.items
          : [
              {
                id: 'pline-0',
                item: purch.item,
                unitType: purch.unitType,
                quantity: purch.quantity,
                purchasePrice: purch.purchasePrice,
                total: purch.total,
              },
            ];

      setLineDrafts(
        lines.map((l) => {
          const already = getAlreadyReturnedQty(purch.id, l.item);
          const remainingQty = Math.max(0, l.quantity - already);
          const matchedInv = inventory.find((inv) => l.item.includes(inv.item) || inv.item.includes(l.item));
          return {
            id: l.id,
            itemName: l.item,
            specifications: l.notes || '',
            unitType: l.unitType || 'رول',
            originalQty: l.quantity,
            alreadyReturnedQty: already,
            returnQty: returnType === 'full' ? remainingQty : 0,
            unitPrice: l.purchasePrice,
            restockInventoryId: l.inventoryItemId || matchedInv?.id || '',
            restockQty: returnType === 'full' ? remainingQty : 0,
          };
        })
      );
    }
  };

  const handleReturnTypeChange = (newType: ReturnActionType) => {
    setReturnType(newType);
    if (newType === 'full') {
      setLineDrafts((prev) =>
        prev.map((l) => {
          const maxRem = Math.max(0, l.originalQty - l.alreadyReturnedQty);
          return { ...l, returnQty: maxRem, restockQty: maxRem };
        })
      );
    }
    if (newType === 'exchange') {
      setRefundMethod('exchange_replacement');
    }
  };

  // Live totals for the modal
  const liveModalTotals = useMemo(() => {
    const activeLines = lineDrafts.filter((l) => l.returnQty > 0);
    const rawSubtotal = roundMoney(
      activeLines.reduce((sum, l) => sum + roundMoney(l.returnQty * l.unitPrice), 0)
    );

    let isTaxIncluded = false;
    let taxRate = agencySettings.defaultTaxRate || 15;
    let discountRatio = 0;

    if (returnKind === 'sale_return') {
      const sale = sales.find((s) => s.id === selectedDocId);
      if (sale) {
        isTaxIncluded = Boolean(sale.isTaxInvoice);
        taxRate = sale.taxRate !== undefined ? sale.taxRate : 15;
        if (sale.invoiceTotal > 0 && sale.discount > 0) {
          discountRatio = sale.discount / sale.invoiceTotal;
        }
      }
    } else {
      const purch = purchases.find((p) => p.id === selectedDocId);
      if (purch) {
        isTaxIncluded = Boolean(purch.isTaxInvoice);
        taxRate = purch.taxRate !== undefined ? purch.taxRate : 15;
      }
    }

    const subtotalBeforeTax = roundMoney(rawSubtotal * (1 - discountRatio));
    const taxAmount = isTaxIncluded ? roundMoney(subtotalBeforeTax * (taxRate / 100)) : 0;
    const totalRefundAmount = roundMoney(subtotalBeforeTax + taxAmount);

    return {
      subtotalBeforeTax,
      isTaxIncluded,
      taxRate,
      taxAmount,
      totalRefundAmount,
    };
  }, [lineDrafts, returnKind, selectedDocId, sales, purchases, agencySettings.defaultTaxRate]);

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) {
      setFormError('يرجى اختيار الفاتورة الأصلية المرتبطة بالمرتجع');
      return;
    }

    const validLines = lineDrafts.filter((l) => l.returnQty > 0);
    if (validLines.length === 0) {
      setFormError('يرجى تحديد كمية مرتجعة أكبر من صفر لبند واحد على الأقل');
      return;
    }

    // التحقق الصارم من عدم تجاوز الكمية المتبقية القابلة للإرجاع
    for (const l of validLines) {
      const maxAllowed = roundMoney(l.originalQty - l.alreadyReturnedQty);
      if (l.returnQty > maxAllowed + 0.0001) {
        setFormError(
          `الكمية المرتجعة للبند (${l.itemName}) تتجاوز الكمية المتبقية القابلة للإرجاع (${maxAllowed})`
        );
        return;
      }
    }

    if (!reason.trim()) {
      setFormError('يرجى كتابة سبب الإرجاع أو إصدار الإشعار الدائن (متطلب ضريبي ومحاسبي)');
      return;
    }

    const prefix = returnKind === 'sale_return' ? 'CN' : 'PR';
    const existingNos = returns.filter((r) => r.kind === returnKind).map((r) => r.returnNo);
    const returnNo = getNextSequenceNumber(prefix, existingNos);

    let originalDocNo = '';
    let partyName = '';
    let partyPhone = '';
    let partyVatNumber = '';

    if (returnKind === 'sale_return') {
      const sale = sales.find((s) => s.id === selectedDocId)!;
      originalDocNo = sale.invoiceNo;
      partyName = sale.customerName;
      partyPhone = sale.customerPhone;
      partyVatNumber = sale.customerVatNumber || '';
    } else {
      const purch = purchases.find((p) => p.id === selectedDocId)!;
      originalDocNo = purch.supplierInvoiceNo || purch.id;
      partyName = purch.supplier;
      partyVatNumber = purch.supplierVatNumber || '';
    }

    const returnItems: ReturnLineItem[] = validLines.map((l, idx) => ({
      id: `rline-${Date.now()}-${idx}`,
      originalLineId: l.id,
      itemName: l.itemName,
      specifications: l.specifications,
      unitType: l.unitType,
      soldOrPurchasedQty: l.originalQty,
      returnQty: l.returnQty,
      unitPrice: l.unitPrice,
      lineTotal: roundMoney(l.returnQty * l.unitPrice),
      restockInventoryId: l.restockInventoryId || undefined,
      restockQty: restockToInventory ? l.restockQty : 0,
    }));

    const newRecord: ReturnRecord = {
      id: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      returnNo,
      kind: returnKind,
      returnType,
      date: returnDate,
      originalDocId: selectedDocId,
      originalDocNo,
      partyName,
      partyPhone,
      partyVatNumber,
      items: returnItems,
      subtotalBeforeTax: liveModalTotals.subtotalBeforeTax,
      isTaxIncluded: liveModalTotals.isTaxIncluded,
      taxRate: liveModalTotals.taxRate,
      taxAmount: liveModalTotals.taxAmount,
      totalRefundAmount: liveModalTotals.totalRefundAmount,
      refundMethod,
      paymentMethod,
      restockToInventory,
      reason: reason.trim(),
      notes: notes.trim(),
    };

    // تجهيز تعديلات المخزون الآلية
    const stockAdjustments: { inventoryId: string; quantityDelta: number; reason: string }[] = [];
    if (restockToInventory) {
      for (const l of validLines) {
        if (l.restockInventoryId && l.restockQty > 0) {
          // في مرتجع المبيعات نعيد الكمية للمخزون (+)، وفي مرتجع المشتريات نخصمها من المخزون لإرجاعها للمورد (-)
          const delta = returnKind === 'sale_return' ? l.restockQty : -l.restockQty;
          stockAdjustments.push({
            inventoryId: l.restockInventoryId,
            quantityDelta: delta,
            reason: `${returnKind === 'sale_return' ? 'إرجاع للمخزون من إشعار دائن' : 'خصم مرتجع مشتريات للمورد'} رقم ${returnNo}`,
          });
        }
      }
    }

    onAddReturn(newRecord, stockAdjustments, refundMethod === 'cash_voucher');
    setIsModalOpen(false);
  };

  const handleSubmitWastage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wastageInventoryId || wastageQty <= 0) return;
    onRecordWastage(
      wastageInventoryId,
      wastageQty,
      wastageReason.trim() || 'هالك طباعة وقص',
      wastageRefInvoice.trim() || undefined
    );
    setIsWastageModalOpen(false);
  };

  const saleReturnsList = useMemo(() => {
    return returns
      .filter((r) => r.kind === 'sale_return')
      .filter(
        (r) =>
          !searchTerm ||
          r.returnNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.originalDocNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [returns, searchTerm]);

  const purchaseReturnsList = useMemo(() => {
    return returns
      .filter((r) => r.kind === 'purchase_return')
      .filter(
        (r) =>
          !searchTerm ||
          r.returnNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.originalDocNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [returns, searchTerm]);

  const wastageMovements = useMemo(() => {
    return movements.filter((m) => m.type === 'wastage_out');
  }, [movements]);

  const totalSaleReturnsSum = saleReturnsList.reduce((s, r) => s + r.totalRefundAmount, 0);
  const totalPurchaseReturnsSum = purchaseReturnsList.reduce((s, r) => s + r.totalRefundAmount, 0);
  const totalWastageCost = wastageMovements.reduce((s, m) => s + Math.abs(m.totalCost || 0), 0);

  return (
    <div className="space-y-4">
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>وضع المشاهد: استعراض فقط</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي مرتجعات المبيعات (إشعارات الدائن)</p>
            <p className="text-lg font-extrabold text-rose-700 mt-1 font-mono">
              {totalSaleReturnsSum.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{saleReturnsList.length} إشعار دائن مسجل</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي مرتجعات المشتريات للموردين</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-1 font-mono">
              {totalPurchaseReturnsSum.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{purchaseReturnsList.length} مرتجع شراء مسجل</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">تكلفة الهالك والتالف التشغيلي (طباعة وقص)</p>
            <p className="text-lg font-extrabold text-amber-700 mt-1 font-mono">
              {totalWastageCost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{wastageMovements.length} حركة هالك مسجلة</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Top Controls & Sub-tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('sale_returns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'sale_returns'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🧾 مرتجعات المبيعات (إشعارات الدائن) ({saleReturnsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('purchase_returns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'purchase_returns'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📦 مرتجعات المشتريات للموردين ({purchaseReturnsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('wastage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'wastage'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🔥 سجل الهالك والتالف الطباعي ({wastageMovements.length})
          </button>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث برقم الإشعار، الفاتورة، أو العميل..."
              className="w-full pr-9 pl-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {userRole !== 'viewer' && (
            <>
              <button
                type="button"
                onClick={() => openNewReturnModal('sale_return')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ إشعار دائن (مرتجع مبيعات)</span>
              </button>
              <button
                type="button"
                onClick={() => openNewReturnModal('purchase_return')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ مرتجع مشتريات لمورد</span>
              </button>
              <button
                type="button"
                onClick={() => setIsWastageModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>تسجيل هالك خامات</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Table */}
      {activeSubTab !== 'wastage' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-3">رقم الإشعار</th>
                  <th className="p-3">الفاتورة الأصلية</th>
                  <th className="p-3">{activeSubTab === 'sale_returns' ? 'العميل' : 'المورد'}</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">نوع الإرجاع</th>
                  <th className="p-3">الأصناف المرتجعة</th>
                  <th className="p-3">الإجمالي المسترد</th>
                  <th className="p-3">المعالجة المالية والمخزنية</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(activeSubTab === 'sale_returns' ? saleReturnsList : purchaseReturnsList).map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-extrabold text-slate-900">{rec.returnNo}</td>
                    <td className="p-3 font-mono font-bold text-indigo-700">{rec.originalDocNo}</td>
                    <td className="p-3 font-bold text-slate-800">{rec.partyName}</td>
                    <td className="p-3 font-mono text-slate-600">{rec.date}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {rec.returnType === 'full'
                          ? 'مرتجع كامل'
                          : rec.returnType === 'partial'
                          ? 'مرتجع جزئي'
                          : rec.returnType === 'exchange'
                          ? 'استبدال'
                          : 'تالف طباعة'}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs">
                      <div className="font-semibold text-slate-800 truncate">
                        {rec.items.map((i) => `${i.itemName} (${i.returnQty} ${i.unitType})`).join(' ، ')}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{rec.reason}</div>
                    </td>
                    <td className="p-3 font-mono font-extrabold text-rose-700">
                      {rec.totalRefundAmount.toFixed(2)} ر.س
                      {rec.isTaxIncluded && (
                        <div className="text-[10px] text-slate-500 font-normal">
                          شامل ضريبة: {rec.taxAmount.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 space-y-1">
                      <div className="text-[11px] font-bold text-emerald-700">
                        {rec.refundMethod === 'cash_voucher'
                          ? `سند مالي (${rec.generatedVoucherNo || rec.paymentMethod})`
                          : rec.refundMethod === 'account_deduction'
                          ? 'خصم من رصيد الفاتورة'
                          : 'استبدال بدون أثر نقدي'}
                      </div>
                      {rec.restockToInventory && (
                        <span className="inline-block text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 font-semibold">
                          مرتبط بالمخزون
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPrintRecord(rec)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer ml-1"
                        title="طباعة وتصدير الإشعار"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {canDeleteItem(userRole) && (
                        confirmDeleteId === rec.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteReturn(rec.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                          >
                            تأكيد الحذف
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(rec.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            title="حذف الإشعار وعكس أثره على الفاتورة والمخزون"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
                {(activeSubTab === 'sale_returns' ? saleReturnsList : purchaseReturnsList).length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                      لا توجد سجلات مرتجعات أو إشعارات دائن في هذا القسم حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Wastage Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-amber-900 text-white">
                <tr>
                  <th className="p-3">رقم الحركة</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الخامة / الصنف</th>
                  <th className="p-3">الكمية التالفة</th>
                  <th className="p-3">الرصيد قبل / بعد</th>
                  <th className="p-3">تكلفة الهالك المقدرة</th>
                  <th className="p-3">السبب والمرجع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {wastageMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-amber-50/30">
                    <td className="p-3 font-mono font-bold">{m.movementNo}</td>
                    <td className="p-3 font-mono">{m.date}</td>
                    <td className="p-3 font-bold text-slate-900">{m.itemName}</td>
                    <td className="p-3 font-mono font-extrabold text-rose-600">
                      {Math.abs(m.quantityChange)} {m.unit}
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {m.previousQty} ← <span className="font-bold text-slate-900">{m.newQty}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-amber-800">
                      {Math.abs(m.totalCost || 0).toFixed(2)} ر.س
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{m.reason}</div>
                      {m.referenceDocNo && (
                        <div className="text-[11px] text-slate-500">مرجع الطلب: {m.referenceDocNo}</div>
                      )}
                    </td>
                  </tr>
                ))}
                {wastageMovements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold">
                      لم يتم تسجيل أي هالك أو تالف طباعي حتى الآن
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Credit Note / Return */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden my-8">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  {returnKind === 'sale_return'
                    ? 'إصدار إشعار دائن ضريبي (مرتجع مبيعات مرتبط بفاتورة)'
                    : 'إصدار إشعار مرتجع مشتريات لمورد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {returnKind === 'sale_return' ? 'اختر فاتورة المبيعات الأصلية *' : 'اختر فاتورة الشراء الأصلية *'}
                  </label>
                  <select
                    value={selectedDocId}
                    onChange={(e) => handleSelectDocument(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                    required
                  >
                    <option value="">— اختر الفاتورة —</option>
                    {returnKind === 'sale_return'
                      ? sales
                          .filter((s) => s.orderStatus !== 'ملغى')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.invoiceNo} — {s.customerName} ({s.netTotal} ر.س)
                            </option>
                          ))
                      : purchases.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.supplierInvoiceNo || p.id} — {p.supplier} ({p.total} ر.س)
                          </option>
                        ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الإشعار *</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طبيعة المرتجع *</label>
                  <select
                    value={returnType}
                    onChange={(e) => handleReturnTypeChange(e.target.value as ReturnActionType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="partial">مرتجع جزئي (كمية محددة)</option>
                    <option value="full">مرتجع كامل للفاتورة</option>
                    <option value="defect">مرتجع بسبب عيب طباعة / مقاس</option>
                    <option value="exchange">استبدال وإعادة طباعة للعميل</option>
                  </select>
                </div>
              </div>

              {selectedDocId && lineDrafts.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-800 flex items-center justify-between">
                    <span>بنود الفاتورة وتحديد الكميات المرتجعة والربط بالمخزون</span>
                    <span className="text-[11px] text-slate-500">لا يمكن تجاوز الكمية المباعة/المشتراة</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">البند / الخدمة</th>
                          <th className="p-2.5 text-center w-20">الأصلية</th>
                          <th className="p-2.5 text-center w-24">مرتجع سابقاً</th>
                          <th className="p-2.5 text-center w-28">الكمية المرتجعة الآن</th>
                          <th className="p-2.5 text-center w-24">سعر الوحدة</th>
                          <th className="p-2.5 w-48">ربط بصنف المخزون (اختياري)</th>
                          <th className="p-2.5 text-center w-24">كمية المخزون</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {lineDrafts.map((line, idx) => {
                          const maxRem = Math.max(0, roundMoney(line.originalQty - line.alreadyReturnedQty));
                          return (
                            <tr key={line.id || idx}>
                              <td className="p-2.5">
                                <div className="font-bold text-slate-900">{line.itemName}</div>
                                <div className="text-[10px] text-slate-500">{line.specifications}</div>
                              </td>
                              <td className="p-2.5 text-center font-mono">
                                {line.originalQty} {line.unitType}
                              </td>
                              <td className="p-2.5 text-center font-mono text-amber-700">
                                {line.alreadyReturnedQty}
                              </td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxRem}
                                  step="0.01"
                                  value={line.returnQty}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setLineDrafts((prev) =>
                                      prev.map((item, i) =>
                                        i === idx ? { ...item, returnQty: val, restockQty: val } : item
                                      )
                                    );
                                  }}
                                  className="w-24 px-2 py-1 text-center font-mono font-bold rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500"
                                />
                              </td>
                              <td className="p-2.5 text-center font-mono">{line.unitPrice.toFixed(2)}</td>
                              <td className="p-2.5">
                                <select
                                  value={line.restockInventoryId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLineDrafts((prev) =>
                                      prev.map((item, i) =>
                                        i === idx ? { ...item, restockInventoryId: val } : item
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white"
                                >
                                  <option value="">— بدون حركة مخزون —</option>
                                  {inventory.map((inv) => (
                                    <option key={inv.id} value={inv.id}>
                                      {inv.item} ({inv.type} - {inv.color}) [الرصيد: {inv.currentQty} {inv.unit}]
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  disabled={!line.restockInventoryId || !restockToInventory}
                                  value={line.restockQty}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setLineDrafts((prev) =>
                                      prev.map((item, i) => (i === idx ? { ...item, restockQty: val } : item))
                                    );
                                  }}
                                  className="w-20 px-2 py-1 text-center font-mono rounded-lg border border-slate-300 disabled:bg-slate-100"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Financial & Stock Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طريقة التسوية المالية *</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="cash_voucher">
                      {returnKind === 'sale_return'
                        ? 'إصدار سند صرف آلي للعميل + تحديث الفاتورة'
                        : 'إصدار سند قبض استرداد من المورد + تحديث الفاتورة'}
                    </option>
                    <option value="account_deduction">خصم من الرصيد المتبقي على الفاتورة فقط (بدون سند نقدي)</option>
                    <option value="exchange_replacement">استبدال بضاعة / إعادة طباعة (بدون أثر مالي)</option>
                  </select>
                </div>

                {refundMethod === 'cash_voucher' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع / الاسترداد</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                    >
                      <option value="كاش">نقداً (كاش)</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="شبكة مدى">شبكة مدى</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={restockToInventory}
                      onChange={(e) => setRestockToInventory(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>
                      {returnKind === 'sale_return'
                        ? 'إرجاع الكميات المحددة إلى رصيد المخزون تلقائياً'
                        : 'خصم الكميات المرتجعة للمورد من المخزون تلقائياً'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سبب الإرجاع / إصدار الإشعار الدائن *
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="مثال: اختلاف درجة اللون في الطباعة / تعديل مقاس اللوحة..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات داخلية..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              {/* Totals Preview */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs space-y-1">
                  <div className="text-slate-600">
                    قيمة المرتجع قبل الضريبة:{' '}
                    <b className="font-mono">{liveModalTotals.subtotalBeforeTax.toFixed(2)} ر.س</b>
                  </div>
                  {liveModalTotals.isTaxIncluded && (
                    <div className="text-amber-800">
                      ضريبة القيمة المضافة المستردة ({liveModalTotals.taxRate}%):{' '}
                      <b className="font-mono">{liveModalTotals.taxAmount.toFixed(2)} ر.س</b>
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-rose-900">إجمالي قيمة الإشعار المسترد</div>
                  <div className="text-xl font-extrabold font-mono text-rose-700">
                    {liveModalTotals.totalRefundAmount.toFixed(2)} ر.س
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  حفظ واعتماد الإشعار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Wastage (هالك وتالف الطباعة والقص) */}
      {isWastageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-4 bg-amber-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-sm">تسجيل هالك أو تالف خامات طباعة وقص</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWastageModalOpen(false)}
                className="p-1 rounded-lg bg-amber-800 hover:bg-rose-600 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitWastage} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الخامة في المستودع *</label>
                <select
                  value={wastageInventoryId}
                  onChange={(e) => setWastageInventoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  required
                >
                  <option value="">— اختر الصنف —</option>
                  {inventory.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.item} ({inv.type} - {inv.color}) — المتوفر: {inv.currentQty} {inv.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الكمية التالفة / الهالكة *</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={wastageQty}
                  onChange={(e) => setWastageQty(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب الهالك *</label>
                <input
                  type="text"
                  value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value)}
                  placeholder="مثال: انقطاع رأس الطباعة / خطأ مقاس قص بلوتر..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الفاتورة أو أمر العمل المرتبط (اختياري)</label>
                <input
                  type="text"
                  value={wastageRefInvoice}
                  onChange={(e) => setWastageRefInvoice(e.target.value)}
                  placeholder="INV-2026-0001"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsWastageModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm cursor-pointer"
                >
                  خصم الهالك من المخزون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Credit Note Modal */}
      <CreditNotePrintModal
        returnRecord={printRecord}
        onClose={() => setPrintRecord(null)}
        agencySettings={agencySettings}
      />
    </div>
  );
};
