/*
This file is used to send emails to user for otp verification
*/
import nodemailer from "nodemailer";

export const sendOtpEmail = async (toEmail: string, otp: string): Promise<boolean> => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if(!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS){
        console.error("SMTP is not setup in ENV");
        return false;
    }
    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 587,
            secure: Number(SMTP_PORT) === 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS.replace(/\s+/g, "")
            }
        });

        await transporter.sendMail({
            from: `"Continew" <${SMTP_USER}>`,
            to: toEmail,
            subject: "Your Continew Verification Code",
            text: `Your verification code is ${otp}. It will expire in 5 minutes.`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #eaeaea; border-radius: 8px;">
                    <h2 style="color: #333;">Verify Your Email</h2>
                    <p>Use the following 6-digit verification code to complete your Continew registration:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 15px; background: #f4f4f5; text-align: center; border-radius: 6px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p style="color: #666; font-size: 14px;">This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
                </div>
            `
        });

        return true;
    } catch (error) {
        console.error("Failed to send OTP email:", error);
        return false;
    }
};
