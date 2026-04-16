interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-700">
        {label}
        {required && <span className="ml-1 text-crimson-600">*</span>}
      </label>
      {hint && <p className="text-xs text-ink-300">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-xs text-crimson-600">
          {error}
        </p>
      )}
    </div>
  );
}
