import {
  SaleItem,
  PurchaseItem,
  ExpenseItem,
  InventoryItem,
  CUSTOMER_SOURCES,
  SERVICE_TYPES,
  SALES_UNIT_TYPES,
  SALES_PAYMENT_METHODS,
  ORDER_STATUSES,
  PURCHASE_ITEMS,
  PURCHASE_UNIT_TYPES,
  PURCHASE_PAYMENT_METHODS,
  EXPENSE_TYPES,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  INVENTORY_ITEMS,
  INVENTORY_SUBTYPES,
  INVENTORY_COLORS,
  INVENTORY_UNITS,
} from '../types';

export const SALES_HEADERS = [
  'رقم الفاتورة',
  'اسم العميل',
  'رقم الجوال',
  'مصدر العميل',
  'نوع الخدمة',
  'المواصفات',
  'الكمية',
  'نوع القياس',
  'سعر الوحدة',
  'إجمالي الطلب',
  'إجمالي الفاتورة',
  'الخصم',
  'الصافي',
  'طريقة الدفع',
  'المدفوع',
  'المتبقي',
  'حالة الدفع',
  'تاريخ الاستلام',
  'تاريخ التسليم',
  'حالة الطلب',
  'مسؤول التنفيذ',
  'أيام التأخير',
  'ملاحظات التنفيذ',
];

export const PURCHASES_HEADERS = [
  'التاريخ',
  'رقم فاتورة المورد',
  'الصنف',
  'نوع القياس',
  'الكمية',
  'سعر الشراء',
  'الإجمالي',
  'المورد',
  'طريقة الدفع',
  'المدفوع',
  'المتبقي',
  'حالة الدفع',
];

export const EXPENSES_HEADERS = [
  'التاريخ',
  'نوع المصروف',
  'التصنيف',
  'المبلغ',
  'طريقة الدفع',
  'ملاحظات',
];

export const INVENTORY_HEADERS = [
  'الصنف',
  'النوع',
  'اللون',
  'الوحدة',
  'الكمية الحالية',
  'الحد الأدنى',
  'الحالة',
  'ملاحظات',
];

export const DASHBOARD_HEADERS = ['المؤشر المالي', 'القيمة التلقائية'];

/**
 * Creates a complete Google Spreadsheet with 5 formatted sheets, formulas, and dropdown validations.
 */
export async function createCompleteSpreadsheet(
  accessToken: string,
  title: string = 'نظام محاسبة الدعاية والإعلان والمطبوعات'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create spreadsheet with sheets
  const createPayload = {
    properties: {
      title,
      autoRecalc: 'ON_CHANGE',
      timeZone: 'Asia/Riyadh',
    },
    sheets: [
      {
        properties: {
          title: 'الداشبورد',
          sheetId: 0,
          rightToLeft: true,
          gridProperties: { rowCount: 50, columnCount: 10, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'المبيعات',
          sheetId: 1,
          rightToLeft: true,
          gridProperties: { rowCount: 200, columnCount: 26, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'المشتريات',
          sheetId: 2,
          rightToLeft: true,
          gridProperties: { rowCount: 200, columnCount: 16, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'المصروفات',
          sheetId: 3,
          rightToLeft: true,
          gridProperties: { rowCount: 200, columnCount: 10, frozenRowCount: 1 },
        },
      },
      {
        properties: {
          title: 'المخزون',
          sheetId: 4,
          rightToLeft: true,
          gridProperties: { rowCount: 200, columnCount: 12, frozenRowCount: 1 },
        },
      },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `فشل إنشاء جدول البيانات (${createRes.status})`);
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;

  // 2. Add header rows and initial formula templates
  const initialValues = [
    {
      range: 'المبيعات!A1:W1',
      values: [SALES_HEADERS],
    },
    {
      range: 'المشتريات!A1:L1',
      values: [PURCHASES_HEADERS],
    },
    {
      range: 'المصروفات!A1:F1',
      values: [EXPENSES_HEADERS],
    },
    {
      range: 'المخزون!A1:H1',
      values: [INVENTORY_HEADERS],
    },
    {
      range: 'الداشبورد!A1:B9',
      values: [
        DASHBOARD_HEADERS,
        ['إجمالي المبيعات', '=SUM(المبيعات!M:M)'],
        ['إجمالي المشتريات', '=SUM(المشتريات!G:G)'],
        ['إجمالي المصروفات', '=SUM(المصروفات!D:D)'],
        ['صافي الربح', '=B2-B3-B4'],
        ['المستحقات من العملاء', '=SUM(المبيعات!P:P)'],
        ['المستحقات للموردين', '=SUM(المشتريات!K:K)'],
        ['التدفق النقدي المتوقع', '=B5+B6-B7'],
        ['فواتير غير مسددة', '=COUNTIF(المبيعات!Q:Q, "🔴 غير مسدد")'],
      ],
    },
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: initialValues,
      }),
    }
  );

  // 3. Apply Professional Formatting & Dropdowns via batchUpdate
  try {
    const requests: any[] = [
      // Format Dashboard headers
      {
        repeatCell: {
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.08, green: 0.38, blue: 0.31 }, // Emerald Dark
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      // Format Sales headers
      {
        repeatCell: {
          range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.12, green: 0.28, blue: 0.48 }, // Royal Blue
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      // Format Purchases headers
      {
        repeatCell: {
          range: { sheetId: 2, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.42, green: 0.18, blue: 0.45 }, // Purple
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      // Format Expenses headers
      {
        repeatCell: {
          range: { sheetId: 3, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.72, green: 0.22, blue: 0.18 }, // Crimson
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      // Format Inventory headers
      {
        repeatCell: {
          range: { sheetId: 4, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.82, green: 0.52, blue: 0.08 }, // Amber
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      // Add Dropdown to Sales: Customer Source (Col D, index 3)
      createDropdownRule(1, 3, 4, [...CUSTOMER_SOURCES]),
      // Add Dropdown to Sales: Service Type (Col E, index 4)
      createDropdownRule(1, 4, 5, [...SERVICE_TYPES]),
      // Add Dropdown to Sales: Unit Type (Col H, index 7)
      createDropdownRule(1, 7, 8, [...SALES_UNIT_TYPES]),
      // Add Dropdown to Sales: Payment Method (Col N, index 13)
      createDropdownRule(1, 13, 14, [...SALES_PAYMENT_METHODS]),
      // Add Dropdown to Sales: Order Status (Col T, index 19)
      createDropdownRule(1, 19, 20, [...ORDER_STATUSES]),

      // Purchases Dropdowns:
      // Item (Col C, index 2)
      createDropdownRule(2, 2, 3, [...PURCHASE_ITEMS]),
      // Unit Type (Col D, index 3)
      createDropdownRule(2, 3, 4, [...PURCHASE_UNIT_TYPES]),
      // Payment Method (Col I, index 8)
      createDropdownRule(2, 8, 9, [...PURCHASE_PAYMENT_METHODS]),

      // Expenses Dropdowns:
      // Expense Type (Col B, index 1)
      createDropdownRule(3, 1, 2, [...EXPENSE_TYPES]),
      // Category (Col C, index 2)
      createDropdownRule(3, 2, 3, [...EXPENSE_CATEGORIES]),
      // Payment Method (Col E, index 4)
      createDropdownRule(3, 4, 5, [...EXPENSE_PAYMENT_METHODS]),

      // Inventory Dropdowns:
      // Item (Col A, index 0)
      createDropdownRule(4, 0, 1, [...INVENTORY_ITEMS]),
      // Type (Col B, index 1)
      createDropdownRule(4, 1, 2, [...INVENTORY_SUBTYPES]),
      // Color (Col C, index 2)
      createDropdownRule(4, 2, 3, [...INVENTORY_COLORS]),
      // Unit (Col D, index 3)
      createDropdownRule(4, 3, 4, [...INVENTORY_UNITS]),
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );
  } catch (fmtErr) {
    console.warn('Formatting batch update error:', fmtErr);
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

function createDropdownRule(sheetId: number, startCol: number, endCol: number, values: string[]) {
  return {
    setDataValidation: {
      range: {
        sheetId,
        startRowIndex: 1,
        endRowIndex: 500,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: values.map((v) => ({ userEnteredValue: v })),
        },
        strict: true,
        showCustomUi: true,
      },
    },
  };
}

/**
 * Append or replace full dataset in the specified spreadsheet
 */
export async function syncAllDataToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  sales: SaleItem[],
  purchases: PurchaseItem[],
  expenses: ExpenseItem[],
  inventory: InventoryItem[]
): Promise<void> {
  // Build Sales rows with exact formulas requested:
  // Row indexing starts at 2 (row 1 is header)
  const salesData = sales.map((s, idx) => {
    const row = idx + 2;
    return [
      `=IF(AND(B${row}<>"", K${row}<>""), "F-"&YEAR(TODAY())&"-"&TEXT(ROW(A${row - 1}),"000"), "")`,
      s.customerName,
      s.customerPhone,
      s.customerSource,
      s.serviceType,
      s.specifications,
      s.quantity,
      s.unitType,
      s.unitPrice,
      `=IF(OR(G${row}="", I${row}=""), "", G${row}*I${row})`,
      s.invoiceTotal,
      s.discount,
      `=IF(K${row}="", "", K${row}-L${row})`,
      s.paymentMethod,
      s.paidAmount,
      `=IF(M${row}="", "", M${row}-O${row})`,
      `=IF(OR(M${row}="", O${row}=""), "", IF(P${row}=0, "✅ مسدد", IF(P${row}=M${row}, "🔴 غير مسدد", "🟡 مسدد جزئي")))`,
      s.receiptDate || '=TODAY()',
      s.deliveryDate,
      s.orderStatus,
      s.assignedTo,
      `=IF(AND(S${row}<>"", S${row}<TODAY(), T${row}<>"تم التسليم"), TODAY()-S${row}, "")`,
      s.notes,
    ];
  });

  // Purchases rows:
  const purchasesData = purchases.map((p, idx) => {
    const row = idx + 2;
    return [
      p.date || '=TODAY()',
      p.supplierInvoiceNo,
      p.item,
      p.unitType,
      p.quantity,
      p.purchasePrice,
      `=IF(OR(E${row}="", F${row}=""), "", E${row}*F${row})`,
      p.supplier,
      p.paymentMethod,
      p.paidAmount,
      `=IF(OR(G${row}="", J${row}=""), "", G${row}-J${row})`,
      `=IF(OR(G${row}="", J${row}=""), "", IF(K${row}=0, "✅ مسدد", IF(K${row}=G${row}, "🔴 غير مسدد", "🟡 مسدد جزئي")))`,
    ];
  });

  // Expenses rows:
  const expensesData = expenses.map((e) => [
    e.date,
    e.expenseType,
    e.category,
    e.amount,
    e.paymentMethod,
    e.notes,
  ]);

  // Inventory rows:
  const inventoryData = inventory.map((inv, idx) => {
    const row = idx + 2;
    return [
      inv.item,
      inv.type,
      inv.color,
      inv.unit,
      inv.currentQty,
      inv.minQty,
      `=IF(E${row}<=F${row}, "🛒 طلب شراء", IF(E${row}<=F${row}*1.5, "🟡 منخفض", "🟢 كافي"))`,
      inv.notes,
    ];
  });

  // Clear existing rows (except headers)
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: [
          'المبيعات!A2:W1000',
          'المشتريات!A2:L1000',
          'المصروفات!A2:F1000',
          'المخزون!A2:H1000',
        ],
      }),
    }
  );

  if (!clearRes.ok) {
    if (clearRes.status === 401) {
      throw new Error('EXPIRED_GOOGLE_TOKEN');
    }
    const err = await clearRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'فشل تفريغ البيانات السابقة في Google Sheets');
  }

  const updates = [
    {
      range: `المبيعات!A2:W${Math.max(2, salesData.length + 1)}`,
      values: salesData.length > 0 ? salesData : [[]],
    },
    {
      range: `المشتريات!A2:L${Math.max(2, purchasesData.length + 1)}`,
      values: purchasesData.length > 0 ? purchasesData : [[]],
    },
    {
      range: `المصروفات!A2:F${Math.max(2, expensesData.length + 1)}`,
      values: expensesData.length > 0 ? expensesData : [[]],
    },
    {
      range: `المخزون!A2:H${Math.max(2, inventoryData.length + 1)}`,
      values: inventoryData.length > 0 ? inventoryData : [[]],
    },
  ].filter((u) => u.values[0] && u.values[0].length > 0);

  if (updates.length > 0) {
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: updates,
        }),
      }
    );

    if (!updateRes.ok) {
      if (updateRes.status === 401) {
        throw new Error('EXPIRED_GOOGLE_TOKEN');
      }
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'فشل تحديث بيانات جدول Google Sheets');
    }
  }
}

/**
 * Fetch spreadsheet metadata to verify accessibility
 */
export async function getSpreadsheetDetails(accessToken: string, spreadsheetId: string) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('EXPIRED_GOOGLE_TOKEN');
    }
    throw new Error('تعذر الوصول إلى جدول البيانات. تأكد من صحة الرابط أو المعرف وصلاحية الوصول.');
  }
  return await res.json();
}
