import type { Metadata } from "next";

import { listAttendees } from "@/lib/server";

export const metadata: Metadata = { title: "مشتریان | پوستر" };

export default function CustomersPage() {
  const attendees = listAttendees();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          مشتریان
        </h1>
        <p className="mt-1 text-sm text-muted">
          فهرست مخاطبان و مشتریان رویدادهای شما.
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border bg-subtle text-xs text-muted">
              <th className="px-5 py-3 text-start font-medium">نام</th>
              <th className="px-5 py-3 text-start font-medium">شماره تماس</th>
              <th className="px-5 py-3 text-start font-medium">ایمیل</th>
              <th className="px-5 py-3 text-start font-medium">برچسب‌ها</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {attendees.map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-4 font-medium text-foreground">
                  {a.fullName}
                </td>
                <td className="px-5 py-4 text-muted" dir="ltr">
                  {a.phone}
                </td>
                <td className="px-5 py-4 text-muted" dir="ltr">
                  {a.email ?? "—"}
                </td>
                <td className="px-5 py-4">
                  <TagList tags={a.tags} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {attendees.map((a) => (
          <li key={a.id} className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">{a.fullName}</p>
            <p className="mt-1 text-xs text-muted" dir="ltr">
              {a.phone}
            </p>
            {a.email ? (
              <p className="mt-0.5 text-xs text-muted" dir="ltr">
                {a.email}
              </p>
            ) : null}
            <div className="mt-3">
              <TagList tags={a.tags} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TagList({ tags }: { tags: { id: string; label: string }[] }) {
  if (tags.length === 0) return <span className="text-faint">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t.id}
          className="rounded-full border border-border bg-subtle px-2 py-0.5 text-xs text-muted"
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}
