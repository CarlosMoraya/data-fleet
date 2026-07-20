/**
 * Recebe um Blob de imagem JPEG e grava o datetime atual no canto inferior
 * direito via canvas. Retorna um novo File com o timestamp embutido.
 *
 * Uso: chamar após receber o Blob do CameraCapture, antes de fazer upload.
 */
export async function stampTimestampOnImage(
  blob: Blob,
  filename: string,
  coords?: { latitude: number; longitude: number },
): Promise<File> {
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

  drawTimestampOverlay(ctx, canvas.width, canvas.height, coords);

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

function drawTimestampOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  coords?: { latitude: number; longitude: number },
): void {
  const fontSize = Math.max(16, Math.floor(h / 30));
  ctx.font = `bold ${fontSize}px monospace`;

  const lines = [new Date().toLocaleString('pt-BR')];
  if (coords) {
    lines.push(`GPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
  }

  const pad = 8;
  const lineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));

  const boxW = lineWidth + pad * 2;
  const boxH = fontSize * lines.length + pad * 2;
  const boxX = w - boxW;
  const boxY = h - boxH;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = '#FFFFFF';
  lines.forEach((line, index) => {
    ctx.fillText(line, boxX + pad, boxY + pad + fontSize * (index + 1));
  });
}
