import React, { useState } from 'react';
import { User, Mail, Lock, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { PasswordInput } from '../ui/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';

export const ProfilePage: React.FC = () => {
  const { user, updateEmail, resetPassword, deleteAccount } = useAuth();

  // Email change
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete account
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);
    try {
      await updateEmail(newEmail.trim());
      setEmailSuccess('A verification link has been sent to your new address. Your email updates once you verify it.');
      setNewEmail('');
      setShowEmailForm(false);
    } catch (err: any) {
      setEmailError(err?.message ?? 'Failed to update email. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 10) { setPasswordError('Password must be at least 10 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match."); return; }
    setPasswordLoading(true);
    try {
      await resetPassword(newPassword);
      setPasswordSuccess('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      setPasswordError(err?.message ?? 'Failed to update password. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAccount();
      // User will be signed out and redirected by AuthContext
    } catch (err: any) {
      setDeleteError(err?.message ?? 'Failed to delete account. Please try again.');
      setDeleteLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-600 mt-1 text-sm">Manage your StrategIQ account</p>
      </div>

      {/* Account info */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <User className="w-4 h-4" />
            Account Details
          </h2>
          <dl className="space-y-0 divide-y divide-slate-100">
            {[
              { label: 'Name', value: user.name },
              {
                label: 'Plan',
                value: (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 capitalize">
                    {user.plan}
                  </span>
                ),
              },
              {
                label: 'Member since',
                value: new Date(user.createdAt).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric',
                }),
              },
              ...(user.brandName ? [{ label: 'Brand', value: user.brandName }] : []),
              ...(user.country ? [{ label: 'Country', value: user.country }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-3">
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="text-sm font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </h2>
            {!showEmailForm && (
              <button
                onClick={() => { setShowEmailForm(true); setEmailError(''); setEmailSuccess(''); }}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Change
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600 mb-4">{user.email}</p>

          {emailSuccess && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{emailSuccess}</span>
            </div>
          )}

          {showEmailForm && (
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">New Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="new@email.com"
                    required
                  />
                </div>
              </div>
              {emailError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{emailError}</span>
                </div>
              )}
              <div className="flex gap-3">
                <Button type="submit" size="sm" loading={emailLoading}>Update Email</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowEmailForm(false); setEmailError(''); setNewEmail(''); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Password
            </h2>
            {!showPasswordForm && (
              <button
                onClick={() => { setShowPasswordForm(true); setPasswordError(''); setPasswordSuccess(''); }}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Change
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-4">●●●●●●●●●●</p>

          {passwordSuccess && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                label="New Password"
                placeholder="At least 10 characters"
                showStrength
                required
              />
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                label="Confirm New Password"
                placeholder="Repeat your password"
                required
              />
              {passwordError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}
              <div className="flex gap-3">
                <Button type="submit" size="sm" loading={passwordLoading}>Update Password</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowPasswordForm(false); setPasswordError(''); setNewPassword(''); setConfirmPassword(''); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-red-600 mb-2 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Danger Zone
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Permanently delete your account and all your data. This cannot be undone.
          </p>

          {!showDeleteForm ? (
            <button
              onClick={() => setShowDeleteForm(true)}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Delete my account
            </button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800 mb-3">
                  This permanently deletes all your data. Type <strong>DELETE</strong> to confirm.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  placeholder="Type DELETE to confirm"
                />
              </div>
              {deleteError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    deleteConfirmText === 'DELETE' && !deleteLoading
                      ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                      : 'bg-red-200 text-red-400 cursor-not-allowed'
                  }`}
                >
                  {deleteLoading ? 'Deleting…' : 'Delete my account'}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowDeleteForm(false); setDeleteConfirmText(''); setDeleteError(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
