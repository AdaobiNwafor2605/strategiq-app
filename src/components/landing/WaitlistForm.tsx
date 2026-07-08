import React, { useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TALLY_FORM_URL = import.meta.env.VITE_TALLY_FORM_URL ?? '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

interface WaitlistFormProps {
  inputId: string;
  variant?: 'default' | 'cta';
}

export const WaitlistForm: React.FC<WaitlistFormProps> = ({ inputId, variant = 'default' }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!EMAIL_RE.test(trimmed)) {
      setStatus("That email doesn't look right — mind checking it?");
      setStatusType('error');
      return;
    }

    if (TALLY_FORM_URL) {
      window.open(TALLY_FORM_URL, '_blank', 'noopener,noreferrer');
      setStatus('Opening the sign-up form…');
      setStatusType('success');
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setStatus('Waitlist is not configured yet. Please try again soon.');
      setStatusType('error');
      return;
    }

    setIsSubmitting(true);
    setStatus('Adding you…');
    setStatusType('idle');

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email: trimmed, source: 'landing' }),
      });

      if (response.ok) {
        setStatus("🎉 You're on the list. We'll let you know as soon as early access opens.");
        setStatusType('success');
        setEmail('');
        return;
      }

      if (response.status === 409) {
        setStatus("You're already on the list — we'll be in touch soon.");
        setStatusType('success');
        return;
      }

      setStatus('Something hiccuped — try again in a moment.');
      setStatusType('error');
    } catch {
      setStatus('Something hiccuped — try again in a moment.');
      setStatusType('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusClass =
    statusType === 'error' ? 'form-status error' : statusType === 'success' ? 'form-status success' : 'form-status';

  return (
    <>
      <form className="wform" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={inputId}>
          Email address
        </label>
        <input
          id={inputId}
          type="email"
          name="email"
          placeholder="you@yourbrand.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isSubmitting}
        />
        <button className="btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding you…' : 'Join the waitlist'}
        </button>
      </form>
      <div className={statusClass} role="status" aria-live="polite">
        {status}
      </div>
      {variant === 'default' && (
        <div className="micro">Early access opens soon. Free to join, no card needed.</div>
      )}
      {variant === 'cta' && (
        <div className="micro">No spam. Just launch news and early access invites.</div>
      )}
    </>
  );
};
