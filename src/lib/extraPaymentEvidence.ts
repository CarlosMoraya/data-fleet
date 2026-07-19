import { validateFile } from './storageHelpers';

export const EVIDENCE_PHOTO_LIMIT = 3;

export function canAddMoreEvidencePhotos(currentCount: number): boolean {
  return currentCount < EVIDENCE_PHOTO_LIMIT;
}

export function remainingEvidenceSlots(currentCount: number): number {
  return Math.max(0, EVIDENCE_PHOTO_LIMIT - currentCount);
}

export function validateEvidencePhoto(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error('Apenas imagens são permitidas nas fotos de evidência.');
  }
  validateFile(file);
}
