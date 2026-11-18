import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Filter,
  AlertCircle,
  Eye,
  History,
  Flame,
  RefreshCw,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryMovement,
  INVENTORY_ITEMS,
  INVENTORY_SUBTYPES,
  INVENTORY_COLORS,
  INVENTORY_UNITS,
  UserRole,
} from '../types';
import { computeInventoryStatus } from '../lib/dataStore';
import { EditableSelect } from './EditableSelect';
import { getTranslations } from '../lib/translations';
import { canDeleteItem } from '../lib/permissions';

interface InventoryViewProps {
  inventory: InventoryItem[];
  movements?: InventoryMovement[];
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  onAddInventory: (item: InventoryItem) => void;
  onUpdateInventory: (item: InventoryItem) => void;
  onDeleteInventory: (id: string) => void;
  onRecordStockMovement?: (
    inventoryId: string,
    quantityChange: number,
    type: 'wastage_out' | 'adjustment',
    reason: string
  ) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  movements = [],
  userRole = 'owner',
  currentLang = 'ar',
  onAddInventory,
  onUpdateInventory,
  onDeleteInventory,
  onRecordStockMovement,
  isModalOpen,
  setIsModalOpen,
}) => {
  const t = getTranslations(currentLang);
  const isEn = currentLang === 'en';
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'movements'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [movementModalItem, setMovementModalItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<'wastage_out' | 'adjustment'>('wastage_out');
  const [movementQty, setMovementQty] = useState<number>(1);
  const [movementReason, setMovementReason] = useState<string>('تالف أثناء الطباعة أو القص');

  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    item: 'فينيل',
    type: 'لامع',
    color: 'أبيض',
    unit: 'رول',
    currentQty: 10,
    minQty: 5,
    unitCost: 150,
    notes: '',
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      item: '',
      type: '',
      color: '',
      unit: '',
      currentQty: 0,
      minQty: 0,
      unitCost: 0,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  const calculatedStatus = computeInventoryStatus(
    Number(formData.currentQty) || 0,
    Number(formData.minQty) || 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const current = Math.max(0, Number(formData.currentQty) || 0);
    const min = Math.max(0, Number(formData.minQty) || 0);
    const unitCost = Math.max(0, Number(formData.unitCost) || 0);
    const status = computeInventoryStatus(current, min);

    if (editingItem) {
      onUpdateInventory({
        ...editingItem,
        item: formData.item || 'فينيل',
        type: formData.type || 'عادي',
        color: formData.color || 'أبيض',
        unit: formData.unit || 'رول',
        currentQty: current,
        minQty: min,
        unitCost,
        status,
        notes: formData.notes || '',
      });
    } else {
      const newItem: InventoryItem = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        item: formData.item || 'فينيل',
        type: formData.type || 'عادي',
        color: formData.color || 'أبيض',
        unit: formData.unit || 'رول',
        currentQty: current,
        minQty: min,
        unitCost,
        status,
        notes: formData.notes || '',
      };
      onAddInventory(newItem);
    }
    setIsModalOpen(false);
  };

  const handleQuickMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementModalItem || !onRecordStockMovement) return;
    const delta =
      movementType === 'wastage_out'
        ? -Math.abs(Number(movementQty) || 0)
        : Number(movementQty) || 0;
    if (delta === 0) return;
    onRecordStockMovement(
      movementModalItem.id,
      delta,
      movementType,
      movementReason.trim() || (movementType === 'wastage_out' ? 'هالك طباعة وقص' : 'تسوية جردية')
    );
    setMovementModalItem(null);
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      (item.item || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.color || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'ALERT' && item.status.includes('طلب شراء')) ||
      (filterStatus === 'LOW' && item.status.includes('منخفض')) ||
      (filterStatus === 'OK' && item.status.includes('كافي'));

    return matchesSearch && matchesStatus;
  });

  const movementTypeLabel = (type: InventoryMovement['type']) => {
    switch (type) {
      case 'purchase_in':
        return { label: 'توريد مشتريات (+)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'sale_out':
        return { label: 'صرف مبيعات وإنتاج (-)', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'sale_return_in':
        return { label: 'مرتجع مبيعات (+)', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      case 'purchase_return_out':
        return { label: 'مرتجع لمورد (-)', cls: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'wastage_out':
        return { label: 'هالك وتالف (-)', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: 'تسوية جردية', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
  };

  return (
    <div className="space-y-4">
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold shadow-xs">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t.viewerReadOnlyNotice}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubTab('stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'stock'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 أرصدة الخامات ({inventory.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('movements')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'movements'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📜 دفتر حركات المخزون الآلي ({movements.length})
            </button>
          </div>

          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                currentLang === 'en'
                  ? 'Search by item, type, color or notes...'
                  : 'بحث بالصنف، النوع، اللون أو الملاحظات...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentLang === 'en' ? 'Stock Status:' : 'حالة التوفر:'}</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs py-1.5 px-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="ALL">{currentLang === 'en' ? 'All Statuses' : 'جميع الحالات'}</option>
              <option value="ALERT">🛒 {currentLang === 'en' ? 'Reorder Needed' : 'طلب شراء'}</option>
              <option value="LOW">🟡 {currentLang === 'en' ? 'Low Stock' : 'منخفض'}</option>
              <option value="OK">🟢 {currentLang === 'en' ? 'In Stock' : 'كافي'}</option>
            </select>
          </div>

          {userRole !== 'viewer' && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.newInventoryItem}</span>
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'stock' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                {isEn ? '4. Inventory Sheet' : '4. ورقة المخزون المترابطة مع المبيعات والمشتريات والمرتجعات'}
              </span>
              <span className="bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full text-[11px]">
                {filteredInventory.length} {isEn ? 'registered items' : 'صنف مسجل'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              يُحدَّث تلقائياً عند الشراء والبيع والمرتجعات وتسجيل الهالك
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 text-[11px] font-bold select-none">
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">{isEn ? 'A: Item' : 'A: الصنف'}</th>
                  <th className="p-2.5">{isEn ? 'B: Type' : 'B: النوع'}</th>
                  <th className="p-2.5">{isEn ? 'C: Color' : 'C: اللون'}</th>
                  <th className="p-2.5">{isEn ? 'D: Unit' : 'D: الوحدة'}</th>
                  <th className="p-2.5 text-center font-bold">{isEn ? 'E: Current Qty' : 'E: الكمية الحالية'}</th>
                  <th className="p-2.5 text-center font-bold">{isEn ? 'F: Min Qty' : 'F: الحد الأدنى'}</th>
                  <th className="p-2.5 text-center font-bold">تكلفة الوحدة</th>
                  <th className="p-2.5 text-center font-bold bg-amber-50 text-amber-900">
                    {isEn ? 'G: Status' : 'G: الحالة (تلقائي)'}
                  </th>
                  <th className="p-2.5">{isEn ? 'H: Notes' : 'H: ملاحظات'}</th>
                  <th className="p-2.5 text-center sticky left-0 bg-slate-100">{isEn ? 'Actions' : 'إجراءات'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      {isEn ? 'No inventory items match search criteria' : 'لا توجد أصناف في المخزون مطابقة للبحث'}
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{item.item}</td>
                      <td className="p-2.5 text-slate-700 whitespace-nowrap">{item.type}</td>
                      <td className="p-2.5 text-slate-700 whitespace-nowrap">{item.color}</td>
                      <td className="p-2.5 text-slate-600 whitespace-nowrap">{item.unit}</td>
                      <td className="p-2.5 text-center font-extrabold text-slate-900 text-sm font-mono">
                        {item.currentQty}
                      </td>
                      <td className="p-2.5 text-center font-medium text-slate-500 font-mono">{item.minQty}</td>
                      <td className="p-2.5 text-center font-mono text-slate-700">
                        {(item.unitCost || 0).toFixed(2)} ر.س
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            item.status.includes('طلب شراء')
                              ? 'bg-rose-100 text-rose-800'
                              : item.status.includes('منخفض')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-500 max-w-[200px] truncate" title={item.notes}>
                        {item.notes || '—'}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap sticky left-0 bg-white/95 shadow-sm">
                        {userRole === 'viewer' ? (
                          <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded">
                            {currentLang === 'en' ? 'View Only' : 'مشاهدة فقط'}
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {onRecordStockMovement && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMovementModalItem(item);
                                  setMovementType('wastage_out');
                                  setMovementQty(1);
                                  setMovementReason('تالف طباعة أو قص');
                                }}
                                title="تسجيل هالك أو تسوية جردية"
                                className="p-1 rounded text-amber-600 hover:text-amber-800 hover:bg-amber-50 cursor-pointer"
                              >
                                <Flame className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(item)}
                              title="تعديل بيانات الصنف"
                              className="p-1 rounded text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {canDeleteItem(userRole) && (
                              <button
                                onClick={() => setConfirmDeleteId(item.id)}
                                title="حذف"
                                className="p-1 rounded text-slate-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Stock Movements Ledger */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold">
              <History className="w-4 h-4 text-amber-400" />
              <span>سجل حركات المخزون الآلي (توريد مشتريات، صرف مبيعات، مرتجعات، وهالك)</span>
            </div>
            <span className="text-slate-300 font-mono">{movements.length} حركة مسجلة</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="p-3">رقم الحركة</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">نوع الحركة</th>
                  <th className="p-3 text-center">التغير في الكمية</th>
                  <th className="p-3 text-center">الرصيد قبل ← بعد</th>
                  <th className="p-3">المرجع / البيان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 font-semibold">
                      لا توجد حركات مخزون مسجلة بعد. ستظهر الحركات تلقائياً عند الشراء أو البيع أو تسجيل المرتجعات والهالك.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const badge = movementTypeLabel(m.type);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-800">{m.movementNo}</td>
                        <td className="p-3 font-mono text-slate-600">{m.date}</td>
                        <td className="p-3 font-bold text-slate-900">{m.itemName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td
                          className={`p-3 text-center font-mono font-extrabold ${
                            m.quantityChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange} {m.unit}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {m.previousQty} ← <b className="text-slate-900">{m.newQty}</b>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{m.reason}</div>
                          {m.referenceDocNo && (
                            <div className="text-[11px] text-indigo-700 font-mono">مستند: {m.referenceDocNo}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Inventory */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] my-auto">
            <div className="p-4 bg-gradient-to-r from-amber-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">
                  {editingItem ? 'تعديل بيانات الخامة / الصنف' : 'إضافة خامة جديدة للمخزون'}
                </h3>
                <p className="text-xs text-amber-200">
                  حالة التوفر (طلب شراء، منخفض، كافي) تُحسب تلقائياً
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col overscroll-contain">
              <div className="p-5 space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">الصنف (A)</label>
                    <EditableSelect
                      id="inv-item"
                      value={formData.item || ''}
                      onChange={(val) => setFormData({ ...formData, item: val })}
                      options={INVENTORY_ITEMS}
                      storageKey="inventory_items"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">النوع (B)</label>
                    <EditableSelect
                      id="inv-type"
                      value={formData.type || ''}
                      onChange={(val) => setFormData({ ...formData, type: val })}
                      options={INVENTORY_SUBTYPES}
                      storageKey="inventory_subtypes"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">اللون (C)</label>
                    <EditableSelect
                      id="inv-color"
                      value={formData.color || ''}
                      onChange={(val) => setFormData({ ...formData, color: val })}
                      options={INVENTORY_COLORS}
                      storageKey="inventory_colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">الوحدة (D)</label>
                    <EditableSelect
                      id="inv-unit"
                      value={formData.unit || ''}
                      onChange={(val) => setFormData({ ...formData, unit: val })}
                      options={INVENTORY_UNITS}
                      storageKey="inventory_units"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">الكمية الحالية (E)</label>
                    <input
                      required
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={formData.currentQty === 0 ? '' : formData.currentQty}
                      onChange={(e) =>
                        setFormData({ ...formData, currentQty: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">الحد الأدنى (F)</label>
                    <input
                      required
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={formData.minQty === 0 ? '' : formData.minQty}
                      onChange={(e) =>
                        setFormData({ ...formData, minQty: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">تكلفة الوحدة (ر.س)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={formData.unitCost === 0 ? '' : formData.unitCost}
                      onChange={(e) =>
                        setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-600">الحالة المحسوبة تلقائياً (G):</span>
                  <span
                    className={`px-3 py-1 rounded-full font-bold ${
                      calculatedStatus.includes('طلب شراء')
                        ? 'bg-rose-100 text-rose-800'
                        : calculatedStatus.includes('منخفض')
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {calculatedStatus}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات (H)</label>
                  <input
                    type="text"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="الماركة، الشركة المصنعة، مكان التخزين..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment / Wastage Modal */}
      {movementModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                حركة مخزون للصنف: {movementModalItem.item} ({movementModalItem.color})
              </h3>
              <button
                type="button"
                onClick={() => setMovementModalItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleQuickMovementSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الحركة *</label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as any)}
                  className="w-full p-2 rounded-xl border border-slate-300 bg-white font-bold"
                >
                  <option value="wastage_out">🔥 خصم هالك وتالف طباعة وقص (-)</option>
                  <option value="adjustment">⚖️ تسوية جردية (+ للزيادة أو - للنقص)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  الكمية ({movementModalItem.unit}) — الرصيد الحالي: {movementModalItem.currentQty}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={movementQty}
                  onChange={(e) => setMovementQty(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 rounded-xl border border-slate-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب الحركة / البيان *</label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMovementModalItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                >
                  تسجيل وتحديث الرصيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">تأكيد حذف الصنف من المخزون</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من حذف هذا الصنف؟ لن يتم احتسابه في تنبيهات النواقص بعد ذلك.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  onDeleteInventory(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
