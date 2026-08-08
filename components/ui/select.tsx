"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { ListBox, ListBoxItem, Select as HeroSelect } from "@heroui/react";

import { cn } from "@/lib/utils";

export interface SelectProps {
  id?: string;
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /** `<option>` elements, as a native select takes. */
  children: React.ReactNode;
}

interface OptionSpec {
  value: string;
  /** The option's children, rendered as-is in the list. */
  node: React.ReactNode;
  /** Flattened text, for the trigger and for React Aria's type-ahead. */
  text: string;
  disabled?: boolean;
}

/**
 * An option's visible text, flattened.
 *
 * Not `typeof children === "string"`: plenty of these options are composed —
 * `{t.name} · {formatToman(t.price)}` — and arrive as an array of strings.
 * Treating a non-string as unlabelled rendered those selects blank. Numbers
 * count, because `formatNumber` returns one.
 */
function toText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toText).join("");
  if (React.isValidElement(node)) {
    return toText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Read `<option>` children into plain data.
 *
 * The call sites build their options with `.map()` over real arrays, so the
 * children arrive as nested fragments and arrays; `React.Children.toArray`
 * flattens one level and `<>…</>` groups need walking too. An option with no
 * explicit `value` falls back to its text, which is what a native `<select>`
 * does.
 */
function readOptions(children: React.ReactNode): OptionSpec[] {
  const out: OptionSpec[] = [];
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child)) continue;
    if (child.type === React.Fragment) {
      out.push(
        ...readOptions((child.props as { children?: React.ReactNode }).children),
      );
      continue;
    }
    if (child.type !== "option") continue;
    const props = child.props as {
      value?: string | number;
      children?: React.ReactNode;
      disabled?: boolean;
    };
    const text = toText(props.children).trim();
    out.push({
      value: props.value != null ? String(props.value) : text,
      node: props.children,
      text,
      disabled: props.disabled,
    });
  }
  return out;
}

/**
 * Single-choice select, as a HeroUI listbox.
 *
 * **The API is deliberately still the native one** — `<option>` children in,
 * `onChange={e => e.target.value}` out — so none of the eleven call sites
 * changed. React Aria wants `<ListBoxItem>` children and `onSelectionChange`;
 * the translation lives here rather than in eleven files, which is exactly what
 * `CLAUDE.md` means by "thin HeroUI wrappers that exist for backward-compatible
 * APIs".
 *
 * **What genuinely changes is the control.** A native `<select>` opens the OS
 * picker — a full-screen wheel on a phone, which is free and excellent. This
 * opens an in-page popover instead. The trade is deliberate: consistent brand
 * styling on every viewport, keyboard type-ahead, a real focus ring, and room
 * for search or sectioned options later, at the cost of owning the popover.
 *
 * `disabled`, not `isDisabled`: the wrapper speaks the native dialect and
 * converts inward, same as `onChange`.
 */
const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ id, value, onChange, disabled, className, children, ...props }, ref) => {
    const options = readOptions(children);
    const selected = options.find((o) => o.value === value);

    return (
      <HeroSelect
        ref={ref}
        id={id}
        aria-label={props["aria-label"]}
        isDisabled={disabled}
        // `?? null` and not `?? undefined`: React Aria reads `undefined` as
        // "uncontrolled" and would quietly stop honouring `value`, so a select
        // whose value is cleared would keep showing the old label.
        selectedKey={value ?? null}
        onSelectionChange={(key) =>
          onChange?.({ target: { value: key == null ? "" : String(key) } })
        }
        className={cn("w-full", className)}
      >
        <HeroSelect.Trigger
          className={cn(
            "flex h-12 w-full items-center justify-between gap-2 rounded-md border border-field-border bg-card ps-3.5 pe-3.5 text-start text-sm",
            "outline-none transition-colors",
            "hover:border-foreground/50 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/15",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {/* Not `<HeroSelect.Value>`: it renders the *item's* rendered children,
              and the placeholder colour has to differ from a chosen value. */}
          <span className={cn("truncate", selected ? "text-foreground" : "text-faint")}>
            {selected?.text ?? ""}
          </span>
          <ChevronDown className="size-4 shrink-0 text-faint" aria-hidden />
        </HeroSelect.Trigger>
        {/* No `bg-*` here. `--card` is `rgba(255,255,255,0.72)` — glass, meant
            to sit over the page glow — and setting it on a popover made the map
            and the fields behind the list show straight through it. HeroUI's own
            popover reads `--overlay`, which `globals.css` defines as opaque
            precisely "for popovers/menus/modals (readability)". */}
        <HeroSelect.Popover className="w-[--trigger-width] p-1">
          <ListBox>
            {options.map((o) => (
              <ListBoxItem
                key={o.value}
                id={o.value}
                isDisabled={o.disabled}
                // React Aria needs this when the children are not a bare
                // string, or type-ahead has nothing to match against.
                textValue={o.text}
                // `data-[focused]` and not `focus-visible:`: React Aria moves a
                // roving focus through the list without the DOM focus ever
                // leaving the listbox, so the CSS pseudo-class never fires. The
                // ring is the same `--ring` every other control uses, because a
                // background tint alone is not a focus indicator.
                className="cursor-pointer rounded-sm px-3 py-2 text-sm text-foreground outline-none transition-colors data-[disabled]:opacity-50 data-[focused]:bg-subtle data-[focused]:ring-2 data-[focused]:ring-ring/15 data-[selected]:font-medium"
              >
                {o.node}
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
