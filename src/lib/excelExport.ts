import * as XLSX from 'xlsx';
import {
  SaleItem,
  PurchaseItem,
  ExpenseItem,
  InventoryItem,
  ReturnRecord,
  EmployeeItem,
  PayrollRun,
} from '../types';

/**
 * تصدير ملف إكسل شامل (.xlsx) بجميع أوراق العمل المالية والتشغيلية والمرتجعات والموارد البشرية
 */
export function exportToExcelFile(
  sales: SaleItem[],
  purchases: PurchaseItem[],
  expenses: ExpenseItem[],
  inventory: InventoryItem[],
  returns: ReturnRecord[] = [],
  employees: EmployeeItem[] = [],
  payrolls: PayrollRun[] = []
) {
  const wb = XLSX.utils.book_new();

  // 1. ورقة الداشبورد (Dashboard)
  const dashboardData = [
    ['المؤشر المالي', 'الصيغة / القيمة', 'ملاحظات وتوضيح'],
    ['إجمالي المبيعات', { f: 'SUM(المبيعات!M:M)' }, 'مجموع صافي مبيعات الفواتير'],
    ['إجمالي المشتريات', { f: 'SUM(المشتريات!G:G)' }, 'مجموع فواتير مشتريات الخامات'],
    ['إجمالي المصروفات', { f: 'SUM(المصروفات!D:D)' }, 'مجموع المصاريف التشغيلية والرواتب المعتمدة'],
    ['صافي الربح الفعلي', { f: 'B2-B3-B4' }, 'المبيعات ناقص المشتريات والمصروفات'],
    ['المستحقات من العملاء', { f: 'SUM(المبيعات!P:P)' }, 'المبالغ المتبقية للتحصيل من العملاء'],
    ['المستحقات للموردين', { f: 'SUM(المشتريات!K:K)' }, 'الديون المتبقية الواجب سدادها للشركات الموردة'],
    ['التدفق النقدي المتوقع', { f: 'B5+B6-B7' }, 'الربح + ديون العملاء - التزامات الموردين'],
    ['عدد الفواتير غير المسددة', { f: 'COUNTIF(المبيعات!Q:Q, "*غير مسدد*")' }, 'فواتير تحتاج لمتابعة التحصيل'],
  ];
  const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardData);
  wsDashboard['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsDashboard, 'الداشبورد');

  // 2. ورقة المبيعات (Sales)
  const salesHeaders = [
    'كود الفاتورة',
    'اسم العميل',
    'رقم الجوال',
    'مصدر العميل',
    'نوع الخدمة',
    'المواصفات',
    'الكمية',
    'الوحدة',
    'سعر الوحدة',
    'إجمالي البند',
    'إجمالي الفاتورة',
    'الخصم',
    'الصافي (مع الضريبة)',
    'طريقة الدفع',
    'المدفوع',
    'المتبقي',
    'حالة السداد',
    'تاريخ الاستلام',
    'تاريخ التسليم',
    'حالة الطلب',
    'المسؤول',
    'أيام التأخير',
    'ملاحظات',
  ];

  const salesRows = sales.map((s, idx) => {
    const row = idx + 2;
    return [
      s.invoiceNo,
      s.customerName,
      s.customerPhone,
      s.customerSource,
      s.serviceType,
      s.specifications,
      s.quantity,
      s.unitType,
      s.unitPrice,
      { f: `G${row}*I${row}` },
      s.invoiceTotal || { f: `J${row}` },
      s.discount,
      s.netTotal,
      s.paymentMethod,
      s.paidAmount,
      s.remainingAmount,
      s.paymentStatus,
      s.receiptDate,
      s.deliveryDate,
      s.orderStatus,
      s.assignedTo,
      s.delayDays || '—',
      s.notes,
    ];
  });

  const wsSales = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesRows]);
  wsSales['!cols'] = [
    { wch: 16 },
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
    { wch: 16 },
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

  // 3. ورقة المرتجعات وإشعارات الدائن (Returns)
  const returnsHeaders = [
    'رقم الإشعار / المرتجع',
    'النوع',
    'طبيعة الإرجاع',
    'التاريخ',
    'رقم الفاتورة الأصلية',
    'العميل / المورد',
    'قبل الضريبة',
    'قيمة الضريبة',
    'الإجمالي المسترد',
    'طريقة التسوية',
    'سبب الإرجاع',
  ];
  const returnsRows = returns.map((r) => [
    r.returnNo,
    r.kind === 'sale_return' ? 'إشعار دائن (مبيعات)' : 'مرتجع مشتريات',
    r.returnType === 'full' ? 'كامل' : r.returnType === 'partial' ? 'جزئي' : r.returnType === 'exchange' ? 'استبدال' : 'تالف طباعة',
    r.date,
    r.originalDocNo,
    r.partyName,
    r.subtotalBeforeTax,
    r.taxAmount,
    r.totalRefundAmount,
    r.refundMethod === 'cash_voucher' ? 'سند مالي' : r.refundMethod === 'account_deduction' ? 'خصم من الرصيد' : 'استبدال بضاعة',
    r.reason,
  ]);
  const wsReturns = XLSX.utils.aoa_to_sheet([returnsHeaders, ...returnsRows]);
  wsReturns['!cols'] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsReturns, 'المرتجعات');

  // 4. ورقة المشتريات (Purchases)
  const purchaseHeaders = [
    'التاريخ',
    'رقم فاتورة المورد',
    'الصنف / الخامة',
    'الوحدة',
    'الكمية',
    'سعر الشراء',
    'الإجمالي',
    'المورد',
    'طريقة الدفع',
    'المدفوع',
    'المتبقي للمورد',
    'حالة السداد',
  ];

  const purchaseRows = purchases.map((p) => [
    p.date,
    p.supplierInvoiceNo,
    p.item,
    p.unitType,
    p.quantity,
    p.purchasePrice,
    p.total,
    p.supplier,
    p.paymentMethod,
    p.paidAmount,
    p.remainingAmount,
    p.paymentStatus,
  ]);

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

  // 5. ورقة المصروفات (Expenses)
  const expenseHeaders = ['التاريخ', 'بند المصروف', 'التصنيف', 'المبلغ', 'طريقة الدفع', 'ملاحظات'];
  const expenseRows = expenses.map((e) => [
    e.date,
    e.expenseType,
    e.category,
    e.amount,
    e.paymentMethod,
    e.notes,
  ]);
  const wsExpenses = XLSX.utils.aoa_to_sheet([expenseHeaders, ...expenseRows]);
  wsExpenses['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات');

  // 6. ورقة المخزون (Inventory)
  const inventoryHeaders = [
    'الصنف',
    'النوع',
    'اللون / المواصفات',
    'الوحدة',
    'الكمية الحالية',
    'حد إعادة الطلب',
    'تكلفة الوحدة',
    'حالة المخزون',
    'ملاحظات',
  ];
  const inventoryRows = inventory.map((item) => [
    item.item,
    item.type,
    item.color,
    item.unit,
    item.currentQty,
    item.minQty,
    item.unitCost || 0,
    item.status,
    item.notes,
  ]);
  const wsInventory = XLSX.utils.aoa_to_sheet([inventoryHeaders, ...inventoryRows]);
  wsInventory['!cols'] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInventory, 'المخزون');

  // 7. ورقة الموظفين ومسيرات الرواتب (HR & Payroll)
  const empHeaders = [
    'كود الموظف',
    'اسم الموظف',
    'المسمى الوظيفي',
    'القسم',
    'الجوال',
    'تاريخ المباشرة',
    'الراتب الأساسي',
    'بدل السكن',
    'بدل النقل',
    'بدلات أخرى',
    'الإجمالي الشهري',
    'الحالة',
  ];
  const empRows = employees.map((emp) => [
    emp.employeeCode,
    emp.name,
    emp.jobTitle,
    emp.department,
    emp.phone,
    emp.joinDate,
    emp.baseSalary,
    emp.housingAllowance,
    emp.transportAllowance,
    emp.otherAllowance,
    emp.baseSalary + emp.housingAllowance + emp.transportAllowance + emp.otherAllowance,
    emp.status,
  ]);
  const wsEmployees = XLSX.utils.aoa_to_sheet([empHeaders, ...empRows]);
  wsEmployees['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsEmployees, 'الموظفون');

  if (payrolls.length > 0) {
    const payrollHeaders = [
      'رقم المسير',
      'الشهر',
      'تاريخ الإصدار',
      'عدد الموظفين',
      'إجمالي الرواتب والبدلات',
      'إجمالي الخصومات والغياب',
      'إجمالي الإضافي والمكافآت',
      'صافي المسير المنصرف',
      'الحالة',
    ];
    const payrollRows = payrolls.map((pr) => [
      pr.payrollNo,
      pr.month,
      pr.issueDate,
      pr.lines.length,
      pr.totalBaseAndAllowances,
      pr.totalDeductions,
      pr.totalOvertimeAndBonuses,
      pr.totalNetPayroll,
      pr.status === 'approved_paid' ? 'معتمد ومصروف' : 'مسودة',
    ]);
    const wsPayrolls = XLSX.utils.aoa_to_sheet([payrollHeaders, ...payrollRows]);
    wsPayrolls['!cols'] = [
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPayrolls, 'مسيرات الرواتب');
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `نظام_محاسبة_الدعاية_والإعلان_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}
