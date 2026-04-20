interface FormLabelProps {
  children: unknown;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
}

export function FormLabel({ children, required, optional, htmlFor }: FormLabelProps) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {optional && <span className="text-gray-400 text-xs ml-1">(opcional)</span>}
      {required && !optional && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

/**
 * Common CSS classes for form inputs and labels.
 * Use these to maintain consistency across all forms.
 */
export const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm';

export const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';

export const TEXTAREA_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm resize-none';

export const SELECT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm bg-white';
