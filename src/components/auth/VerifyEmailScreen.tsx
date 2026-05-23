import React, { useState } from 'react';
import { Mail, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { useAuth } from '../../contexts/AuthContext';

export const VerifyEmailScreen: React.FC = () => {
  const { unverifiedEmail, resendVerificationEmail, clearUnverifiedEmail } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setError('');
    setSending(true);
    try {
      await resendVerificationEmail();
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to resend. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-purple-600" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h2>
            <p className="text-slate-600 mb-1 text-sm">We sent a confirmation link to:</p>
            <p className="font-semibold text-slate-900 mb-4">{unverifiedEmail}</p>
            <p className="text-sm text-slate-500 mb-8">
              Click the link in that email to activate your account. Once verified, you'll be signed in automatically.
            </p>

            {sent && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Verification email resent. Check your inbox (and spam folder).
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleResend}
                variant="outline"
                className="w-full"
                loading={sending}
              >
                Resend verification email
              </Button>

              <button
                onClick={clearUnverifiedEmail}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors py-2"
              >
                Use a different email address →
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
