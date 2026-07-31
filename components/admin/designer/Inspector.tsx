"use client";

/**
 * Section properties.
 *
 * Everything that makes a section sellable: what it is called, how it prices
 * (tier), and — the part that actually produces inventory — the row generator
 * and numbering scheme. Edits land in the reducer immediately, and the canvas
 * regenerates seats from the same code publish uses, so the operator is always
 * looking at the real output.
 */

import { cloneElement } from "react";
import type * as React from "react";

import { formatNumber } from "@/lib/format";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { generateSection } from "@/lib/venues/spec";
import type { SectionSpec } from "@/types";

interface Props {
  section: SectionSpec;
  onChange: (patch: Partial<SectionSpec>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMirror: (axis: "horizontal" | "vertical") => void;
  onRotate: (deg: number) => void;
  onResize: (sx: number, sy: number) => void;
}

/**
 * Section fills.
 *
 * Every one clears 4.5:1 against white, because the overview paints the section
 * name in white on top of the fill. An operator should not be able to pick a
 * colour that makes their own venue unreadable.
 */
const COLORS = [
  "#e10d7d",
  "#1b6df5",
  "#8553f6",
  "#08865c",
  "#a76607",
  "#e12a30",
];

/**
 * Field + control id wiring.
 *
 * `Field` links its label to a control by id, so the id has to reach the input
 * too. Deriving both from one `name` keeps them from drifting apart.
 */
function F({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: React.ReactElement;
}) {
  const id = `section-${name}`;
  return (
    <Field id={id} label={label} hint={hint}>
      {cloneElement(children as React.ReactElement<{ id?: string }>, { id })}
    </Field>
  );
}

export function Inspector({
  section,
  onChange,
  onRemove,
  onDuplicate,
  onMirror,
  onRotate,
  onResize,
}: Props) {
  const rows = section.rows;
  const generated = section.kind === "seated" ? generateSection(section) : null;

  const patchRows = (patch: Partial<NonNullable<SectionSpec["rows"]>>) => {
    if (!rows) return;
    onChange({ rows: { ...rows, ...patch } });
  };

  const patchNumbering = (
    patch: Partial<NonNullable<SectionSpec["rows"]>["numbering"]>,
  ) => {
    if (!rows) return;
    onChange({ rows: { ...rows, numbering: { ...rows.numbering, ...patch } } });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">ویژگی‌های بخش</h3>
        {generated ? (
          <span className="text-xs text-muted">
            {formatNumber(generated.seats.length)} صندلی
          </span>
        ) : null}
      </div>

      <F name="name" label="نام">
        <Input
          value={section.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </F>

      <F name="key" label="شناسه (در آدرس‌ها)" hint="فقط حروف کوچک، عدد و خط تیره">
        <Input
          value={section.key}
          dir="ltr"
          onChange={(e) =>
            onChange({
              key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
            })
          }
        />
      </F>

      <div className="grid grid-cols-2 gap-3">
        <F name="kind" label="نوع">
          <Select
            value={section.kind}
            onChange={(e) =>
              onChange({ kind: e.target.value as SectionSpec["kind"] })
            }
          >
            <option value="seated">صندلی‌دار</option>
            <option value="standing">ایستاده</option>
          </Select>
        </F>

        <F name="tier" label="رده نزدیکی" hint="۱ نزدیک‌ترین">
          <Input
            type="number"
            min={1}
            max={20}
            value={section.tier}
            onChange={(e) =>
              onChange({ tier: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </F>
      </div>

      <F name="color" label="رنگ">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`رنگ ${c}`}
              onClick={() => onChange({ color: c })}
              style={{ background: c }}
              className={
                section.color === c
                  ? "size-7 rounded-full ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : "size-7 rounded-full"
              }
            />
          ))}
        </div>
      </F>

      {section.kind === "standing" ? (
        <F name="capacity" label="ظرفیت">
          <Input
            type="number"
            min={1}
            value={section.capacity ?? 0}
            onChange={(e) => onChange({ capacity: Number(e.target.value) || 0 })}
          />
        </F>
      ) : null}

      {rows ? (
        <>
          <div className="border-t border-border pt-3">
            <h4 className="mb-3 text-xs font-bold text-muted">ردیف‌ها</h4>
            <div className="grid grid-cols-2 gap-3">
              <F name="rowCount" label="تعداد ردیف">
                <Input
                  type="number"
                  min={1}
                  max={400}
                  value={rows.count}
                  onChange={(e) =>
                    patchRows({ count: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </F>
              <F name="seatsPerRow" label="صندلی در ردیف">
                <Input
                  type="number"
                  min={1}
                  max={400}
                  value={
                    typeof rows.seatsPerRow === "number"
                      ? rows.seatsPerRow
                      : rows.seatsPerRow[0]
                  }
                  onChange={(e) =>
                    patchRows({
                      seatsPerRow: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
              </F>
              <F name="rowSpacing" label="فاصله ردیف">
                <Input
                  type="number"
                  min={1}
                  value={Math.round(rows.spacing)}
                  onChange={(e) =>
                    patchRows({ spacing: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </F>
              <F name="seatSpacing" label="فاصله صندلی">
                <Input
                  type="number"
                  min={1}
                  value={Math.round(rows.seatSpacing)}
                  onChange={(e) =>
                    patchRows({
                      seatSpacing: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
              </F>
              <F name="angle" label="چرخش ردیف (درجه)">
                <Input
                  type="number"
                  value={Math.round(rows.angle)}
                  onChange={(e) => patchRows({ angle: Number(e.target.value) || 0 })}
                />
              </F>
              <F name="curve" label="قوس" hint="۰ صاف">
                <Input
                  type="number"
                  step="0.01"
                  value={rows.curve}
                  onChange={(e) => patchRows({ curve: Number(e.target.value) || 0 })}
                />
              </F>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <h4 className="mb-3 text-xs font-bold text-muted">شماره‌گذاری</h4>
            <div className="grid grid-cols-2 gap-3">
              <F name="rowScheme" label="حروف ردیف">
                <Select
                  value={rows.numbering.rowScheme}
                  onChange={(e) =>
                    patchNumbering({
                      rowScheme: e.target
                        .value as typeof rows.numbering.rowScheme,
                    })
                  }
                >
                  <option value="latin">A, B, C</option>
                  <option value="numeric">۱, ۲, ۳</option>
                  <option value="persian-alpha">الف, ب, پ</option>
                </Select>
              </F>

              <F name="rowDirection" label="ترتیب ردیف">
                <Select
                  value={rows.numbering.rowDirection}
                  onChange={(e) =>
                    patchNumbering({
                      rowDirection: e.target
                        .value as typeof rows.numbering.rowDirection,
                    })
                  }
                >
                  <option value="front-to-back">از جلو به عقب</option>
                  <option value="back-to-front">از عقب به جلو</option>
                </Select>
              </F>

              <F name="seatScheme" label="روش صندلی">
                <Select
                  value={rows.numbering.seatScheme}
                  onChange={(e) =>
                    patchNumbering({
                      seatScheme: e.target
                        .value as typeof rows.numbering.seatScheme,
                    })
                  }
                >
                  <option value="sequential">پشت‌سرهم</option>
                  <option value="odd-even">فرد و زوج</option>
                  <option value="block">بلوکی</option>
                </Select>
              </F>

              {/* Authored, never inferred from document direction — Iranian
                  venues disagree with each other about this. */}
              <F name="seatOrigin" label="صندلی ۱ از سمت">
                <Select
                  value={rows.numbering.seatOrigin}
                  onChange={(e) =>
                    patchNumbering({
                      seatOrigin: e.target
                        .value as typeof rows.numbering.seatOrigin,
                    })
                  }
                >
                  <option value="right">راست</option>
                  <option value="left">چپ</option>
                </Select>
              </F>

              <F name="seatStart" label="شروع از">
                <Input
                  type="number"
                  min={0}
                  value={rows.numbering.seatStart}
                  onChange={(e) =>
                    patchNumbering({ seatStart: Number(e.target.value) || 0 })
                  }
                />
              </F>

              <F name="skip" label="شماره‌های حذف‌شده" hint="با کاما">
                <Input
                  dir="ltr"
                  value={(rows.numbering.skip ?? []).join(",")}
                  onChange={(e) =>
                    patchNumbering({
                      skip: e.target.value
                        .split(",")
                        .map((v) => Number(v.trim()))
                        .filter((v) => Number.isFinite(v) && v > 0),
                    })
                  }
                />
              </F>
            </div>

            {generated?.rows.length ? (
              <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
                پیش‌نمایش: ردیف {generated.rows[0].label} — صندلی‌های{" "}
                {generated.seats
                  .slice(0, 4)
                  .map((s) => s.label)
                  .join("، ")}
                …
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="border-t border-border pt-3">
        <h4 className="mb-2 text-xs font-bold text-muted">تبدیل‌ها</h4>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onRotate(15)}>
            چرخش ۱۵°
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onRotate(-15)}>
            چرخش ‎−۱۵°
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onResize(1.1, 1.1)}>
            بزرگ‌تر
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onResize(0.9, 0.9)}>
            کوچک‌تر
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onMirror("horizontal")}>
            قرینه افقی
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onMirror("vertical")}>
            قرینه عمودی
          </Button>
          <Button size="sm" variant="secondary" onClick={onDuplicate}>
            تکثیر
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            حذف بخش
          </Button>
        </div>
      </div>
    </div>
  );
}
