/**
 * The app's labelled form input — leading icon, teal focus treatment, and (for passwords) the
 * modern show/hide "eye" toggle.
 *
 * Why one component: every input in the product should look and behave identically (label placement,
 * focus ring, disabled state), so the styling lives here once rather than being re-assembled per
 * screen. The password variant keeps its visibility state internal — no caller needs to know whether
 * the text is currently revealed.
 *
 * Accessibility: label is tied via htmlFor/id; the eye toggle is a real button with an aria-label
 * that names the action it will perform, and stays out of the way of password managers.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { springSnappy } from "../motion";

import { EyeIcon, EyeOffIcon } from "./icons";

/** Props for {@link TextField}. */
interface TextFieldProps {
  /** DOM id — also links the label. */
  readonly id: string;
  /** Visible label above the input. */
  readonly label: string;
  /** `text` renders a plain input; `password` adds the visibility toggle. */
  readonly type: "text" | "password";
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Browser autofill hint, e.g. `username` / `current-password`. */
  readonly autoComplete?: string;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  /** Leading glyph, e.g. `<UserIcon className="h-4.5 w-4.5" />`. */
  readonly icon?: ReactNode;
}

/** Labelled input field; passwords get a show/hide toggle. */
export function TextField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
  icon,
}: TextFieldProps) {
  const reduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword && revealed ? "text" : type;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="group relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted transition-colors group-focus-within:text-primary-bright">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={effectiveType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`field-inset h-11 w-full rounded-lg text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted/60 hover:border-muted/40 ${icon ? "pl-10.5" : "pl-3.5"} ${isPassword ? "pr-11" : "pr-3.5"}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink focus-visible:text-primary-bright focus-visible:outline-none"
          >
            {/* Spring scale tick on each show/hide swap (§5a) — keyed so the icon change re-mounts. */}
            <motion.span
              key={revealed ? "off" : "on"}
              initial={reduceMotion ? false : { scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={springSnappy}
              className="flex"
            >
              {revealed ? <EyeOffIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
            </motion.span>
          </button>
        )}
      </div>
    </div>
  );
}
