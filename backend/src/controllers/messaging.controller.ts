import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  isTwilioWhatsAppEnabled,
  sendWhatsAppMessage,
} from "../services/twilio-sms.service.js";

const postWhatsAppSchema = z
  .object({
    phone: z.string().min(8).max(32),
    /** Free-form body (session messages / sandbox). */
    message: z.string().min(1).max(4096).optional(),
    /** Twilio Content Template SID (HX…). Mutually exclusive with `message`. */
    contentSid: z.string().min(1).optional(),
    /** Template variables; serialized to JSON for Twilio (e.g. { "1": "22 July 2026", "2": "3:15pm" }). */
    contentVariables: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    const hasBody = Boolean(val.message?.trim());
    const hasTpl = Boolean(val.contentSid?.trim());
    const msg =
      "Provide exactly one of: `message` (plain text) or `contentSid` (approved WhatsApp template from Twilio Content).";
    if (hasBody && hasTpl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["contentSid"] });
    } else if (!hasBody && !hasTpl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["message"] });
    }
  });

export async function postWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    const body = postWhatsAppSchema.parse(req.body);
    if (!isTwilioWhatsAppEnabled()) {
      res.status(503).json({
        data: null,
        error: {
          message:
            "WhatsApp is not configured. Set TWILIO_WHATSAPP_FROM (e.g. whatsapp:+14155238886 for the sandbox) alongside your Twilio account credentials.",
          code: "WHATSAPP_NOT_CONFIGURED",
        },
      });
      return;
    }
    if (body.message) {
      await sendWhatsAppMessage(body.phone, body.message);
    } else {
      await sendWhatsAppMessage(body.phone, {
        contentSid: body.contentSid!,
        contentVariables: body.contentVariables,
      });
    }
    res.json({ data: { ok: true as const }, error: null });
  } catch (e) {
    next(e);
  }
}
