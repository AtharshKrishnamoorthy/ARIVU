import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, message } = body;

    if (!firstName || !email || !message) {
      return NextResponse.json(
        { error: "First name, email, and message are required." },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,   // Gmail → use an App Password
      },
    });

    await transporter.sendMail({
      from: `"Arivu Contact Form" <${process.env.SMTP_USER}>`,
      to: "atharshkrishnamoorthy@gmail.com",
      replyTo: email,
      subject: `[Arivu] New message from ${firstName} ${lastName || ""}`.trim(),
      text: [
        `Name: ${firstName} ${lastName || ""}`,
        `Email: ${email}`,
        ``,
        `Message:`,
        message,
      ].join("\n"),
      html: `
        <div style="font-family:sans-serif;max-width:520px">
          <h2 style="margin:0 0 16px">New Contact Submission</h2>
          <p><strong>Name:</strong> ${firstName} ${lastName || ""}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
          <p>${message.replace(/\n/g, "<br/>")}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Contact form error:", err);
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
