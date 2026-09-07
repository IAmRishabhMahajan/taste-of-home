const sender = process.env.RSVP_EMAIL_FROM ?? "A Taste of Home <onboarding@resend.dev>";
const eventStart = "20261121T183000";
const eventEnd = "20261121T223000";
const eventLocation = "NCPV MCR, 215A Anzac Parade, Kensington NSW 2033";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeIcs(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r?\n/g, "\\n");
}

function buildCalendarInvite(rsvp: {
  id: number;
  name: string;
  contact: string;
  dishName: string;
  dishMemory: string;
}) {
  const description = [
    "Shay's Friendsgiving Dinner",
    `Guest: ${rsvp.name}`,
    rsvp.dishName ? `Bringing: ${rsvp.dishName}` : "",
    rsvp.dishMemory ? `Story: ${rsvp.dishMemory}` : "",
  ].filter(Boolean).join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//A Taste of Home//Friendsgiving//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:rsvp-${rsvp.id}@a-taste-of-home`,
    `DTSTAMP:${eventStart}Z`,
    `DTSTART;TZID=Australia/Sydney:${eventStart}`,
    `DTEND;TZID=Australia/Sydney:${eventEnd}`,
    `SUMMARY:${escapeIcs("Shay's Friendsgiving Dinner")}`,
    `LOCATION:${escapeIcs(eventLocation)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `ATTENDEE;CN=${escapeIcs(rsvp.name)};RSVP=TRUE:mailto:${rsvp.contact}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function detailsList(rsvp: {
  dishName: string;
  dishOrigin: string;
  dishMemory: string;
  guestDietary: string[];
  guestAllergies: string;
  dishIngredients: string;
  dishDietary: string[];
}) {
  return [
    ["Bringing", rsvp.dishName],
    ["Where it comes from", rsvp.dishOrigin],
    ["What it reminds you of", rsvp.dishMemory],
    ["Your dietary requirements", rsvp.guestDietary.join(", ")],
    ["Allergies", rsvp.guestAllergies],
    ["Dish ingredients", rsvp.dishIngredients],
    ["Dish labels", rsvp.dishDietary.join(", ")],
  ].filter(([, value]) => value).map(([label, value]) => (
    `<tr><td style="padding:6px 16px 6px 0;color:#65706a;font-size:13px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:#1f3d35;font-size:14px">${escapeHtml(value)}</td></tr>`
  )).join("");
}

export async function sendRsvpConfirmation(rsvp: {
  id: number;
  name: string;
  contact: string;
  attending: boolean;
  dishName: string;
  dishOrigin: string;
  dishMemory: string;
  guestDietary: string[];
  guestAllergies: string;
  dishIngredients: string;
  dishDietary: string[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set. Add it to the environment before sending email.");
  }

  const greetingName = escapeHtml(rsvp.name.split(/\s+/)[0] || rsvp.name);
  const attendanceCopy = rsvp.attending
    ? "Your place is saved, and your calendar invite is attached."
    : "We’re sorry you can’t make it this time. We’ve saved your response for Shay.";
  const attachments = rsvp.attending
    ? [{
        filename: "shays-friendsgiving-dinner.ics",
        content: Buffer.from(buildCalendarInvite(rsvp), "utf8").toString("base64"),
      }]
    : [];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: sender,
      to: [rsvp.contact],
      subject: rsvp.attending
        ? "Your RSVP · Shay’s Friendsgiving Dinner"
        : "Your RSVP response · Shay’s Friendsgiving Dinner",
      text: [
        `Hi ${rsvp.name},`,
        "",
        "Here is a copy of your A Taste of Home RSVP.",
        attendanceCopy,
        "",
        `Date: Saturday, 21 November 2026`,
        "Time: 6:30 pm onwards",
        `Location: ${eventLocation}`,
        "",
        "Your answers:",
        `Bringing: ${rsvp.dishName || "No dish recorded"}`,
        `Dietary requirements: ${rsvp.guestDietary.join(", ") || "None shared"}`,
        `Allergies: ${rsvp.guestAllergies || "None shared"}`,
        "",
        "A taste of home",
      ].join("\n"),
      html: `<div style="background:#f7f0e2;padding:32px 16px;font-family:Arial,sans-serif;color:#1f3d35"><div style="max-width:580px;margin:0 auto;background:#fffdf8;border:1px solid #e2d5bf;border-radius:18px;padding:32px"><p style="color:#c95338;font-size:11px;letter-spacing:2px;text-transform:uppercase">A taste of home</p><h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.05;margin:14px 0;color:#1f3d35">You’re on the guest list, ${greetingName}.</h1><p style="font-size:16px;line-height:1.6;color:#65706a">${escapeHtml(attendanceCopy)}</p><div style="border-top:1px solid #e2d5bf;border-bottom:1px solid #e2d5bf;padding:18px 0;margin:24px 0"><p style="margin:0 0 6px;font-weight:bold">Shay’s Friendsgiving Dinner</p><p style="margin:0;color:#65706a;font-size:14px;line-height:1.6">Saturday, 21 November 2026<br>6:30 pm onwards<br>${escapeHtml(eventLocation)}</p></div><h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 10px">Your answers</h2><table style="border-collapse:collapse;width:100%">${detailsList(rsvp)}</table><p style="margin:28px 0 0;color:#65706a;font-size:13px;line-height:1.6">Keep this email for your records. The calendar invite is attached so the details can travel with you.</p></div></div>`,
      ...(attachments.length > 0 ? { attachments } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend returned ${response.status}: ${body.slice(0, 400)}`);
  }
}