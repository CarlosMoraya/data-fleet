/**
 * Recebe um Blob de imagem JPEG e grava o datetime atual no canto inferior
 * direito via canvas. Retorna um novo File com o timestamp embutido.
 *
 * Uso: chamar após receber o Blob do CameraCapture, antes de fazer upload.
 */
export async function stampTimestampOnImage(blob: Blob, filename: string): Promise<File> {
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new File([blob], filename, { type: 'image/jpeg' });
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  drawTimestampOverlay(ctx, canvas.width, canvas.height);

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (stamped) => {
        resolve(new File([stamped ?? blob], filename, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.82,
    );
  });
}

function drawTimestampOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const fontSize = Math.max(16, Math.floor(h / 30));
  ctx.font = `bold ${fontSize}px monospace`;

  const text = new Date().toLocaleString('pt-BR');
  const metrics = ctx.measureText(text);
  const pad = 8;

  const boxW = metrics.width + pad * 2;
  const boxH = fontSize + pad * 2;
  const boxX = w - boxW;
  const boxY = h - boxH;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, boxX + pad, h - pad);
}
