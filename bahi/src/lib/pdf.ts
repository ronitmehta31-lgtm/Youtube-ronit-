// Turns the on-screen invoice into a PDF file. Loaded only when someone shares or downloads one.

export async function elementToPdf(el: HTMLElement, fileName: string, thermal: boolean): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  const img = canvas.toDataURL('image/jpeg', 0.92);
  let pdf;
  if (thermal) {
    // Receipt: one long page as wide as the roll.
    const w = 80, h = (canvas.height / canvas.width) * w;
    pdf = new jsPDF({ unit: 'mm', format: [w, Math.max(h, 50)] });
    pdf.addImage(img, 'JPEG', 0, 0, w, h);
  } else {
    pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210, ph = 297, m = 8;
    const w = pw - m * 2, h = (canvas.height / canvas.width) * w;
    // Long invoices continue on more pages.
    let y = 0;
    for (let page = 0; y < h; page++) {
      if (page) pdf.addPage();
      pdf.addImage(img, 'JPEG', m, m - y, w, h);
      y += ph - m * 2;
    }
  }
  return new File([pdf.output('blob')], fileName, { type: 'application/pdf' });
}

/** Phone: opens the share sheet with the PDF attached (pick WhatsApp). Computer: downloads it. */
export async function shareOrDownload(file: File, text: string): Promise<'shared' | 'downloaded'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text }); return 'shared'; } catch (e) { if ((e as Error).name === 'AbortError') return 'shared'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'downloaded';
}
