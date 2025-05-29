import nodemailer from 'nodemailer'
import { SMTP_PASS, SMTP_SENDER, SMTP_SERVER, SMTP_USER } from './env.js'
export const transporter = nodemailer.createTransport({
  host: SMTP_SERVER,
  port: 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
})

export const sendMail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `Ayurfresh <${SMTP_SENDER}>`,
      to,
      subject,
      html
    })
  } catch (error) {
    console.error('Email Error:', error)
  }
}