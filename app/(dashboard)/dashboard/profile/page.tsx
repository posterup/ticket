import type { Metadata } from "next";
import { Building2, Mail, Phone } from "lucide-react";

export const metadata: Metadata = { title: "پروفایل | پوستر" };

// Placeholder organizer profile until authentication and workspaces land (#15).
const ORGANIZER = {
  name: "استودیو رویداد آوا",
  role: "برگزارکننده",
  email: "team@avarooydad.example.com",
  phone: "+982188889999",
  initials: "آ",
};

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          پروفایل
        </h1>
        <p className="mt-1 text-sm text-muted">
          اطلاعات حساب و فضای کاری شما.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-foreground text-lg font-bold text-background">
            {ORGANIZER.initials}
          </span>
          <div>
            <p className="text-base font-semibold text-foreground">
              {ORGANIZER.name}
            </p>
            <p className="mt-0.5 text-sm text-muted">{ORGANIZER.role}</p>
          </div>
        </div>

        <dl className="mt-6 flex flex-col gap-4 border-t border-border pt-6 text-sm">
          <div className="flex items-center gap-3">
            <Mail className="size-4 text-faint" aria-hidden />
            <dt className="sr-only">ایمیل</dt>
            <dd className="text-muted" dir="ltr">
              {ORGANIZER.email}
            </dd>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="size-4 text-faint" aria-hidden />
            <dt className="sr-only">تلفن</dt>
            <dd className="text-muted" dir="ltr">
              {ORGANIZER.phone}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-subtle p-4">
        <Building2 className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
        <div className="text-sm">
          <p className="font-medium text-foreground">فضای کاری</p>
          <p className="mt-1 text-muted">
            به‌زودی می‌توانید فضای کاری شخصی و سازمانی بسازید، دنبال‌کنندگان
            داشته باشید و رویدادها را بین فضاهای کاری مدیریت کنید.
          </p>
        </div>
      </div>
    </div>
  );
}
