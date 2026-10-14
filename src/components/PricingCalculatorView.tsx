import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Grid,
  Tag,
  Layers,
  Ruler,
  Maximize2,
  DollarSign,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Percent,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  Search,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { PriceListItem, AgencySettings, UserRole } from '../types';
import { INITIAL_PRICE_LIST } from '../lib/dataStore';
import { getTranslations } from '../lib/translations';

interface PricingCalculatorViewProps {
  agencySettings: AgencySettings;
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  onUpdateAgencySettings: (settings: AgencySettings) => void;
  onNavigateToQuotation?: (data: any) => void;
  onNavigateToSale?: (data: any) => void;
}

type SubTab = 'nesting' | 'area_calculator' | 'price_list';

export const PricingCalculatorView: React.FC<PricingCalculatorViewProps> = ({
  agencySettings,
  userRole = 'owner',
  currentLang = (agencySettings.userProfile?.language || agencySettings.appLanguage || 'ar') as 'ar' | 'en',
  onUpdateAgencySettings,
}) => {
  const t = getTranslations(currentLang);
  const isEn = currentLang === 'en';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('nesting');

  // ==========================================
  // TAB 1: NESTING / QUANTITY CALCULATOR STATE
  // ==========================================
  // Item dimensions in cm (e.g. 5cm x 5cm)
  const [itemWidthCm, setItemWidthCm] = useState<number>(5);
  const [itemHeightCm, setItemHeightCm] = useState<number>(5);

  // Material / Roll dimensions
  const [rollWidthCm, setRollWidthCm] = useState<number>(100); // 1 meter = 100cm
  const [rollLengthM, setRollLengthM] = useState<number>(1); // default 1 meter
  const [spacingMm, setSpacingMm] = useState<number>(2); // gap between items in mm
  const [edgeMarginMm, setEdgeMarginMm] = useState<number>(10); // roll edges margin in mm

  // Customer target quantity (e.g. client wants 500 pieces)
  const [targetQuantity, setTargetQuantity] = useState<number | ''>(500);

  // Nesting Calculations
  const nestingResult = useMemo(() => {
    const itemW = Math.max(0.5, itemWidthCm);
    const itemH = Math.max(0.5, itemHeightCm);
    const rollW = Math.max(1, rollWidthCm);
    const rollLenCm = Math.max(1, rollLengthM * 100);
    const gapCm = spacingMm / 10;
    const marginCm = edgeMarginMm / 10;

    // Usable width and length
    const usableW = Math.max(0, rollW - marginCm * 2);
    const usableL = Math.max(0, rollLenCm - marginCm * 2);

    // Orientation A: Width along roll width, Height along roll length
    const colsA = Math.floor((usableW + gapCm) / (itemW + gapCm));
    const rowsA = Math.floor((usableL + gapCm) / (itemH + gapCm));
    const totalA = Math.max(0, colsA) * Math.max(0, rowsA);

    // Orientation B: Rotated (Height along roll width, Width along roll length)
    const colsB = Math.floor((usableW + gapCm) / (itemH + gapCm));
    const rowsB = Math.floor((usableL + gapCm) / (itemW + gapCm));
    const totalB = Math.max(0, colsB) * Math.max(0, rowsB);

    // Pick best orientation
    const isRotated = totalB > totalA;
    const bestCols = isRotated ? colsB : colsA;
    const bestRows = isRotated ? rowsB : rowsA;
    const totalInSpecifiedLength = isRotated ? totalB : totalA;

    // How many items per 1 linear meter?
    const rowsPerMeter = Math.floor((100 - marginCm * 2 + gapCm) / ((isRotated ? itemW : itemH) + gapCm));
    const itemsPerMeter = bestCols * Math.max(0, rowsPerMeter);

    // How many items per 0.5 meter (half meter)?
    const rowsPerHalfMeter = Math.floor((50 - marginCm * 2 + gapCm) / ((isRotated ? itemW : itemH) + gapCm));
    const itemsPerHalfMeter = bestCols * Math.max(0, rowsPerHalfMeter);

    // Target quantity requirement: How many linear meters required?
    let requiredMeters = 0;
    let requiredRows = 0;
    let requiredSheets = 0;
    if (targetQuantity && Number(targetQuantity) > 0) {
      if (bestCols > 0) {
        requiredRows = Math.ceil(Number(targetQuantity) / bestCols);
        const effectiveLengthCm = requiredRows * (isRotated ? itemW : itemH) + (requiredRows - 1) * gapCm + marginCm * 2;
        requiredMeters = Math.max(0.1, Number((effectiveLengthCm / 100).toFixed(2)));
      }
      if (totalInSpecifiedLength > 0) {
        requiredSheets = Math.ceil(Number(targetQuantity) / totalInSpecifiedLength);
      }
    }

    // Material efficiency & waste
    const itemArea = itemW * itemH;
    const totalItemArea = totalInSpecifiedLength * itemArea;
    const totalMaterialArea = rollW * rollLenCm;
    const wastePercent = totalMaterialArea > 0 ? Math.max(0, ((totalMaterialArea - totalItemArea) / totalMaterialArea) * 100) : 0;

    return {
      bestCols,
      bestRows,
      totalInSpecifiedLength,
      itemsPerMeter,
      itemsPerHalfMeter,
      requiredMeters,
      requiredRows,
      requiredSheets,
      wastePercent: Math.min(99, Number(wastePercent.toFixed(1))),
      isRotated,
    };
  }, [itemWidthCm, itemHeightCm, rollWidthCm, rollLengthM, spacingMm, edgeMarginMm, targetQuantity]);

  // ==========================================
  // TAB 2: AREA & PRICE CALCULATOR STATE
  // ==========================================
  const priceListItems: PriceListItem[] = useMemo(() => {
    return agencySettings.priceList && agencySettings.priceList.length > 0
      ? agencySettings.priceList
      : INITIAL_PRICE_LIST;
  }, [agencySettings.priceList]);

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(priceListItems[0]?.id || 'pr-1');
  const [calcWidthCm, setCalcWidthCm] = useState<number>(100); // 100cm
  const [calcHeightCm, setCalcHeightCm] = useState<number>(100); // 100cm
  const [calcQuantity, setCalcQuantity] = useState<number>(1);
  const [customPricePerM2, setCustomPricePerM2] = useState<number | ''>('');
  // Finishing options state (now writable and customizable)
  const [includeLamination, setIncludeLamination] = useState<boolean>(false);
  const [laminationName, setLaminationName] = useState<string>('سلوفان حماية');
  const [laminationPriceM2, setLaminationPriceM2] = useState<number>(20);

  const [includeEyelets, setIncludeEyelets] = useState<boolean>(false);
  const [eyeletsName, setEyeletsName] = useState<string>('ثني وتخريم حلقات');
  const [eyeletsPricePiece, setEyeletsPricePiece] = useState<number>(15);

  const [includeFoamBoard, setIncludeFoamBoard] = useState<boolean>(false);
  const [foamBoardName, setFoamBoardName] = useState<string>('تثبيت على لوح فوم');
  const [foamBoardPriceM2, setFoamBoardPriceM2] = useState<number>(45);

  const [includeInstallation, setIncludeInstallation] = useState<boolean>(false);
  const [installationName, setInstallationName] = useState<string>('خدمة التركيب');
  const [installationPriceM2, setInstallationPriceM2] = useState<number>(30);

  // Custom user-defined addition (مخصص مبلغ ثابت يضرب على الكمية افتراضياً)
  const [includeCustomAddition, setIncludeCustomAddition] = useState<boolean>(false);
  const [customAdditionName, setCustomAdditionName] = useState<string>('إضافة مخصصة / قص وخدمات');
  const [customAdditionCost, setCustomAdditionCost] = useState<number>(0);
  const [customAdditionPerUnit, setCustomAdditionPerUnit] = useState<boolean>(true); // تضرب على الكمية افتراضياً

  const [includeTax, setIncludeTax] = useState<boolean>(true);
  const [copiedPrice, setCopiedPrice] = useState<boolean>(false);

  const selectedMaterial = useMemo(() => {
    return priceListItems.find((p) => p.id === selectedMaterialId) || priceListItems[0];
  }, [priceListItems, selectedMaterialId]);

  // Area calculation
  const areaCalcResult = useMemo(() => {
    const wM = calcWidthCm / 100;
    const hM = calcHeightCm / 100;
    const singleAreaM2 = wM * hM;
    const totalAreaM2 = singleAreaM2 * calcQuantity;

    const basePricePerM2 =
      customPricePerM2 !== '' && !isNaN(Number(customPricePerM2))
        ? Number(customPricePerM2)
        : selectedMaterial?.sellingPrice || 35;

    let baseCost = totalAreaM2 * basePricePerM2;

    // Add finishing options with dynamic writable prices
    let finishingCost = 0;
    if (includeLamination) finishingCost += totalAreaM2 * (Number(laminationPriceM2) || 0);
    if (includeEyelets) finishingCost += calcQuantity * (Number(eyeletsPricePiece) || 0);
    if (includeFoamBoard) finishingCost += totalAreaM2 * (Number(foamBoardPriceM2) || 0);
    if (includeInstallation) finishingCost += Math.max(30, totalAreaM2 * (Number(installationPriceM2) || 0));
    if (includeCustomAddition) {
      const fixedAmt = Number(customAdditionCost) || 0;
      // إذا كان الخيار تضرب على الكمية: تضرب في calcQuantity
      finishingCost += customAdditionPerUnit ? fixedAmt * calcQuantity : fixedAmt;
    }

    const subtotal = baseCost + finishingCost;
    const tax = includeTax ? subtotal * 0.15 : 0;
    const finalTotal = subtotal + tax;

    // Approximate cost & margin
    const approxCostPerM2 = selectedMaterial?.costPrice || 15;
    const totalCost = totalAreaM2 * approxCostPerM2;
    const expectedProfit = subtotal - totalCost;

    return {
      singleAreaM2: Number(singleAreaM2.toFixed(3)),
      totalAreaM2: Number(totalAreaM2.toFixed(2)),
      baseCost: Number(baseCost.toFixed(2)),
      finishingCost: Number(finishingCost.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
      expectedProfit: Number(expectedProfit.toFixed(2)),
    };
  }, [
    calcWidthCm,
    calcHeightCm,
    calcQuantity,
    customPricePerM2,
    selectedMaterial,
    includeLamination,
    laminationPriceM2,
    includeEyelets,
    eyeletsPricePiece,
    includeFoamBoard,
    foamBoardPriceM2,
    includeInstallation,
    installationPriceM2,
    includeCustomAddition,
    customAdditionCost,
    customAdditionPerUnit,
    includeTax,
  ]);

  // ==========================================
  // TAB 3: PRICE CATALOG / LIST STATE
  // ==========================================
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('ALL');
  const [isEditingCatalogModal, setIsEditingCatalogModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);

  // Form for price item
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('خامات عريضة');
  const [formUnit, setFormUnit] = useState('متر مربع');
  const [formSellingPrice, setFormSellingPrice] = useState<number | ''>(35);
  const [formCostPrice, setFormCostPrice] = useState<number | ''>(15);
  const [formNotes, setFormNotes] = useState('');

  const filteredCatalog = useMemo(() => {
    return priceListItems.filter((item) => {
      const matchCat = catalogCategory === 'ALL' || item.category === catalogCategory;
      const s = catalogSearch.toLowerCase().trim();
      const matchSearch =
        !s ||
        item.materialName.toLowerCase().includes(s) ||
        (item.notes && item.notes.toLowerCase().includes(s));
      return matchCat && matchSearch;
    });
  }, [priceListItems, catalogCategory, catalogSearch]);

  const handleOpenAddCatalogItem = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('خامات عريضة');
    setFormUnit('متر مربع');
    setFormSellingPrice(35);
    setFormCostPrice(15);
    setFormNotes('');
    setIsEditingCatalogModal(true);
  };

  const handleOpenEditCatalogItem = (item: PriceListItem) => {
    setEditingItem(item);
    setFormName(item.materialName);
    setFormCategory(item.category);
    setFormUnit(item.unit);
    setFormSellingPrice(item.sellingPrice);
    setFormCostPrice(item.costPrice);
    setFormNotes(item.notes || '');
    setIsEditingCatalogModal(true);
  };

  const handleSaveCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newItem: PriceListItem = {
      id: editingItem ? editingItem.id : `pr-${Date.now()}`,
      materialName: formName.trim(),
      category: formCategory,
      unit: formUnit,
      sellingPrice: Number(formSellingPrice) || 0,
      costPrice: Number(formCostPrice) || 0,
      notes: formNotes.trim() || undefined,
    };

    let updatedList: PriceListItem[];
    if (editingItem) {
      updatedList = priceListItems.map((p) => (p.id === editingItem.id ? newItem : p));
    } else {
      updatedList = [newItem, ...priceListItems];
    }

    const newSettings = {
      ...agencySettings,
      priceList: updatedList,
    };
    onUpdateAgencySettings(newSettings);
    setIsEditingCatalogModal(false);
  };

  const handleDeleteCatalogItem = (id: string) => {
    if (!confirm('هل تريد حذف هذه الخامة من قائمة الأسعار؟')) return;
    const updatedList = priceListItems.filter((p) => p.id !== id);
    onUpdateAgencySettings({
      ...agencySettings,
      priceList: updatedList,
    });
  };

  const copyPriceSummary = () => {
    const text = `تسعيرة: ${selectedMaterial?.materialName}
المقاس: ${calcWidthCm} سم × ${calcHeightCm} سم
الكمية: ${calcQuantity}
إجمالي المساحة: ${areaCalcResult.totalAreaM2} م²
الإجمالي شامل الضريبة: ${areaCalcResult.finalTotal} ر.س`;
    navigator.clipboard.writeText(text);
    setCopiedPrice(true);
    setTimeout(() => setCopiedPrice(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Viewer Mode Notice */}
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-xs">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t.viewerReadOnlyNotice}</span>
        </div>
      )}

      {/* View Header with Sub-tab Switchers */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <span>{t.pricingTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentLang === 'en'
              ? 'Nesting calculator, area & linear meter pricing, and agency price catalog'
              : 'حاسبة توزيع الاستيكر والقطع في المتر ونصف المتر، تسعيرة المساحات، وقائمة أسعار الوكالة'}
          </p>
        </div>

        {/* Sub-tab Switcher Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('nesting')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeSubTab === 'nesting'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>{t.tabNesting}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('area_calculator')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeSubTab === 'area_calculator'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>{t.tabAreaCalc}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('price_list')}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeSubTab === 'price_list'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{t.tabPriceCatalog}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUB-TAB 1: NESTING / QUANTITY CALCULATOR                  */}
      {/* ========================================================= */}
      {activeSubTab === 'nesting' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Controls Form (5 cols) */}
          <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-emerald-600" />
                {isEn ? 'Piece & Material Dimensions' : 'بيانات مقاس القطعة والخامة'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Nesting Engine</span>
            </div>

            {/* Item Dimensions */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700">
                {isEn ? '1. Single Piece Dimensions (Sticker/Card/Board) in cm:' : '1. مقاس القطعة الواحدة (استيكر / كرت / لوحة) بالسنتيمتر (سم):'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">{isEn ? 'Width (cm):' : 'العرض (سم):'}</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={itemWidthCm}
                    onChange={(e) => setItemWidthCm(Math.max(0.5, Number(e.target.value) || 0))}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">{isEn ? 'Height (cm):' : 'الارتفاع (سم):'}</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={itemHeightCm}
                    onChange={(e) => setItemHeightCm(Math.max(0.5, Number(e.target.value) || 0))}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              {/* Quick presets for common items */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                <span className="text-[10px] text-slate-400">{isEn ? 'Presets:' : 'شائع:'}</span>
                {[
                  { label: isEn ? '5×5 cm' : '5×5 سم', w: 5, h: 5 },
                  { label: isEn ? '7×7 cm' : '7×7 سم', w: 7, h: 7 },
                  { label: isEn ? '10×10 cm' : '10×10 سم', w: 10, h: 10 },
                  { label: isEn ? '9×5 Card' : '9×5 كرت', w: 9, h: 5 },
                  { label: 'A4', w: 21, h: 29.7 },
                  { label: 'A3', w: 30, h: 42 },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setItemWidthCm(p.w);
                      setItemHeightCm(p.h);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition cursor-pointer shrink-0 font-medium"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Roll / Material Width */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700">
                {isEn ? '2. Roll or Sheet Width (cm):' : '2. عرض رول أو لوح الخامة (سم):'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={rollWidthCm}
                  onChange={(e) => setRollWidthCm(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-slate-500 font-bold shrink-0">{isEn ? 'cm' : 'سم'}</span>
              </div>
              {/* Presets: Rolls, Boards & Paper Sheets (A4, A3, etc.) */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-500 block">قياسات الأوراق والقص:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: 'ورقة A4 (21×29.7 سم)', w: 21, l: 0.297 },
                    { label: 'ورقة A3 (29.7×42 سم)', w: 29.7, l: 0.42 },
                    { label: 'ورقة A3+ (33×48.3 سم)', w: 33, l: 0.483 },
                    { label: 'فرخ 70×100 سم', w: 70, l: 1.0 },
                  ].map((p, idx) => (
                    <button
                      key={`sheet-${idx}`}
                      type="button"
                      onClick={() => {
                        setRollWidthCm(p.w);
                        setRollLengthM(p.l);
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer border ${
                        rollWidthCm === p.w && rollLengthM === p.l
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                          : 'bg-indigo-50/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <span className="text-[10px] font-bold text-slate-500 block pt-1">قياسات الرولات والألواح:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: 'رول 100 سم (1م)', w: 100, l: 1 },
                    { label: 'رول 120 سم', w: 120, l: 1 },
                    { label: 'رول 150 سم', w: 150, l: 1 },
                    { label: 'رول 160 سم', w: 160, l: 1 },
                    { label: 'لوح 122 سم', w: 122, l: 2.44 },
                  ].map((r, idx) => (
                    <button
                      key={`roll-${idx}`}
                      type="button"
                      onClick={() => {
                        setRollWidthCm(r.w);
                        setRollLengthM(r.l);
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer border ${
                        rollWidthCm === r.w
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Length & Gaps */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-700 block mb-0.5">
                  طول التنفيذ للمعاينة (بالمتر):
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={rollLengthM}
                  onChange={(e) => setRollLengthM(Math.max(0.1, Number(e.target.value) || 0))}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-semibold"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-700 block mb-0.5">
                  فاصل القص بين القطع (ملم):
                </span>
                <input
                  type="number"
                  min="0"
                  value={spacingMm}
                  onChange={(e) => setSpacingMm(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-semibold"
                />
              </div>
            </div>

            {/* Target Quantity Needed */}
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-1.5">
              <label className="block text-[11px] font-extrabold text-emerald-950">
                3. كم عدد القطع المطلوب من العميل؟
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={targetQuantity}
                  onChange={(e) =>
                    setTargetQuantity(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))
                  }
                  placeholder="مثال: 500 حبة"
                  className="w-full p-2 text-xs rounded-lg border border-emerald-300 bg-white font-extrabold text-emerald-950 focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-emerald-900 font-bold shrink-0">حبة</span>
              </div>
              <p className="text-[10px] text-emerald-700">
                سوف نحسب لك تلقائياً كم متر تحتاج من الرول لتنفيذ هذا العدد بالكامل!
              </p>
            </div>
          </div>

          {/* Results & Visual Grid (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* In 1 Meter */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">في المتر الواحد (1م)</span>
                <div className="text-base sm:text-lg font-black text-emerald-700">
                  {nestingResult.itemsPerMeter} <span className="text-[10px] font-normal text-slate-500">حبة</span>
                </div>
              </div>

              {/* In Half Meter */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">في نصف المتر (50سم)</span>
                <div className="text-base sm:text-lg font-black text-indigo-700">
                  {nestingResult.itemsPerHalfMeter} <span className="text-[10px] font-normal text-slate-500">حبة</span>
                </div>
              </div>

              {/* In Current Length */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">
                  في {rollLengthM} متر
                </span>
                <div className="text-base sm:text-lg font-black text-slate-900">
                  {nestingResult.totalInSpecifiedLength} <span className="text-[10px] font-normal text-slate-500">حبة</span>
                </div>
              </div>

              {/* Waste % */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-center">
                <span className="text-[10px] text-slate-500 font-bold block mb-1">نسبة الهدر المتوقعة</span>
                <div className="text-base sm:text-lg font-black text-amber-600">
                  {nestingResult.wastePercent}%
                </div>
              </div>
            </div>

            {/* Target Quantity Result Banner */}
            {targetQuantity && Number(targetQuantity) > 0 && (
              <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white p-4 rounded-xl shadow-md border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <div className="text-emerald-300 font-extrabold text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>النتيجة لتنفيذ طلب العميل ({targetQuantity} حبة):</span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">
                    تحتاج إلى <strong>{nestingResult.requiredMeters} متر طولي</strong> من خامة عرض {rollWidthCm} سم (موزعة على {nestingResult.bestCols} حبة بالصف × {nestingResult.requiredRows} صف).
                  </p>
                </div>
                <div className="bg-emerald-500/20 px-3.5 py-2 rounded-lg border border-emerald-400/40 text-center shrink-0">
                  <span className="text-[10px] text-emerald-200 block">الأمتار المطلوبة</span>
                  <span className="text-lg font-black text-white font-mono">{nestingResult.requiredMeters} م</span>
                </div>
              </div>
            )}

            {/* Visual Nesting Layout Preview */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Grid className="w-4 h-4 text-emerald-600" />
                  المعاينة البصرية لشبكة التوزيع على الرول ({rollWidthCm} سم عرض × {rollLengthM} م طول)
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                  {nestingResult.bestCols} بالعرض × {nestingResult.bestRows} بالطول
                </span>
              </div>

              {/* Visual Container representing the roll */}
              <div className="bg-slate-900 p-3 rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center min-h-[220px]">
                <div className="text-[10px] text-slate-400 mb-2 font-mono">
                  عرض الرول المتاح: {rollWidthCm} سم {nestingResult.isRotated && '(تم تدوير الاتجاه تلقائياً لأعلى عدد)'}
                </div>

                <div
                  className="bg-slate-800 border-2 border-dashed border-emerald-500/60 rounded-lg p-2 max-w-full overflow-auto flex flex-wrap gap-1 justify-center items-center"
                  style={{
                    maxHeight: '260px',
                  }}
                >
                  {Array.from({ length: Math.min(80, nestingResult.totalInSpecifiedLength) }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-emerald-500/80 hover:bg-emerald-400 text-slate-950 font-bold rounded flex items-center justify-center text-[8px] transition cursor-default shadow-xs"
                      style={{
                        width: `${Math.min(45, Math.max(16, itemWidthCm * 4))}px`,
                        height: `${Math.min(45, Math.max(16, itemHeightCm * 4))}px`,
                      }}
                      title={`قطعة #${i + 1} (${itemWidthCm}×${itemHeightCm} سم)`}
                    >
                      {i + 1}
                    </div>
                  ))}
                  {nestingResult.totalInSpecifiedLength > 80 && (
                    <div className="text-[10px] text-emerald-300 font-bold p-1">
                      + و {nestingResult.totalInSpecifiedLength - 80} قطعة إضافية في هذا الطول
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 mt-2 text-center">
                  كل صف يحتوي على <strong>{nestingResult.bestCols} قطعة</strong> | إجمالي الصفوف: <strong>{nestingResult.bestRows} صف</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 2: AREA & PRICE CALCULATOR                        */}
      {/* ========================================================= */}
      {activeSubTab === 'area_calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Inputs (6 cols) */}
          <div className="lg:col-span-6 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                بيانات المقاس والخامة للتسعير
              </span>
            </div>

            {/* Select Material */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                نوع الخامة أو الخدمة:
              </label>
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500"
              >
                {priceListItems.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.materialName} ({p.sellingPrice} ر.س / {p.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">العرض (سم):</label>
                <input
                  type="number"
                  min="1"
                  value={calcWidthCm}
                  onChange={(e) => setCalcWidthCm(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الارتفاع (سم):</label>
                <input
                  type="number"
                  min="1"
                  value={calcHeightCm}
                  onChange={(e) => setCalcHeightCm(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Quantity & Custom Price */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الكمية (عدد اللوحات/القطع):</label>
                <input
                  type="number"
                  min="1"
                  value={calcQuantity}
                  onChange={(e) => setCalcQuantity(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  سعر المتر المخصص (اختياري):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={customPricePerM2}
                  onChange={(e) =>
                    setCustomPricePerM2(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder={`تلقائي (${selectedMaterial?.sellingPrice} ر.س)`}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-mono"
                />
              </div>
            </div>

            {/* Finishing Options - Fully Writable & Customizable */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">خيارات التشطيب والإضافات (قابلة للتعديل والكتابة):</label>
                <span className="text-[10px] text-slate-400">يمكنك تعديل الاسم والسعر يدوياً</span>
              </div>

              <div className="space-y-2 text-xs">
                {/* 1. Lamination */}
                <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeLamination}
                    onChange={(e) => setIncludeLamination(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={laminationName}
                    onChange={(e) => setLaminationName(e.target.value)}
                    placeholder="اسم التشطيب"
                    className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-slate-500">+</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={laminationPriceM2}
                      onChange={(e) => setLaminationPriceM2(Number(e.target.value) || 0)}
                      className="w-14 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-[10px] text-slate-500">ر.س/م²</span>
                  </div>
                </div>

                {/* 2. Eyelets */}
                <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeEyelets}
                    onChange={(e) => setIncludeEyelets(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={eyeletsName}
                    onChange={(e) => setEyeletsName(e.target.value)}
                    placeholder="اسم الإضافة"
                    className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-slate-500">+</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={eyeletsPricePiece}
                      onChange={(e) => setEyeletsPricePiece(Number(e.target.value) || 0)}
                      className="w-14 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-[10px] text-slate-500">ر.س/حبة</span>
                  </div>
                </div>

                {/* 3. Foam Board */}
                <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeFoamBoard}
                    onChange={(e) => setIncludeFoamBoard(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={foamBoardName}
                    onChange={(e) => setFoamBoardName(e.target.value)}
                    placeholder="اسم الخامة الإضافية"
                    className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-slate-500">+</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={foamBoardPriceM2}
                      onChange={(e) => setFoamBoardPriceM2(Number(e.target.value) || 0)}
                      className="w-14 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-[10px] text-slate-500">ر.س/م²</span>
                  </div>
                </div>

                {/* 4. Installation */}
                <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeInstallation}
                    onChange={(e) => setIncludeInstallation(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={installationName}
                    onChange={(e) => setInstallationName(e.target.value)}
                    placeholder="خدمة التركيب"
                    className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-slate-500">+</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={installationPriceM2}
                      onChange={(e) => setInstallationPriceM2(Number(e.target.value) || 0)}
                      className="w-14 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-[10px] text-slate-500">ر.س/م²</span>
                  </div>
                </div>

                {/* 5. Custom Addition (مخصص مبلغ ثابت يضرب على الكمية افتراضياً) */}
                <div className="p-2.5 rounded-lg border border-dashed border-emerald-400 bg-emerald-50/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeCustomAddition}
                      onChange={(e) => setIncludeCustomAddition(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={customAdditionName}
                      onChange={(e) => setCustomAdditionName(e.target.value)}
                      placeholder="اسم الإضافة (قص ورق A4، تكسير، طي، سلفنة، شحن...)"
                      className="flex-1 bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-semibold text-emerald-950"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-slate-500">+</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={customAdditionCost}
                        onChange={(e) => setCustomAdditionCost(Number(e.target.value) || 0)}
                        className="w-16 bg-white border border-emerald-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-center text-emerald-900"
                      />
                      <span className="text-[10px] text-emerald-800 font-bold">ر.س</span>
                    </div>
                  </div>

                  {includeCustomAddition && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-emerald-200/70 text-[11px] flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-900 font-medium">طريقة الاحتساب:</span>
                        <button
                          type="button"
                          onClick={() => setCustomAdditionPerUnit(true)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                            customAdditionPerUnit
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          ضرب في الكمية ({calcQuantity} حبة/ورقة)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomAdditionPerUnit(false)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                            !customAdditionPerUnit
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                          }`}
                        >
                          مبلغ مقطوع إجمالي
                        </button>
                      </div>

                      <div className="font-bold text-emerald-950 font-mono">
                        الإجمالي: {(customAdditionPerUnit ? customAdditionCost * calcQuantity : customAdditionCost).toFixed(2)} ر.س
                        {customAdditionPerUnit && calcQuantity > 1 && (
                          <span className="text-[10px] text-emerald-700 font-normal mr-1">
                            ({customAdditionCost} × {calcQuantity})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tax Checkbox */}
            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={includeTax}
                  onChange={(e) => setIncludeTax(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>احتساب ضريبة القيمة المضافة (15%)</span>
              </label>
            </div>
          </div>

          {/* Pricing Summary Card (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  تفاصيل السعر والمساحة الإجمالية
                </span>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  {selectedMaterial?.category || 'خامات'}
                </span>
              </div>

              {/* Breakdown */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>مساحة القطعة الواحدة:</span>
                  <span className="font-bold text-slate-800 font-mono">{areaCalcResult.singleAreaM2} م²</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>إجمالي المساحة للكمية ({calcQuantity} قطعة):</span>
                  <span className="font-bold text-slate-800 font-mono">{areaCalcResult.totalAreaM2} م²</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>تكلفة الخامة والطباعة الأساسية:</span>
                  <span className="font-bold text-slate-800 font-mono">{areaCalcResult.baseCost} ر.س</span>
                </div>
                {areaCalcResult.finishingCost > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>تكلفة التشطيب والإضافات:</span>
                    <span className="font-bold text-slate-800 font-mono">+{areaCalcResult.finishingCost} ر.س</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                  <span>المجموع قبل الضريبة:</span>
                  <span className="font-bold text-slate-900 font-mono">{areaCalcResult.subtotal} ر.س</span>
                </div>
                {includeTax && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span className="font-bold text-slate-800 font-mono">+{areaCalcResult.tax} ر.س</span>
                  </div>
                )}
              </div>

              {/* Total Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <span className="text-xs text-emerald-800 font-bold block mb-1">
                  السعر الإجمالي المقترح للعميل {includeTax && '(شامل الضريبة)'}
                </span>
                <div className="text-2xl font-black text-emerald-900 font-mono">
                  {areaCalcResult.finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                  <span className="text-sm font-normal">ر.س</span>
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  صافي الربح المتوقع التقريبي: <strong>{areaCalcResult.expectedProfit} ر.س</strong>
                </div>
              </div>

              {/* Copy Quote Button */}
              <button
                type="button"
                onClick={copyPriceSummary}
                className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                {copiedPrice ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>تم نسخ نص التسعيرة للحافظة!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>نسخ نص التسعيرة لمشاركتها مع العميل (واتساب)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 3: PRICE CATALOG / LIST                           */}
      {/* ========================================================= */}
      {activeSubTab === 'price_list' && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Category Filter */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {['ALL', 'خامات عريضة', 'مطبوعات ورقية', 'ستاندات ومعارض', 'قص وتفريغ', 'قص ليزر وحروف'].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap transition cursor-pointer ${
                      catalogCategory === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'الكل' : cat}
                  </button>
                )
              )}
            </div>

            {/* Search & Add */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="بحث في الخامات والأسعار..."
                  className="pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56"
                />
              </div>

              {userRole !== 'viewer' && (
                <button
                  type="button"
                  onClick={handleOpenAddCatalogItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addPriceItem}</span>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">{t.materialName}</th>
                    <th className="py-2.5 px-3">{currentLang === 'en' ? 'Category' : 'التصنيف'}</th>
                    <th className="py-2.5 px-3">{t.unit}</th>
                    <th className="py-2.5 px-3 text-left">{t.sellingPrice}</th>
                    <th className="py-2.5 px-3 text-left">{t.costPrice}</th>
                    <th className="py-2.5 px-3 text-left">{t.profitMargin}</th>
                    <th className="py-2.5 px-3">{t.notes}</th>
                    <th className="py-2.5 px-3 text-center">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.map((item) => {
                    const margin = item.sellingPrice - item.costPrice;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{item.materialName}</td>
                        <td className="py-2.5 px-3">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{item.unit}</td>
                        <td className="py-2.5 px-3 text-left font-mono font-black text-emerald-700 text-xs">
                          {item.sellingPrice} {t.currency}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono text-slate-500 text-xs">
                          {item.costPrice} {t.currency}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono font-bold text-indigo-700 text-xs">
                          +{margin} {t.currency}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-[200px] truncate">
                          {item.notes || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {userRole === 'viewer' ? (
                            <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded">
                              {currentLang === 'en' ? 'View Only' : 'مشاهدة فقط'}
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditCatalogItem(item)}
                                className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition cursor-pointer"
                                title="تعديل السعر"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCatalogItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Catalog Item Modal */}
      {isEditingCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-md w-full text-slate-900 border border-slate-200 text-xs">
            <h3 className="font-extrabold text-sm text-slate-900 mb-3 pb-2 border-b border-slate-100">
              {editingItem ? 'تعديل خامة / سعر' : 'إضافة خامة جديدة لقائمة الأسعار'}
            </h3>

            <form onSubmit={handleSaveCatalogItem} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الخامة أو الخدمة *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثلاً: بنر عاكس، لوحات نيون LED..."
                  required
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">التصنيف</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="خامات عريضة">خامات عريضة</option>
                    <option value="مطبوعات ورقية">مطبوعات ورقية</option>
                    <option value="ستاندات ومعارض">ستاندات ومعارض</option>
                    <option value="قص وتفريغ">قص وتفريغ</option>
                    <option value="قص ليزر وحروف">قص ليزر وحروف</option>
                    <option value="خدمات أخرى">خدمات أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الوحدة</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="متر مربع">متر مربع</option>
                    <option value="قطعة">قطعة</option>
                    <option value="متر طولي">متر طولي</option>
                    <option value="1000 حبة">1000 حبة</option>
                    <option value="لوح">لوح</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر البيع (ر.س) *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formSellingPrice}
                    onChange={(e) =>
                      setFormSellingPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    required
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر التكلفة (ر.س)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formCostPrice}
                    onChange={(e) =>
                      setFormCostPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات ومواصفات</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="مواصفات الدقة، الاستخدام الداخلي أو الخارجي..."
                  className="w-full p-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingCatalogModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  حفظ في القائمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
