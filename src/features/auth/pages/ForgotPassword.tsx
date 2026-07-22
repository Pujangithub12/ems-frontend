import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthProvider";
import { getPasswordStrengthError } from "../utils/passwordPolicy";
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ArrowRight,
  MailCheck,
  CheckCircle2,
} from "lucide-react";

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useAuth();
  const nav = useNavigate();

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.forgotPasswordStart(email);
      setStep("reset");
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err.message || "Could not send verification code",
      );
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const passwordError = getPasswordStrengthError(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await auth.forgotPasswordReset({ email, otp, newPassword });
      setStep("done");
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err.message || "Could not reset password",
      );
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError(null);
    setResent(false);
    setResending(true);
    try {
      await auth.forgotPasswordStart(email);
      setResent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="h-screen flex text-[#10141F] overflow-hidden"
      style={{ background: "#F8F9FB" }}
    >
      <main className="relative flex flex-col flex-1 px-6 py-4 overflow-hidden sm:px-10">
        <div className="flex items-center justify-end gap-4">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-[12.5px] font-medium text-[#7A8499] hover:text-[#10141F]"
          >
            Help
          </a>
        </div>

        <div className="flex items-center justify-center flex-1 min-h-0 py-2">
          <div
            className="w-full p-6 pb-5 bg-white rounded-2xl"
            style={{
              maxWidth: 416,
              border: "1px solid #DDE2EB",
              boxShadow:
                "0 1px 2px rgba(16,20,31,0.05), 0 16px 48px rgba(16,20,31,0.09)",
            }}
          >
            <div
              className="inline-flex items-center gap-2.5 rounded-[10px] px-3.5 py-2 mb-4"
              style={{
                border: "1px solid #E4E7ED",
                background: "#F6F8FB",
                boxShadow: "0 1px 2px rgba(16,20,31,0.04)",
              }}
            >
              <div
                className="w-[26px] h-[26px] rounded-[7px] bg-[#1E3A8A] text-white flex items-center justify-center text-[10px] font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                E
              </div>
              <span className="text-[12.5px] text-[#454F63]">EMS workspace sign-in</span>
            </div>

            {step === "email" && (
              <>
                <h2
                  className="font-semibold text-[27px]"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
                >
                  Forgot password
                </h2>
                <p className="text-[#7A8499] text-[13.5px] mt-1 mb-4 leading-relaxed">
                  Enter your account email and we'll send you a 6-digit code to reset your password.
                </p>

                <form onSubmit={submitEmail} className="space-y-3">
                  {error && (
                    <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-md flex items-start gap-2 text-[#B91C1C] text-[13px]">
                      <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label className="block mb-1 text-[12.5px] font-semibold text-[#454F63]">
                      Work email
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      type="email"
                      autoComplete="email"
                      autoFocus
                      className="w-full h-10 px-3.5 bg-white rounded-[10px] text-[14px] text-[#10141F] outline-none transition-all"
                      style={{ border: "1px solid #C6CCD8" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#1E3A8A";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(30,58,138,0.12)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#C6CCD8";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <button
                    disabled={loading}
                    className="w-full h-10 flex items-center justify-center gap-2 text-[14px] font-semibold text-white bg-[#1E3A8A] rounded-[10px] hover:bg-[#19306F] active:translate-y-px disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    style={{ boxShadow: "0 1px 2px rgba(16,20,31,0.2)" }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-4 text-[12.5px] text-[#7A8499] text-center leading-relaxed">
                  Remembered your password?{" "}
                  <Link to="/login" className="font-semibold text-[#1E3A8A] hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            )}

            {step === "reset" && (
              <>
                <div
                  className="w-11 h-11 rounded-[10px] flex items-center justify-center mb-4"
                  style={{ background: "#EAF0FF" }}
                >
                  <MailCheck className="w-5 h-5 text-[#1E3A8A]" />
                </div>
                <h2
                  className="font-semibold text-[27px]"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
                >
                  Enter code & new password
                </h2>
                <p className="text-[#7A8499] text-[13.5px] mt-1 mb-4 leading-relaxed">
                  We sent a 6-digit code to <b className="text-[#454F63]">{email}</b>. Enter it
                  below along with your new password.
                </p>

                <form onSubmit={submitReset} className="space-y-3">
                  {error && (
                    <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-md flex items-start gap-2 text-[#B91C1C] text-[13px]">
                      <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  {resent && !error && (
                    <div className="p-3 bg-[#DCFCE7] border border-[#BBF7D0] rounded-md flex items-start gap-2 text-[#15803D] text-[13px]">
                      <MailCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>A new code has been sent.</span>
                    </div>
                  )}

                  <div>
                    <label className="block mb-1 text-[12.5px] font-semibold text-[#454F63]">
                      Verification code
                    </label>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="123456"
                      autoFocus
                      className="w-full h-10 px-3.5 bg-white rounded-[10px] text-[18px] tracking-[0.3em] text-center text-[#10141F] outline-none transition-all"
                      style={{ border: "1px solid #C6CCD8" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#1E3A8A";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(30,58,138,0.12)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#C6CCD8";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-[12.5px] font-semibold text-[#454F63]">
                      New password
                    </label>
                    <div className="relative">
                      <input
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="w-full h-10 pl-3.5 pr-11 bg-white rounded-[10px] text-[14px] text-[#10141F] outline-none transition-all"
                        style={{ border: "1px solid #C6CCD8" }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#1E3A8A";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(30,58,138,0.12)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#C6CCD8";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[7px] flex items-center justify-center text-[#7A8499] hover:bg-[#F1F3F8] hover:text-[#454F63] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-[12.5px] font-semibold text-[#454F63]">
                      Confirm new password
                    </label>
                    <input
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="w-full h-10 px-3.5 bg-white rounded-[10px] text-[14px] text-[#10141F] outline-none transition-all"
                      style={{ border: "1px solid #C6CCD8" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#1E3A8A";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(30,58,138,0.12)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#C6CCD8";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <button
                    disabled={loading || otp.length !== 6}
                    className="w-full h-10 flex items-center justify-center gap-2 text-[14px] font-semibold text-white bg-[#1E3A8A] rounded-[10px] hover:bg-[#19306F] active:translate-y-px disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    style={{ boxShadow: "0 1px 2px rgba(16,20,31,0.2)" }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Reset password</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-4 text-[12.5px] text-[#7A8499] text-center leading-relaxed">
                  Didn't get a code?{" "}
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={resending}
                    className="font-semibold text-[#1E3A8A] hover:underline disabled:opacity-60"
                  >
                    {resending ? "Resending…" : "Resend"}
                  </button>
                  <span className="mx-1.5">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setError(null);
                      setResent(false);
                    }}
                    className="font-semibold text-[#1E3A8A] hover:underline"
                  >
                    Change email
                  </button>
                </p>
              </>
            )}

            {step === "done" && (
              <>
                <div
                  className="w-11 h-11 rounded-[10px] flex items-center justify-center mb-4"
                  style={{ background: "#DCFCE7" }}
                >
                  <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
                </div>
                <h2
                  className="font-semibold text-[27px]"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
                >
                  Password reset
                </h2>
                <p className="text-[#7A8499] text-[13.5px] mt-1 mb-4 leading-relaxed">
                  Your password has been changed and you're signed in.
                </p>
                <button
                  onClick={() => nav("/")}
                  className="w-full h-10 flex items-center justify-center gap-2 text-[14px] font-semibold text-white bg-[#1E3A8A] rounded-[10px] hover:bg-[#19306F] active:translate-y-px transition-all"
                  style={{ boxShadow: "0 1px 2px rgba(16,20,31,0.2)" }}
                >
                  <span>Go to dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div
          className="flex justify-center items-center gap-1.5 text-[10px]"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#A6AFC0" }}
        >
          <span>© {new Date().getFullYear()} EMS</span>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
