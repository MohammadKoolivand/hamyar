"use client";
import React from "react";
import { PhoneAuthScreen } from "./phone-auth-screen";
export function AuthScreen(props: {
  mode: string;
  name: string;
  email: string;
  password: string;
  token: string;
  busy: boolean;
  feedback: React.ReactNode;
  auth: (e: React.FormEvent) => void;
  setMode: (value: string) => void;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setToken: (value: string) => void;
}) {
  void props;
  return <PhoneAuthScreen />;
}
