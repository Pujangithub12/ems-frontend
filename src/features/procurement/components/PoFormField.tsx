import React from "react";
import { handleRowArrowNav, inputCls, labelCls } from "../utils/poFormUi";

type Props = {
  label: string;
  /** Form key; passed back to `onField` so one stable handler serves every field. */
  name: string;
  value: string;
  onField: (name: string, value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  /** Wire ArrowLeft/ArrowRight to hop between the plain text fields of the surrounding [data-arrow-row]. */
  arrowNav?: boolean;
  multiline?: boolean;
  rows?: number;
  wrapperClass?: string;
};

/** A labelled input/textarea. Memoised, so typing in one field doesn't re-render all the others. */
const PoFormField = React.memo(function PoFormField({ label, name, value, onField, disabled, placeholder, type, arrowNav, multiline, rows, wrapperClass }: Props) {
  return (
    <div className={wrapperClass}>
      <label className={labelCls}>{label}</label>
      {multiline ? (
        <textarea
          disabled={disabled}
          rows={rows}
          value={value}
          onChange={(e) => onField(name, e.target.value)}
          className={`${inputCls} resize-none`}
        />
      ) : (
        <input
          type={type}
          disabled={disabled}
          value={value}
          onChange={(e) => onField(name, e.target.value)}
          onKeyDown={arrowNav ? handleRowArrowNav : undefined}
          placeholder={placeholder}
          className={inputCls}
        />
      )}
    </div>
  );
});

export default PoFormField;
