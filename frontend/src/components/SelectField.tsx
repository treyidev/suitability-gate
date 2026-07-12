/**
 * A labelled dropdown (UI Modernization Directive §5a "the big one").
 *
 * Built on Radix Select (owner decision at the P1.5 gate: a headless, a11y-battle-tested primitive we
 * style entirely ourselves — a native `<select>`'s popup is OS-rendered and cannot be frosted or
 * animated). The trigger is styled like the glass-inset fields ({@link TextField}); the popover is a
 * `.glass` frosted panel that floats over page CONTENT (legal per §3a — glass is for chrome/overlays,
 * and this never nests inside another glass surface). Radix supplies keyboard nav, typeahead,
 * outside-click, and ARIA; we own every pixel.
 *
 * The external API is deliberately UNCHANGED from the former native-select version
 * (`id, label, value, onChange, options, placeholder, icon, disabled`) so call sites did not move.
 * An empty `value` means "nothing chosen" → Radix shows the placeholder (Radix reserves the empty
 * string, so it is mapped to `undefined` for the controlled `value`).
 *
 * WHERE IT FITS: the RM workbench's customer + scheme pickers. Richer per-option context (age,
 * riskometer…) is still shown by the caller beside the field, not inside options.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import { motion, useReducedMotion } from "motion/react";

import { springSnappy } from "../motion";

import { CheckIcon, ChevronDownIcon } from "./icons";

/** One selectable option. */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/** Props for {@link SelectField}. */
interface SelectFieldProps {
  readonly id: string;
  readonly label: string;
  /** Empty string ⇒ the placeholder is shown (mapped to Radix's no-value state). */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  /** Shown when no value is selected. */
  readonly placeholder: string;
  /** Leading glyph, matching TextField. */
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

/** Labelled custom-select dropdown (Radix internals, house styling). */
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  icon,
  disabled,
}: SelectFieldProps) {
  const reduceMotion = useReducedMotion();
  // Controlled open state drives the chevron spring (Radix owns focus/keyboard/typeahead).
  const [open, setOpen] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <Select.Root
        value={value === "" ? undefined : value}
        onValueChange={onChange}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
      >
        <Select.Trigger
          id={id}
          className="field-inset flex h-11 w-full items-center gap-2.5 rounded-lg pr-3 pl-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow,color] hover:border-muted/40 disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-muted"
        >
          {icon && <span className="flex shrink-0 items-center text-muted">{icon}</span>}
          <span className="flex-1 truncate text-left">
            <Select.Value placeholder={placeholder} />
          </span>
          <Select.Icon className="shrink-0 text-muted">
            <motion.span
              className="flex"
              animate={{ rotate: open ? 180 : 0 }}
              transition={reduceMotion ? { duration: 0 } : springSnappy}
            >
              <ChevronDownIcon className="h-4.5 w-4.5" />
            </motion.span>
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className="select-popover glass z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl p-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)]"
          >
            <Select.ScrollUpButton className="flex h-6 items-center justify-center text-muted">
              <ChevronDownIcon className="h-4 w-4 rotate-180" />
            </Select.ScrollUpButton>
            <Select.Viewport className="p-0.5">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-pointer items-center rounded-lg py-2 pr-8 pl-3 text-[14px] text-ink outline-none select-none data-[highlighted]:bg-primary-tint data-[highlighted]:text-primary-bright data-[state=checked]:font-medium data-[state=checked]:text-primary-bright"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-2.5 inline-flex text-primary-bright">
                    <CheckIcon className="h-4 w-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton className="flex h-6 items-center justify-center text-muted">
              <ChevronDownIcon className="h-4 w-4" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
