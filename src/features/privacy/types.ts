/** Kiểu dữ liệu dùng chung (máy chủ + trình duyệt) — không import gì phía máy chủ. */
import { type LegalCode } from './consent-text';
import { type CancellationPolicy } from './lib/policy';

export interface LegalDocument {
  id: string;
  code: LegalCode;
  version: number;
  title: string;
  summary: string | null;
  body: string;
  changeNote: string | null;
  effectiveAt: string;
  createdAt: string;
}

export interface BranchCancellation extends CancellationPolicy {
  name: string;
  slug: string;
}

export interface RetentionPolicy {
  code: string;
  label: string;
  dataScope: string;
  retentionDays: number;
  action: 'anonymize' | 'delete' | 'keep';
  basis: string;
  isAutomatic: boolean;
  lastRunAt: string | null;
  lastRunCount: number | null;
}
