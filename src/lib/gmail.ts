/** Opens Gmail's web compose window pre-filled with To/Subject/Body. Gmail's compose URL has no
 * way to attach a file (no browser lets a page hand another site's tab a file to attach, for
 * obvious security reasons) — the PDF itself still has to be attached by hand from "Preview PDF"
 * / its Download button. Shared by the Purchase Order and Proforma Invoice pages. */
export const openGmailCompose = (to: string, subject: string, body: string) => {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer");
};
