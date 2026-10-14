import * as XLSX from 'xlsx';
import { SaleItem, PurchaseItem, ExpenseItem, InventoryItem } from '../types';

/**
 * Creates and downloads a complete Excel workbook (.xlsx)
 * matching the exact 5 sheets structure with Arabic headers and formulas.
 */
export function exportToExcelFile(
  sales: SaleItem[],
  purchases: PurchaseItem[],
  expenses: ExpenseItem[],
  inventory: InventoryItem[]
) {
  const wb = XLSX.utils.book_new();

  // ==========================================
  // 1. ورقة الداشبورد (Dashboard)
  // ==========================================
  const dashboardData = [
    ['المؤشر المالي', 'الصيغة / القيمة', 'ملاحظات وتوضيح'],
    ['إجمالي المبيعات', { f: 'SUM(المبيعات!M:M)' }, 'مجموع صافي مبيعات الفواتير'],
    ['إجمالي المشتريات', { f: 'SUM(المشتريات!G:G)' }, 'مجموع فواتير مشتريات الخامات'],
    ['إجمالي المصروفات', { f: 'SUM(المصروفات!D:D)' }, 'مجموع المصاريف التشغيلية والإدارية'],
    ['صافي الربح الفعلي', { f: 'B2-B3-B4' }, 'المبيعات ناقص المشتريات والمصروفات'],
    ['المستحقات من العملاء', { f: 'SUM(المبيعات!P:P)' }, 'المبالغ المتبقية للتحصيل من العملاء'],
    ['المستحقات للموردين', { f: 'SUM(المشتريات!K:K)' }, 'الديون المتبقية الواجب سدادها للشركات الموردة'],
    ['التدفق النقدي المتوقع', { f: 'B5+B6-B7' }, 'الربح + ديون العملاء - التزامات الموردين'],
    ['عدد الفواتير غير المسددة', { f: 'COUNTIF(المبيعات!Q:Q, "*غير مسدد*")' }, 'فواتير تحتاج لمتابعة التحصيل'],
  ];
  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardData);
  wsDashboard['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsDashboard, 'الداشبورد');

  // ==========================================
  // 2. ورقة المبيعات (Sales - 23 عموداً A-W)
  // ==========================================
  const salesHeaders = [
    'كود الفاتورة', // A
    'اسم العميل', // B
    'رقم الجوال', // C
    'مصدر العميل', // D
    'نوع الخدمة', // E
    'المواصفات', // F
    'الكمية', // G
    'الوحدة', // H
    'سعر الوحدة', // I
    'إجمالي البند', // J
    'إجمالي الفاتورة', // K
    'الخصم', // L
    'الصافي', // M
    'طريقة الدفع', // N
    'المدفوع', // O
    'المتبقي', // P
    'حالة السداد', // Q
    'تاريخ الاستلام', // R
    'تاريخ التسليم', // S
    'حالة الطلب', // T
    'المسؤول', // U
    'أيام التأخير', // V
    'ملاحظات', // W
  ];

  const salesRows = sales.map((s, idx) => {
    const row = idx + 2;
    return [
      s.invoiceNo, // A
      s.customerName, // B
      s.customerPhone, // C
      s.customerSource, // D
      s.serviceType, // E
      s.specifications, // F
      s.quantity, // G
      s.unitType, // H
      s.unitPrice, // I
      { f: `G${row}*I${row}` }, // J: item total = G * I
      s.invoiceTotal || { f: `J${row}` }, // K: gross total
      s.discount, // L: discount
      { f: `K${row}-L${row}` }, // M: net total = K - L
      s.paymentMethod, // N
      s.paidAmount, // O
      { f: `M${row}-O${row}` }, // P: remaining = M - O
      {
        f: `IF(P${row}<=0,"✅ مسدد",IF(P${row}>=M${row},"🔴 غير مسدد","🟡 مسدد جزئي"))`,
      }, // Q: payment status
      s.receiptDate, // R
      s.deliveryDate, // S
      s.orderStatus, // T
      s.assignedTo, // U
      {
        f: `IF(AND(S${row}<TODAY(),T${row}<>"تم التسليم"),TODAY()-S${row},"—")`,
      }, // V: delay days
      s.notes, // W
    ];
  });

  const wsSales = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesRows]);
  wsSales['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 15 },
    { wch: 14 },
    { wch: 18 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 15 },
    { wch: 14 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSales, 'المبيعات');

  // ==========================================
  // 3. ورقة المشتريات (Purchases - 12 عموداً A-L)
  // ==========================================
  const purchaseHeaders = [
    'التاريخ', // A
    'رقم فاتورة المورد', // B
    'الصنف / الخامة', // C
    'الوحدة', // D
    'الكمية', // E
    'سعر الشراء', // F
    'الإجمالي', // G
    'المورد', // H
    'طريقة الدفع', // I
    'المدفوع', // J
    'المتبقي للمورد', // K
    'حالة السداد', // L
  ];

  const purchaseRows = purchases.map((p, idx) => {
    const row = idx + 2;
    return [
      p.date, // A
      p.supplierInvoiceNo, // B
      p.item, // C
      p.unitType, // D
      p.quantity, // E
      p.purchasePrice, // F
      { f: `E${row}*F${row}` }, // G: total = E * F
      p.supplier, // H
      p.paymentMethod, // I
      p.paidAmount, // J
      { f: `G${row}-J${row}` }, // K: remaining = G - J
      {
        f: `IF(K${row}<=0,"✅ مسدد",IF(K${row}>=G${row},"🔴 غير مسدد","🟡 مسدد جزئي"))`,
      }, // L: status
    ];
  });

  const wsPurchases = XLSX.utils.aoa_to_sheet([purchaseHeaders, ...purchaseRows]);
  wsPurchases['!cols'] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPurchases, 'المشتريات');

  // ==========================================
  // 4. ورقة المصروفات (Expenses - 6 أعمدة A-F)
  // ==========================================
  const expenseHeaders = [
    'التاريخ', // A
    'بند المصروف', // B
    'التصنيف', // C
    'المبلغ', // D
    'طريقة الدفع', // E
    'ملاحظات', // F
  ];

  const expenseRows = expenses.map((e) => [
    e.date, // A
    e.expenseType, // B
    e.category, // C
    e.amount, // D
    e.paymentMethod, // E
    e.notes, // F
  ]);

  const wsExpenses = XLSX.utils.aoa_to_sheet([expenseHeaders, ...expenseRows]);
  wsExpenses['!cols'] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات');

  // ==========================================
  // 5. ورقة المخزون (Inventory - 8 أعمدة A-H)
  // ==========================================
  const inventoryHeaders = [
    'الصنف', // A
    'النوع', // B
    'اللون / المواصفات', // C
    'الوحدة', // D
    'الكمية الحالية', // E
    'حد إعادة الطلب', // F
    'حالة المخزون', // G
    'ملاحظات', // H
  ];

  const inventoryRows = inventory.map((item, idx) => {
    const row = idx + 2;
    return [
      item.item, // A
      item.type, // B
      item.color, // C
      item.unit, // D
      item.currentQty, // E
      item.minQty, // F
      {
        f: `IF(E${row}<=F${row},"🛒 طلب شراء",IF(E${row}<=F${row}*1.5,"🟡 منخفض","🟢 كافي"))`,
      }, // G: stock status
      item.notes, // H
    ];
  });

  const wsInventory = XLSX.utils.aoa_to_sheet([inventoryHeaders, ...inventoryRows]);
  wsInventory['!cols'] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInventory, 'المخزون');

  // Trigger Excel file download
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `نظام_محاسبة_الدعاية_والإعلان_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}
