import { generateSecret, generateURI, verifySync } from "otplib";
import { SITE_NAME } from "@/lib/constants";

export function generateTotpSecret() {
  return generateSecret();
}

export function getTotpUri(email: string, secret: string) {
  return generateURI({
    issuer: SITE_NAME,
    label: email,
    secret,
  });
}

export function verifyTotpCode(secret: string, code: string) {
  const result = verifySync({
    secret,
    token: code.replace(/\s/g, ""),
  });
  return result.valid === true;
}
