/**
 * Telling the people who asked to be told.
 *
 * Two promises the platform was making and not keeping.
 *
 * **«خبرم کن».** `NotifySubscription` was write-only: tapping the button stored
 * a row, `listNotifiedEventIds` read it straight back to light the toggle, and
 * nothing ever sent anybody anything. The subscription existed purely to
 * remember that a promise had been made.
 *
 * **Approval decisions.** Someone requests a place at an invite-only event and
 * then waits. The organiser accepts or rejects, and the requester was never
 * told either way — the answer lived only in a dashboard they cannot see.
 *
 * Both **never throw**, on the same reasoning as the other notifiers: an
 * organiser publishing an event or approving a guest must not get a 500 because
 * an SMS operator is having a bad afternoon.
 *
 * Both fire on a **transition**, never on a re-save. Publishing an
 * already-published event, or re-approving an approved request, must not
 * message anyone a second time.
 */

import { db } from "@/lib/server/db";
import { smsGateway } from "@/lib/server/sms";
import { formatJalaliDate, formatNumber, formatTime } from "@/lib/format";
import {
  collaboratorInvitedText,
  registrationAcceptedText,
  registrationRejectedText,
} from "./messages";

export interface NoticeResult {
  attempted: boolean;
  ok: boolean;
  recipients: number;
}

const QUIET: NoticeResult = { attempted: false, ok: false, recipients: 0 };

/**
 * An event people asked about has opened.
 *
 * Only subscribers with a phone on their account can be reached — the
 * subscription is keyed to a `User`, and an account created by OTP always has
 * one, but the join is left explicit rather than assumed.
 */
export async function notifyEventPublished(
  eventId: string,
): Promise<NoticeResult> {
  try {
    const gateway = smsGateway();
    if (!gateway.configured) return QUIET;

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        slug: true,
        sessions: { orderBy: { startAt: "asc" }, take: 1 },
        _count: { select: { ticketTypes: true } },
      },
    });
    if (!event) return QUIET;

    /**
     * Nothing to sell, so nothing to announce.
     *
     * Publishing does not require a ticket type — `updateEvent` writes the
     * status unconditionally, and an organiser may legitimately put a page up
     * before pricing it. This message cannot follow it there: «فروش بلیت آغاز
     * شد» is a claim, and `resolveBuyState` renders the same event as
     * «فروش هنوز شروع نشده» because there is genuinely nothing on sale.
     *
     * So the subscriber was texted that sales had opened, arrived at a page
     * saying they had not, and could do nothing but subscribe again — and the
     * organiser paid per recipient for it. Staying quiet costs nothing: the
     * subscription survives, and the next publish transition still fires.
     */
    if (event._count.ticketTypes === 0) return QUIET;

    const subs = await db.notifySubscription.findMany({
      where: { eventId },
      select: { user: { select: { phone: true } } },
    });
    const phones = [...new Set(subs.map((s) => s.user.phone).filter(Boolean))];
    if (!phones.length) return { attempted: false, ok: true, recipients: 0 };

    const when = event.sessions[0]
      ? `\n${formatJalaliDate(event.sessions[0].startAt.toISOString())} ساعت ${formatTime(event.sessions[0].startAt.toISOString())}`
      : "";

    const result = await gateway.sendBulk(
      phones,
      `خبر دادیم 🔔\n` +
        `${event.title}${when}\n` +
        `فروش بلیت آغاز شد.`,
    );
    return {
      attempted: true,
      ok: result.ok,
      recipients: result.ok ? phones.length : 0,
    };
  } catch (error) {
    console.error("[notify] event-published failed", eventId, error);
    return QUIET;
  }
}

/**
 * The organiser answered a request to attend.
 *
 * Only `accepted` and `rejected` are messaged. Moving a request *back* to
 * pending is an organiser correcting themselves, and "your request is being
 * reconsidered" is not news anyone can act on.
 */
export async function notifyRegistrationDecision(
  registrationId: string,
): Promise<NoticeResult> {
  try {
    const gateway = smsGateway();
    if (!gateway.configured) return QUIET;

    const registration = await db.eventRegistration.findUnique({
      where: { id: registrationId },
      select: {
        phone: true,
        tickets: true,
        status: true,
        event: { select: { id: true, title: true } },
      },
    });
    if (!registration?.phone) return QUIET;

    const accepted = registration.status === "ACCEPTED";
    if (!accepted && registration.status !== "REJECTED") return QUIET;

    const text = accepted
      ? registrationAcceptedText({
          eventTitle: registration.event.title,
          tickets: registration.tickets,
          eventId: registration.event.id,
          appUrl: process.env.APP_URL || undefined,
        })
      : registrationRejectedText({ eventTitle: registration.event.title });

    const result = await gateway.sendBulk([registration.phone], text);
    return {
      attempted: true,
      ok: result.ok,
      recipients: result.ok ? 1 : 0,
    };
  } catch (error) {
    console.error("[notify] registration-decision failed", registrationId, error);
    return QUIET;
  }
}

/**
 * A new request is waiting for the organiser.
 *
 * The other direction of the same conversation: a request that nobody looks at
 * is a guest left hanging, and an approval-gated event only works if someone
 * knows there is something to approve.
 */
export async function notifyRegistrationRequested(
  registrationId: string,
): Promise<NoticeResult> {
  try {
    const gateway = smsGateway();
    if (!gateway.configured) return QUIET;

    const registration = await db.eventRegistration.findUnique({
      where: { id: registrationId },
      select: {
        name: true,
        tickets: true,
        event: {
          select: {
            title: true,
            workspace: {
              select: {
                members: {
                  where: { role: { in: ["OWNER", "ADMIN"] } },
                  select: { user: { select: { phone: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!registration) return QUIET;

    // Owners and admins only, as with a sale: staff run the door and do not
    // decide who gets in.
    const phones = [
      ...new Set(
        registration.event.workspace.members
          .map((m) => m.user.phone)
          .filter(Boolean),
      ),
    ];
    if (!phones.length) return { attempted: false, ok: true, recipients: 0 };

    const result = await gateway.sendBulk(
      phones,
      `درخواست تازه 🙋\n` +
        `${registration.event.title}\n` +
        `${registration.name} · ${formatNumber(registration.tickets)} بلیت\n` +
        `برای تأیید به داشبورد سر بزنید.`,
    );
    return {
      attempted: true,
      ok: result.ok,
      recipients: result.ok ? phones.length : 0,
    };
  } catch (error) {
    console.error("[notify] registration-requested failed", registrationId, error);
    return QUIET;
  }
}

/**
 * Someone has been asked to co-host.
 *
 * `/api/me/invites` and the dashboard's «دعوت‌ها» panel show this, and both
 * require the invitee to think of looking. An invitation nobody knows about is
 * an event with one fewer host at the door.
 *
 * Two channels, two audiences. A **phone** invite names a number directly, and
 * that person may have no account at all — the text is the only way to reach
 * them. A **workspace** invite is addressed to an organisation, so it goes to
 * that workspace's owners and admins, the same set a sale notifies.
 */
export async function notifyCollaboratorInvited(
  collaboratorId: string,
): Promise<NoticeResult> {
  try {
    const gateway = smsGateway();
    if (!gateway.configured) return QUIET;

    const invite = await db.eventCollaborator.findUnique({
      where: { id: collaboratorId },
      select: {
        channel: true,
        sub: true,
        role: true,
        status: true,
        event: { select: { title: true } },
        inviteeWorkspace: {
          select: {
            members: {
              where: { role: { in: ["OWNER", "ADMIN"] } },
              select: { user: { select: { phone: true } } },
            },
          },
        },
      },
    });
    // Only a fresh invitation. Re-saving an accepted one must not ask again.
    if (!invite || invite.status !== "PENDING") return QUIET;

    const phones =
      invite.channel === "PHONE"
        ? [invite.sub].filter(Boolean)
        : [
            ...new Set(
              (invite.inviteeWorkspace?.members ?? [])
                .map((m) => m.user.phone)
                .filter(Boolean),
            ),
          ];
    if (!phones.length) return { attempted: false, ok: true, recipients: 0 };

    const job = invite.role === "CHECKIN" ? "ورودی و پذیرش" : "میزبان همکار";
    const result = await gateway.sendBulk(
      phones,
      collaboratorInvitedText({
        eventTitle: invite.event.title,
        job,
        appUrl: process.env.APP_URL || undefined,
      }),
    );
    return {
      attempted: true,
      ok: result.ok,
      recipients: result.ok ? phones.length : 0,
    };
  } catch (error) {
    console.error("[notify] collaborator-invited failed", collaboratorId, error);
    return QUIET;
  }
}
