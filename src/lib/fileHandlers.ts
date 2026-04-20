/**
 * Creates a file handler for document uploads with validation and preview.
 * @param setFormData - State setter for form data
 * @param fieldKey - The key in form data to store the file URL
 * @param validateFile - Optional validation function
 * @returns Object with handlers: handleFileSelect, handleRemoveFile
 */
export function makeFileHandler(
  setFormData: (value: any) => void,
  fieldKey: string,
  validateFile?: (file: File) => void,
) {
  const handleFileSelect = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (validateFile) {
      try {
        validateFile(file);
      } catch (err: any) {
        alert(err.message);
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
      if (next[`${fieldKey}Preview`]) {
        URL.revokeObjectURL(next[`${fieldKey}Preview`]);
        delete next[`${fieldKey}Preview`];
      }
      delete next[fieldKey];
      return next;
    });
  };

  return { handleFileSelect, handleRemoveFile };
}
