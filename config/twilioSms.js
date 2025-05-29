import twilio from "twilio";
import { TWILIO_ACCOUNT_ID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER } from "./env.js";
import logger from "../utils/logger.js"
const client = twilio(
  TWILIO_ACCOUNT_ID,
  TWILIO_AUTH_TOKEN
);

export async function sendSMS(to, message) {
    try {
      const res = await client.messages.create({
        body: message,
        from: TWILIO_NUMBER,
        to,
      });
      logger.info(`SMS sent successfully`, {
        to,
        sid: res.sid,
        message,
      });
      return { success: true, sid: res.sid };
    } catch (err) {
        logger.error(`SMS sending failed`, {
        to,
        error: err.message,
        stack: err.stack,
      });
      return { success: false, error: err.message };
    }
  }