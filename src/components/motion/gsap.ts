'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

// Đăng ký một lần cho toàn bộ client (mọi component chuyển động import từ file này).
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);

/** Chỉ chạy chuyển động khi người dùng không bật "giảm chuyển động" trong hệ điều hành. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

export { DrawSVGPlugin, gsap, ScrollTrigger, SplitText, useGSAP };
