import { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { supabase } from '@/integrations/supabase/client';

export interface OcrResult {
  imageUrl: string;
  totalAmount: number | null;
  ocrText: string;
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

  // Priority 2: ₹ or Rs. followed by a number anywhere
  const rupeePat = /(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;
  const rupeeMatches: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = rupeePat.exec(text)) !== null) {
    rupeeMatches.push(parseFloat(m[1].replace(/,/g, '')));
  }
  if (rupeeMatches.length) return Math.max(...rupeeMatches);

  // Priority 3: largest number on the page (likely the total)
  const allNums = text
    .match(/\b\d{1,6}(?:[.,]\d{1,2})?\b/g)
    ?.map(n => parseFloat(n.replace(',', '.')))
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
      // 1. Run Tesseract.js OCR entirely in-browser (no API needed)
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data } = await worker.recognize(file);
      await worker.terminate();

      const ocrText = data.text || '';
      const totalAmount = extractTotal(ocrText);

      // 2. Optionally upload image to Supabase Storage (best-effort, non-blocking)
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

