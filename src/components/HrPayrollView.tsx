import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Printer,
  Trash2,
  Edit,
  Plus,
  X,
  Check,
  AlertCircle,
  Eye,
  Briefcase,
} from 'lucide-react';
import {
  EmployeeItem,
  AttendanceRecord,
  AttendanceStatus,
  PayrollRun,
  PayrollEmployeeLine,
  AgencySettings,
  UserRole,
} from '../types';
import { getNextSequenceNumber, roundMoney } from '../lib/dataStore';
import { canDeleteItem } from '../lib/permissions';
import { smartPrintDocument } from '../lib/printUtils';

interface HrPayrollViewProps {
  employees: EmployeeItem[];
  attendance: AttendanceRecord[];
  payrolls: PayrollRun[];
  agencySettings: AgencySettings;
  userRole?: UserRole;
  currentLang?: 'ar' | 'en';
  onAddEmployee: (emp: EmployeeItem) => void;
  onUpdateEmployee: (emp: EmployeeItem) => void;
  onDeleteEmployee: (id: string) => void;
  onSaveAttendanceBatch: (records: AttendanceRecord[]) => void;
  onCreateOrUpdatePayroll: (payroll: PayrollRun, approveAndDisburse: boolean) => void;
  onDeletePayroll: (id: string) => void;
}

export const HrPayrollView: React.FC<HrPayrollViewProps> = ({
  employees,
  attendance,
  payrolls,
  agencySettings,
  userRole = 'owner',
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onSaveAttendanceBatch,
  onCreateOrUpdatePayroll,
  onDeletePayroll,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'attendance' | 'payroll'>('employees');
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeItem | null>(null);
  const [confirmDeleteEmpId, setConfirmDeleteEmpId] = useState<string | null>(null);

  // Employee Form State
  const [empForm, setEmpForm] = useState<Partial<EmployeeItem>>({
    name: '',
    jobTitle: 'فني طباعة رقمية',
    department: 'الإنتاج والطباعة',
    phone: '',
    nationalIdOrIqama: '',
    joinDate: new Date().toISOString().split('T')[0],
    salaryType: 'monthly',
    baseSalary: 4000,
    housingAllowance: 400,
    transportAllowance: 300,
    otherAllowance: 0,
    workingDaysPerMonth: 26,
    dailyWorkHours: 8,
    bankName: 'مصرف الراجحي',
    iban: '',
    status: 'نشط',
    notes: '',
  });

  // Attendance State
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dailyAttendanceDraft, setDailyAttendanceDraft] = useState<
    Record<
      string,
      {
        status: AttendanceStatus;
        checkIn: string;
        checkOut: string;
        workedHours: number;
        overtimeHours: number;
        lateMinutes: number;
        notes: string;
      }
    >
  >({});

  // Payroll State
  const [selectedPayrollMonth, setSelectedPayrollMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [payrollPaymentMethod, setPayrollPaymentMethod] = useState<string>('تحويل بنكي');
  const [payrollAdjustments, setPayrollAdjustments] = useState<
    Record<string, { otherDeductions: number; bonuses: number; notes: string }>
  >({});
  const [printPayroll, setPrintPayroll] = useState<PayrollRun | null>(null);
  const printPayrollRef = React.useRef<HTMLDivElement | null>(null);

  // Sync Attendance Draft when date or employees change
  React.useEffect(() => {
    const map: typeof dailyAttendanceDraft = {};
    employees
      .filter((e) => e.status === 'نشط')
      .forEach((emp) => {
        const existing = attendance.find(
          (a) => a.employeeId === emp.id && a.date === selectedAttendanceDate
        );
        map[emp.id] = {
          status: existing?.status || 'present',
          checkIn: existing?.checkIn || '09:00',
          checkOut: existing?.checkOut || '17:00',
          workedHours: existing?.workedHours ?? emp.dailyWorkHours ?? 8,
          overtimeHours: existing?.overtimeHours ?? 0,
          lateMinutes: existing?.lateMinutes ?? 0,
          notes: existing?.notes || '',
        };
      });
    setDailyAttendanceDraft(map);
  }, [selectedAttendanceDate, employees, attendance]);

  const openAddEmpModal = () => {
    setEditingEmp(null);
    setEmpForm({
      name: '',
      jobTitle: 'فني طباعة رقمية',
      department: 'الإنتاج والطباعة',
      phone: '',
      nationalIdOrIqama: '',
      joinDate: new Date().toISOString().split('T')[0],
      salaryType: 'monthly',
      baseSalary: 4000,
      housingAllowance: 400,
      transportAllowance: 300,
      otherAllowance: 0,
      workingDaysPerMonth: 26,
      dailyWorkHours: 8,
      bankName: 'مصرف الراجحي',
      iban: '',
      status: 'نشط',
      notes: '',
    });
    setIsEmpModalOpen(true);
  };

  const openEditEmpModal = (emp: EmployeeItem) => {
    setEditingEmp(emp);
    setEmpForm({ ...emp });
    setIsEmpModalOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name?.trim()) return;

    const code =
      editingEmp?.employeeCode ||
      getNextSequenceNumber(
        'EMP',
        employees.map((x) => x.employeeCode),
        false
      );

    const payload: EmployeeItem = {
      id: editingEmp ? editingEmp.id : `emp-${Date.now()}`,
      employeeCode: code,
      name: empForm.name.trim(),
      jobTitle: (empForm.jobTitle || 'موظف').trim(),
      department: (empForm.department || 'الإنتاج').trim(),
      phone: (empForm.phone || '').trim(),
      nationalIdOrIqama: (empForm.nationalIdOrIqama || '').trim(),
      joinDate: empForm.joinDate || new Date().toISOString().split('T')[0],
      salaryType: empForm.salaryType || 'monthly',
      baseSalary: Math.max(0, Number(empForm.baseSalary) || 0),
      housingAllowance: Math.max(0, Number(empForm.housingAllowance) || 0),
      transportAllowance: Math.max(0, Number(empForm.transportAllowance) || 0),
      otherAllowance: Math.max(0, Number(empForm.otherAllowance) || 0),
      workingDaysPerMonth: Math.max(1, Number(empForm.workingDaysPerMonth) || 26),
      dailyWorkHours: Math.max(1, Number(empForm.dailyWorkHours) || 8),
      bankName: (empForm.bankName || '').trim(),
      iban: (empForm.iban || '').trim(),
      status: empForm.status || 'نشط',
      notes: (empForm.notes || '').trim(),
    };

    if (editingEmp) {
      onUpdateEmployee(payload);
    } else {
      onAddEmployee(payload);
    }
    setIsEmpModalOpen(false);
  };

  const handleSaveDailyAttendance = () => {
    const batch: AttendanceRecord[] = employees
      .filter((e) => e.status === 'نشط')
      .map((emp) => {
        const d = dailyAttendanceDraft[emp.id] || {
          status: 'present',
          checkIn: '09:00',
          checkOut: '17:00',
          workedHours: emp.dailyWorkHours || 8,
          overtimeHours: 0,
          lateMinutes: 0,
          notes: '',
        };
        return {
          id: `att-${emp.id}-${selectedAttendanceDate}`,
          employeeId: emp.id,
          employeeName: emp.name,
          date: selectedAttendanceDate,
          status: d.status,
          checkIn: d.checkIn,
          checkOut: d.checkOut,
          workedHours: d.status === 'absent' ? 0 : Number(d.workedHours) || 0,
          overtimeHours: d.status === 'absent' ? 0 : Number(d.overtimeHours) || 0,
          lateMinutes: d.status === 'absent' ? 0 : Number(d.lateMinutes) || 0,
          notes: d.notes,
        };
      });

    onSaveAttendanceBatch(batch);
  };

  // Calculate live payroll lines for selected month
  const computedPayrollLines: PayrollEmployeeLine[] = useMemo(() => {
    const activeEmps = employees.filter((e) => e.status === 'نشط');
    const monthAttendance = attendance.filter((a) => a.date.startsWith(selectedPayrollMonth));

    return activeEmps.map((emp) => {
      const empRecords = monthAttendance.filter((a) => a.employeeId === emp.id);
      const presentDays = empRecords.filter(
        (a) => a.status === 'present' || a.status === 'late'
      ).length;
      const absentDays = empRecords.filter((a) => a.status === 'absent').length;
      const lateMinutes = empRecords.reduce((s, a) => s + (Number(a.lateMinutes) || 0), 0);
      const overtimeHours = empRecords.reduce((s, a) => s + (Number(a.overtimeHours) || 0), 0);

      const totalAllowances = roundMoney(
        (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.otherAllowance || 0)
      );
      const grossMonthly = roundMoney(emp.baseSalary + totalAllowances);
      const workDays = Math.max(1, emp.workingDaysPerMonth || 26);
      const dailyHours = Math.max(1, emp.dailyWorkHours || 8);

      const dailyRate =
        emp.salaryType === 'daily' ? emp.baseSalary : roundMoney(grossMonthly / workDays);
      const hourlyRate = roundMoney(dailyRate / dailyHours);

      // خصم الغياب + دقائق التأخير تلقائياً
      const absenceDed = roundMoney(absentDays * dailyRate);
      const lateDed = roundMoney((lateMinutes / 60) * hourlyRate);
      const absenceDeduction = roundMoney(absenceDed + lateDed);

      // أجر الساعات الإضافية (1.5x)
      const overtimePay = roundMoney(overtimeHours * hourlyRate * 1.5);

      const adj = payrollAdjustments[emp.id] || { otherDeductions: 0, bonuses: 0, notes: '' };
      const otherDeductions = Math.max(0, Number(adj.otherDeductions) || 0);
      const bonuses = Math.max(0, Number(adj.bonuses) || 0);

      const baseEarned =
        emp.salaryType === 'daily'
          ? roundMoney(Math.max(1, presentDays) * emp.baseSalary + totalAllowances)
          : grossMonthly;

      const netSalary = Math.max(
        0,
        roundMoney(baseEarned - absenceDeduction - otherDeductions + overtimePay + bonuses)
      );

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: emp.name,
        jobTitle: emp.jobTitle,
        baseSalary: emp.baseSalary,
        totalAllowances,
        presentDays,
        absentDays,
        lateMinutes,
        overtimeHours,
        absenceDeduction,
        otherDeductions,
        overtimePay,
        bonuses,
        netSalary,
        notes: adj.notes,
      };
    });
  }, [employees, attendance, selectedPayrollMonth, payrollAdjustments]);

  const existingMonthPayroll = useMemo(() => {
    return payrolls.find((p) => p.month === selectedPayrollMonth);
  }, [payrolls, selectedPayrollMonth]);

  const handleGeneratePayroll = (approveAndDisburse: boolean) => {
    if (computedPayrollLines.length === 0) return;

    const totalBaseAndAllowances = roundMoney(
      computedPayrollLines.reduce((s, l) => s + l.baseSalary + l.totalAllowances, 0)
    );
    const totalDeductions = roundMoney(
      computedPayrollLines.reduce((s, l) => s + l.absenceDeduction + l.otherDeductions, 0)
    );
    const totalOvertimeAndBonuses = roundMoney(
      computedPayrollLines.reduce((s, l) => s + l.overtimePay + l.bonuses, 0)
    );
    const totalNetPayroll = roundMoney(
      computedPayrollLines.reduce((s, l) => s + l.netSalary, 0)
    );

    const payrollRun: PayrollRun = {
      id: existingMonthPayroll?.id || `payroll-${selectedPayrollMonth}-${Date.now()}`,
      payrollNo: existingMonthPayroll?.payrollNo || `PAY-${selectedPayrollMonth}`,
      month: selectedPayrollMonth,
      issueDate: new Date().toISOString().split('T')[0],
      status: approveAndDisburse ? 'approved_paid' : 'draft',
      paymentMethod: payrollPaymentMethod,
      lines: computedPayrollLines,
      totalBaseAndAllowances,
      totalDeductions,
      totalOvertimeAndBonuses,
      totalNetPayroll,
      approvedAt: approveAndDisburse ? new Date().toISOString() : existingMonthPayroll?.approvedAt,
    };

    onCreateOrUpdatePayroll(payrollRun, approveAndDisburse);
  };

  const totalMonthlyPayrollCommitment = employees
    .filter((e) => e.status === 'نشط')
    .reduce(
      (s, e) => s + e.baseSalary + e.housingAllowance + e.transportAllowance + e.otherAllowance,
      0
    );

  return (
    <div className="space-y-4">
      {userRole === 'viewer' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-bold">
          <Eye className="w-4 h-4 text-amber-600 shrink-0" />
          <span>وضع المشاهد: استعراض فقط</span>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي الكادر الوظيفي النشط</p>
            <p className="text-lg font-extrabold text-slate-900 mt-1">
              {employees.filter((e) => e.status === 'نشط').length} موظف وفني
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">مصممين، فنيي طباعة، وفريق تركيب</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">كتلة الرواتب والبدلات التعاقدية الشهرية</p>
            <p className="text-lg font-extrabold text-indigo-700 mt-1 font-mono">
              {totalMonthlyPayrollCommitment.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">قبل خصومات الغياب أو مكافآت الإضافي</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">مسيرات الرواتب المعتمدة والمنصرفة</p>
            <p className="text-lg font-extrabold text-emerald-700 mt-1">
              {payrolls.filter((p) => p.status === 'approved_paid').length} مسير معتمد
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">مرتبطة تلقائياً بالمصروفات وسندات الصرف</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('employees')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'employees'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👥 سجل الموظفين والفنيين ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('attendance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'attendance'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🕒 الحضور والانصراف والساعات الإضافية
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('payroll')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'payroll'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💳 مسيرات الرواتب الشهرية ({payrolls.length})
          </button>
        </div>

        {activeSubTab === 'employees' && userRole !== 'viewer' && (
          <button
            type="button"
            onClick={openAddEmpModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ إضافة موظف / فني جديد</span>
          </button>
        )}
      </div>

      {/* SUB-TAB 1: EMPLOYEES */}
      {activeSubTab === 'employees' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-3">الكود</th>
                  <th className="p-3">اسم الموظف</th>
                  <th className="p-3">المسمى والقسم</th>
                  <th className="p-3">الجوال / الهوية</th>
                  <th className="p-3">الراتب الأساسي</th>
                  <th className="p-3">البدلات (سكن/نقل)</th>
                  <th className="p-3">الإجمالي الشهري</th>
                  <th className="p-3">الحساب البنكي (IBAN)</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees.map((emp) => {
                  const totalAllow =
                    (emp.housingAllowance || 0) +
                    (emp.transportAllowance || 0) +
                    (emp.otherAllowance || 0);
                  const totalGross = emp.baseSalary + totalAllow;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-700">{emp.employeeCode}</td>
                      <td className="p-3 font-extrabold text-slate-900">{emp.name}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{emp.jobTitle}</div>
                        <div className="text-[11px] text-slate-500">{emp.department}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        <div>{emp.phone}</div>
                        {emp.nationalIdOrIqama && (
                          <div className="text-[10px] text-slate-400">هوية: {emp.nationalIdOrIqama}</div>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {emp.baseSalary.toLocaleString()} ر.س
                      </td>
                      <td className="p-3 font-mono text-slate-600">{totalAllow.toLocaleString()} ر.س</td>
                      <td className="p-3 font-mono font-extrabold text-emerald-700">
                        {totalGross.toLocaleString()} ر.س
                      </td>
                      <td className="p-3 text-[11px]">
                        <div className="font-bold text-slate-700">{emp.bankName || '—'}</div>
                        <div className="font-mono text-slate-400">{emp.iban || ''}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            emp.status === 'نشط'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {userRole !== 'viewer' && (
                          <button
                            type="button"
                            onClick={() => openEditEmpModal(emp)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 ml-1 cursor-pointer"
                            title="تعديل"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteItem(userRole) &&
                          (confirmDeleteEmpId === emp.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteEmployee(emp.id);
                                setConfirmDeleteEmpId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              تأكيد
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteEmpId(emp.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ATTENDANCE */}
      {activeSubTab === 'attendance' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-cyan-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">دفتر الحضور والانصراف اليومي</h3>
                <p className="text-xs text-slate-500">
                  تؤثر أيام الغياب ودقائق التأخير والساعات الإضافية تلقائياً في مسير رواتب الشهر
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">تاريخ اليوم:</label>
              <input
                type="date"
                value={selectedAttendanceDate}
                onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-mono font-bold"
              />
              {userRole !== 'viewer' && (
                <button
                  type="button"
                  onClick={handleSaveDailyAttendance}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ سجل حضور هذا اليوم</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2.5">الموظف</th>
                  <th className="p-2.5">المسمى</th>
                  <th className="p-2.5">حالة الحضور</th>
                  <th className="p-2.5 text-center">وقت الحضور</th>
                  <th className="p-2.5 text-center">وقت الانصراف</th>
                  <th className="p-2.5 text-center">دقائق التأخير</th>
                  <th className="p-2.5 text-center">ساعات إضافية (Overtime)</th>
                  <th className="p-2.5">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees
                  .filter((e) => e.status === 'نشط')
                  .map((emp) => {
                    const row = dailyAttendanceDraft[emp.id] || {
                      status: 'present',
                      checkIn: '09:00',
                      checkOut: '17:00',
                      workedHours: 8,
                      overtimeHours: 0,
                      lateMinutes: 0,
                      notes: '',
                    };
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-extrabold text-slate-900">{emp.name}</td>
                        <td className="p-2.5 text-slate-600">{emp.jobTitle}</td>
                        <td className="p-2.5">
                          <select
                            value={row.status}
                            onChange={(e) =>
                              setDailyAttendanceDraft({
                                ...dailyAttendanceDraft,
                                [emp.id]: { ...row, status: e.target.value as AttendanceStatus },
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                          >
                            <option value="present">🟢 حاضر</option>
                            <option value="late">🟡 متأخر</option>
                            <option value="absent">🔴 غائب (يُخصم)</option>
                            <option value="leave">🏖️ إجازة رسمية</option>
                            <option value="excused">⚪ مستأذن بعذر</option>
                          </select>
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="time"
                            disabled={row.status === 'absent' || row.status === 'leave'}
                            value={row.checkIn}
                            onChange={(e) =>
                              setDailyAttendanceDraft({
                                ...dailyAttendanceDraft,
                                [emp.id]: { ...row, checkIn: e.target.value },
                              })
                            }
                            className="px-2 py-1 rounded border border-slate-300 font-mono text-center"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="time"
                            disabled={row.status === 'absent' || row.status === 'leave'}
                            value={row.checkOut}
                            onChange={(e) =>
                              setDailyAttendanceDraft({
                                ...dailyAttendanceDraft,
                                [emp.id]: { ...row, checkOut: e.target.value },
                              })
                            }
                            className="px-2 py-1 rounded border border-slate-300 font-mono text-center"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            disabled={row.status === 'absent' || row.status === 'leave'}
                            value={row.lateMinutes}
                            onChange={(e) =>
                              setDailyAttendanceDraft({
                                ...dailyAttendanceDraft,
                                [emp.id]: { ...row, lateMinutes: Math.max(0, parseInt(e.target.value) || 0) },
                              })
                            }
                            className="w-20 px-2 py-1 rounded border border-slate-300 font-mono text-center"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            disabled={row.status === 'absent' || row.status === 'leave'}
                            value={row.overtimeHours}
                            onChange={(e) =>
                              setDailyAttendanceDraft({
                                ...dailyAttendanceDraft,
                                [emp.id]: { ...row, overtimeHours: Math.max(0, parseFloat(e.target.value) || 0) },
                              })
                            }
                            className="w-20 px-2 py-1 rounded border border-slate-300 font-mono text-center font-bold text-emerald-700"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) =>
                              setDailyAttendanceDraft({
                                ...dailyAttendanceDraft,
                                [emp.id]: { ...row, notes: e.target.value },
                              })
                            }
                            placeholder="ملاحظة..."
                            className="w-full px-2 py-1 rounded border border-slate-300"
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

      {/* SUB-TAB 3: PAYROLL */}
      {activeSubTab === 'payroll' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  إعداد واعتماد مسير الرواتب الشهري
                </h3>
                <p className="text-xs text-slate-500">
                  عند اعتماد وصرف المسير، يتم تلقائياً توليد قيد مصروف بالرواتب + سندات صرف مالية لكل موظف
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <label className="text-xs font-bold text-slate-700">شهر المسير:</label>
                <input
                  type="month"
                  value={selectedPayrollMonth}
                  onChange={(e) => setSelectedPayrollMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-mono font-bold"
                />

                <select
                  value={payrollPaymentMethod}
                  onChange={(e) => setPayrollPaymentMethod(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                >
                  <option value="تحويل بنكي">تحويل بنكي (حماية أجور / آيبان)</option>
                  <option value="كاش">نقداً (كاش)</option>
                </select>

                {userRole !== 'viewer' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleGeneratePayroll(false)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
                    >
                      حفظ كمسودة
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGeneratePayroll(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>اعتماد وصرف المسير (توليد مصروف وسندات)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {existingMonthPayroll && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="font-bold text-emerald-900">
                  حالة مسير شهر ({selectedPayrollMonth}):{' '}
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    {existingMonthPayroll.status === 'approved_paid' ? '✅ معتمد ومنصرف مالياً' : '📝 مسودة قيد المراجعة'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrintPayroll(existingMonthPayroll)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة كشف المسير</span>
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-2.5">الموظف</th>
                    <th className="p-2.5 text-center">الأساسي + البدلات</th>
                    <th className="p-2.5 text-center">أيام الغياب</th>
                    <th className="p-2.5 text-center">خصم الغياب والتأخير</th>
                    <th className="p-2.5 text-center">سلف / خصومات أخرى</th>
                    <th className="p-2.5 text-center">ساعات إضافي (1.5x)</th>
                    <th className="p-2.5 text-center">مكافآت / عمولات</th>
                    <th className="p-2.5 text-center">صافي الراتب المستحق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {computedPayrollLines.map((line) => {
                    const adj = payrollAdjustments[line.employeeId] || {
                      otherDeductions: 0,
                      bonuses: 0,
                      notes: '',
                    };
                    return (
                      <tr key={line.employeeId} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <div className="font-extrabold text-slate-900">{line.employeeName}</div>
                          <div className="text-[11px] text-slate-500">{line.jobTitle}</div>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          {(line.baseSalary + line.totalAllowances).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center font-mono text-rose-600 font-bold">
                          {line.absentDays} يوم
                        </td>
                        <td className="p-2.5 text-center font-mono text-rose-700">
                          -{line.absenceDeduction.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            step="10"
                            value={adj.otherDeductions}
                            onChange={(e) =>
                              setPayrollAdjustments({
                                ...payrollAdjustments,
                                [line.employeeId]: {
                                  ...adj,
                                  otherDeductions: Math.max(0, parseFloat(e.target.value) || 0),
                                },
                              })
                            }
                            className="w-24 px-2 py-1 text-center font-mono rounded border border-slate-300"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono text-emerald-700">
                          +{line.overtimePay.toFixed(2)} ({line.overtimeHours} س)
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            step="10"
                            value={adj.bonuses}
                            onChange={(e) =>
                              setPayrollAdjustments({
                                ...payrollAdjustments,
                                [line.employeeId]: {
                                  ...adj,
                                  bonuses: Math.max(0, parseFloat(e.target.value) || 0),
                                },
                              })
                            }
                            className="w-24 px-2 py-1 text-center font-mono rounded border border-slate-300"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono font-extrabold text-emerald-800 text-sm">
                          {line.netSalary.toFixed(2)} ر.س
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Saved Payroll Runs History */}
          {payrolls.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 bg-slate-100 border-b border-slate-200 font-extrabold text-xs text-slate-800">
                أرشيف مسيرات الرواتب الشهرية
              </div>
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">رقم المسير</th>
                    <th className="p-3">الشهر</th>
                    <th className="p-3">تاريخ الإصدار</th>
                    <th className="p-3">إجمالي المستحقات</th>
                    <th className="p-3">إجمالي الخصومات</th>
                    <th className="p-3">صافي المسير</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payrolls.map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold">{pr.payrollNo}</td>
                      <td className="p-3 font-mono font-extrabold text-indigo-700">{pr.month}</td>
                      <td className="p-3 font-mono">{pr.issueDate}</td>
                      <td className="p-3 font-mono">
                        {(pr.totalBaseAndAllowances + pr.totalOvertimeAndBonuses).toFixed(2)} ر.س
                      </td>
                      <td className="p-3 font-mono text-rose-600">-{pr.totalDeductions.toFixed(2)} ر.س</td>
                      <td className="p-3 font-mono font-extrabold text-emerald-700">
                        {pr.totalNetPayroll.toFixed(2)} ر.س
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            pr.status === 'approved_paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pr.status === 'approved_paid' ? 'معتمد ومنصرف' : 'مسودة'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setPrintPayroll(pr)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 ml-1 cursor-pointer"
                          title="طباعة المسير"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {canDeleteItem(userRole) && (
                          <button
                            type="button"
                            onClick={() => onDeletePayroll(pr.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                            title="حذف المسير"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Employee Modal */}
      {isEmpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm">
                {editingEmp ? `تعديل بيانات الموظف: ${editingEmp.name}` : 'إضافة موظف / فني جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEmpModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم الموظف الكامل *</label>
                  <input
                    type="text"
                    value={empForm.name || ''}
                    onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المسمى الوظيفي *</label>
                  <input
                    type="text"
                    value={empForm.jobTitle || ''}
                    onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">القسم</label>
                  <input
                    type="text"
                    value={empForm.department || ''}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الجوال</label>
                  <input
                    type="text"
                    value={empForm.phone || ''}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الراتب الأساسي (ر.س) *</label>
                  <input
                    type="number"
                    min={0}
                    value={empForm.baseSalary ?? 0}
                    onChange={(e) => setEmpForm({ ...empForm, baseSalary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">بدل السكن (ر.س)</label>
                  <input
                    type="number"
                    min={0}
                    value={empForm.housingAllowance ?? 0}
                    onChange={(e) => setEmpForm({ ...empForm, housingAllowance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">بدل النقل (ر.س)</label>
                  <input
                    type="number"
                    min={0}
                    value={empForm.transportAllowance ?? 0}
                    onChange={(e) => setEmpForm({ ...empForm, transportAllowance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">أيام العمل الشهرية المعيارية</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={empForm.workingDaysPerMonth ?? 26}
                    onChange={(e) => setEmpForm({ ...empForm, workingDaysPerMonth: parseInt(e.target.value) || 26 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">البنك</label>
                  <input
                    type="text"
                    value={empForm.bankName || ''}
                    onChange={(e) => setEmpForm({ ...empForm, bankName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الآيبان (IBAN)</label>
                  <input
                    type="text"
                    value={empForm.iban || ''}
                    onChange={(e) => setEmpForm({ ...empForm, iban: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEmpModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold shadow-sm cursor-pointer"
                >
                  حفظ بيانات الموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Payroll Sheet Modal */}
      {printPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <span className="font-bold text-sm">كشف مسير رواتب شهر {printPayroll.month}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (printPayrollRef.current) {
                      smartPrintDocument(printPayrollRef.current, `مسير-رواتب-${printPayroll.month}`);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الكشف</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPayroll(null)}
                  className="p-1.5 rounded-lg bg-slate-800 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div ref={printPayrollRef} className="p-8 bg-white text-slate-900 space-y-6" dir="rtl">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold">{agencySettings.agencyName}</h2>
                  <p className="text-xs text-slate-600">كشف مسير الرواتب والأجور الشهري المعتمد</p>
                </div>
                <div className="text-left font-mono text-xs">
                  <div className="font-bold">رقم المسير: {printPayroll.payrollNo}</div>
                  <div>الشهر: {printPayroll.month}</div>
                  <div>تاريخ الإصدار: {printPayroll.issueDate}</div>
                </div>
              </div>

              <table className="w-full text-xs text-right border border-slate-300 border-collapse">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="p-2 border border-slate-700">الكود</th>
                    <th className="p-2 border border-slate-700">الموظف</th>
                    <th className="p-2 border border-slate-700">المسمى</th>
                    <th className="p-2 border border-slate-700 text-center">الأساسي والبدلات</th>
                    <th className="p-2 border border-slate-700 text-center">الخصومات والغياب</th>
                    <th className="p-2 border border-slate-700 text-center">الإضافي والمكافآت</th>
                    <th className="p-2 border border-slate-700 text-center">صافي الراتب</th>
                    <th className="p-2 border border-slate-700 text-center">التوقيع</th>
                  </tr>
                </thead>
                <tbody>
                  {printPayroll.lines.map((l) => (
                    <tr key={l.employeeId}>
                      <td className="p-2 border border-slate-300 font-mono">{l.employeeCode}</td>
                      <td className="p-2 border border-slate-300 font-bold">{l.employeeName}</td>
                      <td className="p-2 border border-slate-300">{l.jobTitle}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">
                        {(l.baseSalary + l.totalAllowances).toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-rose-700">
                        -{(l.absenceDeduction + l.otherDeductions).toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-emerald-700">
                        +{(l.overtimePay + l.bonuses).toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-extrabold">
                        {l.netSalary.toFixed(2)} ر.س
                      </td>
                      <td className="p-2 border border-slate-300"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 text-xs space-y-1 w-72">
                  <div className="flex justify-between font-bold text-sm text-emerald-900">
                    <span>إجمالي صافي المسير:</span>
                    <span className="font-mono">{printPayroll.totalNetPayroll.toFixed(2)} ر.س</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
