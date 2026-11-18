import { AuditLogEntry } from '../types';

const AUDIT_STORAGE_KEY = 'agency_audit_trail_logs';
const MAX_LOG_ENTRIES = 500;

/**
 * خوارزمية تجزئة متزامنة تدعم النصوص العربية (UTF-8) لتكوين سلسلة تدقيق غير قابلة للتلاعب (Tamper-Evident Hash Chain)
 */
function computeAuditHash(payload: string): string {
  const bytes = new TextEncoder().encode(payload);
  let h1 = 0xdeadbeef ^ bytes.length;
  let h2 = 0x41c6ce57 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`;
}

export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read audit logs:', err);
    return [];
  }
}

export function verifyAuditChain(logs: AuditLogEntry[]): { valid: boolean; brokenAtId?: string } {
  // السجلات مرتبة من الأحدث للأقدم، لذا نتحقق من الأقدم إلى الأحدث
  const chronological = [...logs].reverse();
  let expectedPrev = 'GENESIS';
  for (const entry of chronological) {
    if (!entry.hash) continue; // توافق مع السجلات القديمة
    const rawString = `${entry.prevHash || 'GENESIS'}|${entry.id}|${entry.action}|${entry.entityType || ''}|${entry.entityId || ''}|${entry.userEmail || ''}|${entry.details || ''}`;
    const expectedHash = computeAuditHash(rawString);
    if (entry.prevHash !== expectedPrev || entry.hash !== expectedHash) {
      return { valid: false, brokenAtId: entry.id };
    }
    expectedPrev = entry.hash;
  }
  return { valid: true };
}

export function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  try {
    const logs = getAuditLogs();
    const prevHash = logs[0]?.hash || 'GENESIS';
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = new Date().toLocaleString('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const rawString = `${prevHash}|${id}|${entry.action}|${entry.entityType || ''}|${entry.entityId || ''}|${entry.userEmail || ''}|${entry.details || ''}`;
    const hash = computeAuditHash(rawString);

    const newEntry: AuditLogEntry = {
      ...entry,
      id,
      timestamp,
      prevHash,
      hash,
    };

    const updated = [newEntry, ...logs].slice(0, MAX_LOG_ENTRIES);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save audit log:', err);
  }
}

export function clearAuditLogs(): void {
  try {
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear audit logs:', err);
  }
}
