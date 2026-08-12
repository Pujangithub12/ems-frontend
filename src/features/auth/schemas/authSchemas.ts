import { z } from "zod";
import { getPasswordStrengthError } from "../utils/passwordPolicy";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

const passwordField = z.string().superRefine((value, ctx) => {
  const error = getPasswordStrengthError(value);
  if (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  }
});

export const createAccountDetailsSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type CreateAccountDetailsValues = z.infer<typeof createAccountDetailsSchema>;

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, "Enter the 6-digit code")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});
export type OtpFormValues = z.infer<typeof otpSchema>;
