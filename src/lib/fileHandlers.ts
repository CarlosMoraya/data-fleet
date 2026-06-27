/**
 * Creates a file handler for document uploads with validation and preview.
 * @param setFormData - State setter for form data
 * @param fieldKey - The key in form data to store the file URL
 * @param validateFile - Optional validation function
 * @returns Object with handlers: handleFileSelect, handleRemoveFile
 */
export function makeFileHandler(
  setFormData: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void,
  fieldKey: string,
  validateFile?: (file: File) => void,
) {
  const handleFileSelect = (e: { target: { files?: FileList | null } }) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (validateFile) {
      try {
        validateFile(file);
      } catch (err: unknown) {
        alert((err as { message?: string }).message);
        return;
      }
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setFormData((prev) => ({
      ...prev,
      [fieldKey]: file,
      [`${fieldKey}Preview`]: previewUrl,
    }));
  };

  const handleRemoveFile = () => {
    setFormData((prev) => {
      const next = { ...prev };
      // Clean up preview URL
      const previewKey = `${fieldKey}Preview`;
      if (next[previewKey]) {
        URL.revokeObjectURL(next[previewKey] as string);
        delete next[previewKey];
      }
      delete next[fieldKey];
      return next;
    });
  };

  return { handleFileSelect, handleRemoveFile };
}
