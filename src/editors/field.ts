/** `$event.target.value`, guarded — a template cannot narrow an EventTarget. */
export const inputValue = (event: Event): string => {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement ? target.value : "";
};

/** The classes every editor field shares, so the editors stay about their shape. */
export const FIELD_CLASS = "rounded border border-stone-300 px-2 py-1";
export const LABEL_CLASS = "flex flex-col gap-1";
export const LABEL_TEXT_CLASS = "font-medium text-stone-600";
