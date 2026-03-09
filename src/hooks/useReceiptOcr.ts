import { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { supabase } from '@/integrations/supabase/client';

export interface OcrResult {
  imageUrl: string;
  totalAmount: number | null;
  ocrText: string;
}

/** Preprocess image: scale up small images, convert to grayscale, boost contrast */
async function preprocessImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Scale up if width < 1500px while maintaining aspect ratio
      const targetWidth = img.width < 1500 ? 1500 : img.width;
      const scale = targetWidth / img.width;
      const targetHeight = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Draw scaled image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Convert to grayscale and boost contrast
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imageData.data;
      const contrast = 1.5; // boost contrast factor
      const intercept = 128 * (1 - contrast);

      for (let i = 0; i < data.length; i += 4) {
        // Grayscale luminance
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Boost contrast
        const adjusted = Math.min(255, Math.max(0, contrast * gray + intercept));
        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
        // alpha unchanged
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const processedFile = new File([blob], file.name, { type: 'image/png' });
          resolve(processedFile);
        },
        'image/png',
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/** Extract the most likely "total" amount from raw OCR text */
function extractTotal(text: string): number | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Priority 1: line containing "total" keyword with a number
  const totalKeywords = /\b(grand\s*total|total\s*amount|net\s*total|amount\s*due|total|payable|subtotal|sub\s*total)\b/i;
  for (const line of [...lines].reverse()) {
    if (totalKeywords.test(line)) {
      const nums = line.match(/[\d,]+(?:\.\d{1,2})?/g);
      if (nums?.length) {
        const val = parseFloat(nums[nums.length - 1].replace(/,/g, ''));
        if (val > 0) return val;
      }
    }
  }

  // Priority 2: "TOTAL" on one line, digits on the next line
  for (let i = 0; i < lines.length - 1; i++) {
    if (/\bTOTAL\b/i.test(lines[i])) {
      const nextNums = lines[i + 1].match(/[\d,]+(?:\.\d{1,2})?/g);
      if (nextNums?.length) {
        const val = parseFloat(nextNums[nextNums.length - 1].replace(/,/g, ''));
        if (val > 0) return val;
      }
    }
  }

  // Priority 3: colon followed by rupee amount e.g. "Total: 1,500.00"
  const colonAmountPat = /:\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*$/;
  for (const line of [...lines].reverse()) {
    if (totalKeywords.test(line)) {
      const m = line.match(colonAmountPat);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (val > 0) return val;
      }
    }
  }

  // Priority 4: ₹ or Rs. followed by a number anywhere
  const rupeePat = /(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;
  const rupeeMatches: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = rupeePat.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 0) rupeeMatches.push(val);
  }
  if (rupeeMatches.length) return Math.max(...rupeeMatches);

  // Priority 5: amounts like "1,500.00" or "1500" (no decimals) — largest on page
  const allNums = text
    .match(/\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b|\b\d{1,6}(?:\.\d{1,2})?\b/g)
    ?.map(n => parseFloat(n.replace(/,/g, '')))
    .filter(n => n >= 1 && n <= 999999) ?? [];

  return allNums.length ? Math.max(...allNums) : null;
}

export function useReceiptOcr() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);

  const scanReceipt = async (file: File): Promise<{ data: OcrResult | null; error: string | null }> => {
    setScanning(true);
    setProgress(0);

    try {
      // Preprocess the image for better OCR accuracy
      const processedFile = await preprocessImage(file);

      // First OCR pass with PSM 6 (single uniform block of text — good for receipts)
      const worker = await createWorker('eng', 1, {
        logger: (msg) => {
          if (msg.status === 'recognizing text') {
            setProgress(Math.round(msg.progress * 80)); // 0–80% for first pass
          }
        },
      });

      await worker.setParameters({ tessedit_pageseg_mode: '6' });

      const { data: firstData } = await worker.recognize(processedFile);
      let ocrText = firstData.text || '';
      let totalAmount = extractTotal(ocrText);

      // Second OCR pass with PSM 4 if first pass failed to find total
      if (totalAmount === null) {
        await worker.setParameters({ tessedit_pageseg_mode: '4' });
        const { data: secondData } = await worker.recognize(processedFile);
        const secondText = secondData.text || '';
        const secondTotal = extractTotal(secondText);
        if (secondTotal !== null) {
          ocrText = secondText;
          totalAmount = secondTotal;
        }
        setProgress(100);
      } else {
        setProgress(100);
      }

      await worker.terminate();

      // Optionally upload image to Supabase Storage (best-effort, non-blocking)
      let imageUrl = '';
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData } = await supabase.storage
          .from('receipts')
          .upload(fileName, file, { contentType: file.type });
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(uploadData.path);
          imageUrl = publicUrl;
        }
      } catch {
        // Storage upload failed — OCR result still usable
      }

      return { data: { imageUrl, totalAmount, ocrText }, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    } finally {
      setScanning(false);
      setProgress(0);
    }
  };

  return { scanReceipt, scanning, progress };
}
