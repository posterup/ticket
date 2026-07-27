"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Select as HeroSelect, ListBox, ListBoxItem } from "@heroui/react";

import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

interface Opt {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

/** Recursively collect <option> descendants (handles fragments + mapped arrays). */
function collectOptions(children: React.ReactNode, acc: Opt[] = []): Opt[] {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === "option") {
      const p = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
      acc.push({
        value: String(p.value ?? ""),
        label: p.children,
        disabled: p.disabled,
      });
    } else if (child.type === React.Fragment) {
      collectOptions(
        (child.props as { children?: React.ReactNode }).children,
        acc,
      );
    }
  });
  return acc;
}

/**
 * Select — HeroUI's accessible <Select> (React Aria) under the hood, but
 * exposing the native `<select value onChange><option/></select>` API so no
 * call site has to change. An `<option value="">…</option>` becomes the
 * placeholder (React Aria's no-selection state); other options become ListBox
 * items. `onChange` receives a synthetic `{ target: { value } }` event.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      className,
      children,
      value,
      onChange,
      disabled,
      id,
      name,
      "aria-invalid": ariaInvalid,
      "aria-label": ariaLabel,
    },
    _ref,
  ) {
    const options = collectOptions(children);
    const placeholder = options.find((o) => o.value === "");
    const items = options.filter((o) => o.value !== "");
    const selected = value != null ? String(value) : "";

    return (
      <HeroSelect
        id={id}
        name={name}
        aria-label={ariaLabel}
        isDisabled={disabled}
        isInvalid={ariaInvalid === true || ariaInvalid === "true"}
        placeholder={typeof placeholder?.label === "string" ? placeholder.label : "انتخاب…"}
        selectedKey={selected === "" ? null : selected}
        onSelectionChange={(key) => {
          const v = key == null ? "" : String(key);
          onChange?.({
            target: { value: v },
            currentTarget: { value: v },
          } as unknown as React.ChangeEvent<HTMLSelectElement>);
        }}
      >
        <HeroSelect.Trigger
          className={cn(
            "flex h-12 w-full items-center justify-between gap-2 rounded-md border border-border bg-card ps-3.5 pe-3 text-sm text-foreground outline-none transition-colors",
            "hover:border-border-strong data-[focused]:border-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring/15",
            "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
            className,
          )}
        >
          <HeroSelect.Value className="truncate text-start data-[placeholder]:text-faint" />
          <ChevronDown className="size-4 shrink-0 text-faint" aria-hidden />
        </HeroSelect.Trigger>
        <HeroSelect.Popover className="w-[var(--trigger-width)]">
          <ListBox>
            {items.map((o) => (
              <ListBoxItem key={o.value} id={o.value} isDisabled={o.disabled}>
                {o.label}
              </ListBoxItem>
            ))}
          </ListBox>
        </HeroSelect.Popover>
      </HeroSelect>
    );
  },
);
Select.displayName = "Select";

export { Select };
