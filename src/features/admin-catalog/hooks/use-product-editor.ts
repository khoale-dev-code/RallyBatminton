'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useReducer, useRef, useState, useTransition } from 'react';

import { uploadMediaFile } from '@/components/media/upload-media';

import { addProductPhotoAction, createProductFullAction, updateProductFullAction } from '../actions';
import {
  addOption,
  buildVariants,
  comboKey,
  ATTRIBUTE_PRESETS,
  emptyRate,
  emptyUnit,
  emptyVariant,
  newKey,
  sectionOfError,
  suggestSku,
  toPayload,
  type ProductDraft,
  type SectionId,
  type UnitDraft,
  type VariantDraft,
} from '../lib/product-draft';
import { payloadErrors, productPayloadSchema, type PayloadErrors } from '../lib/product-payload';
import { toast } from '@/components/ui/toast';

type Action =
  | { type: 'patch'; patch: Partial<ProductDraft> }
  | { type: 'name'; name: string }
  | { type: 'variants-toggle'; on: boolean }
  | { type: 'options'; which: 'size' | 'color'; values: string[] }
  | { type: 'variant'; key: string; patch: Partial<VariantDraft> }
  | { type: 'variant-default'; key: string }
  | { type: 'variant-remove'; key: string }
  | { type: 'stock-listed'; branchId: string; listed: boolean }
  | { type: 'stock-qty'; branchId: string; variantKey: string; qty: number }
  | { type: 'rate-add' }
  | { type: 'rate'; key: string; patch: Partial<ProductDraft['rates'][number]> }
  | { type: 'rate-remove'; key: string }
  | { type: 'attr-add' }
  | { type: 'attr-name'; slot: 1 | 2; name: string }
  | { type: 'attr-remove'; slot: 1 | 2 }
  | { type: 'units-toggle'; on: boolean }
  | { type: 'unit-add' }
  | { type: 'unit'; key: string; patch: Partial<UnitDraft> }
  | { type: 'unit-remove'; key: string }
  | { type: 'reset'; draft: ProductDraft };

/** Tên thuộc tính gợi ý tiếp theo (chưa dùng). */
function nextAttributeName(d: ProductDraft): string {
  const used = [d.option1Name, d.option2Name].map((n) => (n ?? '').toLowerCase());
  return ATTRIBUTE_PRESETS.find((p) => !used.includes(p.toLowerCase())) ?? 'Thuộc tính';
}

function withOptions(d: ProductDraft, sizes: string[], colors: string[]): ProductDraft {
  const { variants, removed } = buildVariants(sizes, colors, d.variants, d.name, d.excludedCombos);
  const archived = [
    ...d.archivedVariantIds.filter((id) => !variants.some((v) => v.id === id)),
    ...removed.flatMap((v) => (v.id ? [v.id] : [])),
  ];
  return { ...d, sizeOptions: sizes, colorOptions: colors, variants, archivedVariantIds: [...new Set(archived)] };
}

function reducer(d: ProductDraft, a: Action): ProductDraft {
  switch (a.type) {
    case 'patch':
      return { ...d, ...a.patch };
    case 'name': {
      // SKU tự gợi ý theo tên cho tới khi người dùng tự sửa SKU (chỉ với biến thể mới).
      if (d.skuTouched) return { ...d, name: a.name };
      return {
        ...d,
        name: a.name,
        variants: d.variants.map((v) => (v.id ? v : { ...v, sku: suggestSku(a.name, d.hasVariants ? [v.sizeLabel, v.colorLabel] : []) })),
      };
    }
    case 'variants-toggle': {
      if (a.on) {
        const named = d.option1Name || d.option2Name ? d : { ...d, option1Name: 'Kích thước' };
        return { ...withOptions({ ...named, hasVariants: true }, d.sizeOptions, d.colorOptions) };
      }
      const keep = d.variants.find((v) => v.isDefault) ?? d.variants[0] ?? emptyVariant(suggestSku(d.name));
      const archived = d.variants.filter((v) => v.key !== keep.key && v.id).map((v) => v.id as string);
      return {
        ...d,
        hasVariants: false,
        option1Name: null,
        option2Name: null,
        sizeOptions: [],
        colorOptions: [],
        variants: [{ ...keep, isDefault: true }],
        archivedVariantIds: [...new Set([...d.archivedVariantIds, ...archived])],
      };
    }
    case 'options': {
      // Giá trị vừa thêm lại thì bỏ các tổ hợp đã loại trước đó của giá trị ấy.
      const prev = (a.which === 'size' ? d.sizeOptions : d.colorOptions).map((x) => x.toLowerCase());
      const added = new Set(a.values.map((x) => x.trim().toLowerCase()).filter((x) => !prev.includes(x)));
      const excludedCombos = d.excludedCombos.filter((k) => !added.has(k.split('|')[a.which === 'size' ? 0 : 1] ?? ''));
      const next = { ...d, excludedCombos };
      return a.which === 'size' ? withOptions(next, a.values, d.colorOptions) : withOptions(next, d.sizeOptions, a.values);
    }
    case 'variant':
      return {
        ...d,
        skuTouched: d.skuTouched || a.patch.sku !== undefined,
        variants: d.variants.map((v) => (v.key === a.key ? { ...v, ...a.patch } : v)),
      };
    case 'variant-default':
      return { ...d, variants: d.variants.map((v) => ({ ...v, isDefault: v.key === a.key })) };
    case 'variant-remove': {
      const target = d.variants.find((v) => v.key === a.key);
      if (!target || d.variants.length <= 1) return d;
      const rest = d.variants.filter((v) => v.key !== a.key);
      const variants = target.isDefault && rest[0] ? [{ ...rest[0], isDefault: true }, ...rest.slice(1)] : rest;
      return {
        ...d,
        variants,
        excludedCombos: [...new Set([...d.excludedCombos, comboKey(target.sizeLabel, target.colorLabel)])],
        archivedVariantIds: target.id ? [...new Set([...d.archivedVariantIds, target.id])] : d.archivedVariantIds,
      };
    }
    case 'stock-listed': {
      const prev = d.stock[a.branchId] ?? { listed: false, qty: {} };
      return { ...d, stock: { ...d.stock, [a.branchId]: { ...prev, listed: a.listed } } };
    }
    case 'stock-qty': {
      const prev = d.stock[a.branchId] ?? { listed: true, qty: {} };
      return { ...d, stock: { ...d.stock, [a.branchId]: { listed: true, qty: { ...prev.qty, [a.variantKey]: a.qty } } } };
    }
    case 'rate-add':
      return { ...d, rates: [...d.rates, emptyRate()] };
    case 'rate':
      return { ...d, rates: d.rates.map((r) => (r.key === a.key ? { ...r, ...a.patch } : r)) };
    case 'rate-remove':
      return { ...d, rates: d.rates.filter((r) => r.key !== a.key) };
    case 'attr-add':
      if (d.option1Name === null) return { ...d, option1Name: nextAttributeName(d) };
      if (d.option2Name === null) return { ...d, option2Name: nextAttributeName(d) };
      return d;
    case 'attr-name':
      return a.slot === 1 ? { ...d, option1Name: a.name } : { ...d, option2Name: a.name };
    case 'attr-remove': {
      // Bỏ thuộc tính = bỏ giá trị của nó; biến thể gộp lại theo thuộc tính còn lại.
      const next =
        a.slot === 1
          ? withOptions({ ...d, option1Name: null }, [], d.colorOptions)
          : withOptions({ ...d, option2Name: null }, d.sizeOptions, []);
      return next.option1Name === null && next.option2Name === null ? reducer(next, { type: 'variants-toggle', on: false }) : next;
    }
    case 'units-toggle':
      if (a.on) return { ...d, hasUnits: true, units: d.units.length ? d.units : [emptyUnit()] };
      return {
        ...d,
        hasUnits: false,
        units: [],
        archivedUnitIds: [...new Set([...d.archivedUnitIds, ...d.units.flatMap((u) => (u.id ? [u.id] : []))])],
      };
    case 'unit-add':
      return d.units.length >= 10 ? d : { ...d, units: [...d.units, emptyUnit()] };
    case 'unit':
      return { ...d, units: d.units.map((u) => (u.key === a.key ? { ...u, ...a.patch } : u)) };
    case 'unit-remove': {
      const target = d.units.find((u) => u.key === a.key);
      const units = d.units.filter((u) => u.key !== a.key);
      return {
        ...d,
        units,
        hasUnits: units.length > 0,
        archivedUnitIds: target?.id ? [...new Set([...d.archivedUnitIds, target.id])] : d.archivedUnitIds,
      };
    }
    case 'reset':
      return a.draft;
  }
}

const MAX_PHOTOS = 12;

export interface PendingPhoto {
  key: string;
  file: File;
  url: string;
}

type SectionState = Record<SectionId, boolean>;

/** Trạng thái màn thêm/sửa sản phẩm: bản nháp, lỗi, khung đang mở, ảnh chờ tải và thao tác lưu. */
export function useProductEditor(mode: 'create' | 'edit', initial: ProductDraft, productId?: string, version?: string) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, dispatch] = useReducer(reducer, initial);
  const [seenVersion, setSeenVersion] = useState(version);
  const [errors, setErrors] = useState<PayloadErrors>({});
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sections, setSections] = useState<SectionState>({
    general: true,
    media: true,
    pricing: true,
    tax: true,
    inventory: true,
    units: true,
    variants: true,
    rates: true,
    seo: false,
    sidebar: true,
  });

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved) || photos.length > 0, [draft, saved, photos]);

  // Server trả bản mới (sau khi lưu: biến thể mới đã có id) → nạp lại bản nháp nếu không có thay đổi dở dang.
  if (version !== seenVersion) {
    setSeenVersion(version);
    if (!dirty) {
      setSaved(initial);
      dispatch({ type: 'reset', draft: initial });
    }
  }

  // Cảnh báo khi rời trang mà chưa lưu.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Giải phóng ảnh xem trước khi rời màn hình.
  const urlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function setSection(id: SectionId, open: boolean) {
    setSections((s) => ({ ...s, [id]: open }));
  }

  function addPhotos(files: FileList | File[]) {
    const all = Array.from(files);
    const list = all.filter((f) => f.type.startsWith('image/'));
    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const accepted = list.slice(0, room);
    if (accepted.length > 0) {
      toast.info(
        mode === 'create'
          ? `Đã chọn ${accepted.length} ảnh — ảnh sẽ được tải lên khi bấm Tạo sản phẩm.`
          : `Đã chọn ${accepted.length} ảnh — ảnh sẽ được tải lên khi bấm Lưu.`,
      );
    }
    if (all.length > list.length) toast.error(`Bỏ qua ${all.length - list.length} tệp không phải ảnh (chỉ nhận JPG, PNG, WebP).`);
    if (list.length > accepted.length) toast.error(`Tối đa ${MAX_PHOTOS} ảnh — bỏ qua ${list.length - accepted.length} ảnh.`);
    setPhotos((prev) => [
      ...prev,
      ...accepted.slice(0, Math.max(0, MAX_PHOTOS - prev.length)).map((file) => {
        const url = URL.createObjectURL(file);
        urlsRef.current.add(url);
        return { key: newKey('p'), file, url };
      }),
    ]);
  }
  function removePhoto(key: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) {
        URL.revokeObjectURL(target.url);
        urlsRef.current.delete(target.url);
      }
      return prev.filter((p) => p.key !== key);
    });
  }
  function makeCover(key: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      return target ? [target, ...prev.filter((p) => p.key !== key)] : prev;
    });
  }

  function failWith(fieldErrors: PayloadErrors, text: string) {
    setErrors(fieldErrors);
    setMessage({ tone: 'error', text });
    const open = new Set(Object.keys(fieldErrors).map((k) => sectionOfError(k, draft.hasVariants)));
    setSections((s) => {
      const next = { ...s };
      open.forEach((id) => (next[id] = true));
      return next;
    });
    // Đưa con trỏ tới ô lỗi đầu tiên sau khi khung đã mở.
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  }

  function save() {
    const payload = toPayload(draft, mode);
    const check = productPayloadSchema.safeParse(payload);
    if (!check.success) {
      failWith(payloadErrors(check.error), 'Vui lòng kiểm tra các ô được đánh dấu.');
      return;
    }
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const res =
        mode === 'create' ? await createProductFullAction(check.data) : await updateProductFullAction(productId ?? '', check.data);
      if (!res.ok) {
        failWith(res.fieldErrors ?? {}, res.error);
        toast.error(res.error);
        return;
      }
      if (mode === 'create') {
        const failed: string[] = [];
        const loadingId = photos.length > 0 ? toast.loading(`Đã tạo sản phẩm — đang tải ảnh lên (0/${photos.length})…`) : null;
        for (const [i, photo] of photos.entries()) {
          setProgress(`Đang tải ảnh ${i + 1}/${photos.length}…`);
          if (loadingId !== null) toast.update(loadingId, 'loading', `Đã tạo sản phẩm — đang tải ảnh lên (${i + 1}/${photos.length})…`);
          try {
            const path = await uploadMediaFile('products', res.id, photo.file);
            const stored = await addProductPhotoAction(res.id, path);
            if (stored.status === 'error') failed.push(photo.file.name);
          } catch {
            failed.push(photo.file.name);
          }
        }
        setProgress(null);
        setSaved(draft);
        setPhotos([]);
        const uploaded = photos.length - failed.length;
        if (failed.length) {
          toast.update(loadingId, 'error', `Đã tạo sản phẩm, nhưng ${failed.length} ảnh chưa tải lên được — thêm lại ở mục Ảnh.`);
        } else if (uploaded > 0) {
          toast.update(loadingId, 'success', `Đã tạo sản phẩm và tải lên thành công ${uploaded} ảnh.`);
        } else {
          toast.success('Đã tạo sản phẩm.');
        }
        router.push(`/admin/catalog/${res.id}?created=1${failed.length ? `&photo_errors=${failed.length}` : ''}`);
        return;
      }
      setSaved(draft);
      setMessage({ tone: 'success', text: 'Đã lưu sản phẩm.' });
      toast.success('Đã lưu sản phẩm.');
      router.refresh();
    });
  }

  return {
    draft,
    dispatch,
    errors,
    message,
    dirty,
    isPending: isPending || progress !== null,
    progress,
    sections,
    setSection,
    photos,
    addPhotos,
    removePhoto,
    makeCover,
    save,
    reset: () => {
      dispatch({ type: 'reset', draft: saved });
      setErrors({});
      setMessage(null);
      setPhotos([]);
    },
    addOptionValues: (which: 'size' | 'color', raw: string) =>
      dispatch({ type: 'options', which, values: addOption(which === 'size' ? draft.sizeOptions : draft.colorOptions, raw) }),
  };
}

export type ProductEditorState = ReturnType<typeof useProductEditor>;
