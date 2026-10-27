"use client";
import { PhoneAuthScreen } from "./phone-auth-screen";

// Public login and signup use only a mobile number and OTP.
export function AuthScreen() {
  return <PhoneAuthScreen />;
}
