/**
 * تفقيط الأرقام وتحويلها إلى كلمات باللغة العربية (خاص بالسندات المالية والفواتير)
 */

const ONES = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];

const TENS = [
  '',
  'عشرة',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون',
];

const HUNDREDS = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

function convertGroup(n: number): string {
  let output = '';
  const h = Math.floor(n / 100);
  const remainder = n % 100;

  if (h > 0) {
    output += HUNDREDS[h];
  }

  if (remainder > 0) {
    if (output) output += ' و';
    if (remainder < 20) {
      output += ONES[remainder];
    } else {
      const one = remainder % 10;
      const ten = Math.floor(remainder / 10);
      if (one > 0) {
        output += ONES[one] + ' و' + TENS[ten];
      } else {
        output += TENS[ten];
      }
    }
  }

  return output;
}

export function tafqeet(amount: number, currency = 'ريال سعودي', subunit = 'هللة'): string {
  if (!amount || isNaN(amount) || amount === 0) {
    return `صفر ${currency} فقط لا غير`;
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) {
    return `صفر ${currency} فقط لا غير`;
  }

  const billions = Math.floor(integerPart / 1_000_000_000);
  const millions = Math.floor((integerPart % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((integerPart % 1_000_000) / 1_000);
  const units = integerPart % 1_000;

  const parts: string[] = [];

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else parts.push(`${convertGroup(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألف`);
  }

  if (units > 0) {
    parts.push(convertGroup(units));
  }

  let text = parts.join(' و');

  let result = '';
  if (isNegative) result += 'سالب ';
  if (text) {
    result += `${text} ${currency}`;
  }

  if (decimalPart > 0) {
    const decimalText = convertGroup(decimalPart);
    if (result) {
      result += ` و${decimalText} ${subunit}`;
    } else {
      result += `${decimalText} ${subunit}`;
    }
  }

  return `${result} فقط لا غير`;
}
