'use client';

import { Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | null {
  const g = globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorCtor };
  return g.BarcodeDetector ?? null;
}

const subscribe = () => () => undefined;

/** Lấy token từ nội dung QR (URL /checkin?t=...). Chỉ chấp nhận mã của chính website. */
export function tokenFromQr(raw: string, origin: string): string | null {
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin || url.pathname !== '/checkin') return null;
    const t = url.searchParams.get('t');
    return t && /^[0-9a-f]{48}$/.test(t) ? t : null;
  } catch {
    return null;
  }
}

/** Quét QR ngay trong trang (trình duyệt hỗ trợ BarcodeDetector); nếu không, hướng dẫn dùng camera điện thoại. */
export function QrScanner() {
  const router = useRouter();
  const supported = useSyncExternalStore(
    subscribe,
    () => detectorCtor() !== null && Boolean(navigator.mediaDevices),
    () => false,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const Ctor = detectorCtor();
    if (!Ctor) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = new Ctor({ formats: ['qr_code'] });

    const scan = async () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      if (video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          for (const code of codes) {
            const token = tokenFromQr(code.rawValue, window.location.origin);
            if (token) {
              stopped = true;
              router.replace(`/checkin?t=${token}`);
              return;
            }
          }
        } catch {
          // khung hình lỗi: bỏ qua, quét khung tiếp theo
        }
      }
      raf = window.requestAnimationFrame(() => void scan());
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        void scan();
      })
      .catch(() => {
        setError('Không mở được camera. Cho phép quyền camera hoặc dùng ứng dụng camera của điện thoại.');
        setActive(false);
      });

    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, router]);

  if (!supported) {
    return <p className="text-muted">Mở ứng dụng camera của điện thoại và quét mã QR trên màn hình quầy.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {active ? (
        <>
          <video ref={videoRef} playsInline muted className="aspect-square w-full rounded-panel bg-ink object-cover" />
          <Button variant="outline" onClick={() => setActive(false)}>
            Tắt camera
          </Button>
        </>
      ) : (
        <Button variant="court" size="lg" onClick={() => setActive(true)}>
          <Camera className="size-5" aria-hidden />
          Mở camera quét mã
        </Button>
      )}
      {error && <p className="text-sm text-shuttle-deep">{error}</p>}
    </div>
  );
}
