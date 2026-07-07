import React, { useState } from 'react';
import { User, Mail, Lock, Trash2, AlertCircle, CheckCircle, Phone, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { PasswordInput } from '../ui/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';

const COUNTRIES = [
  'United Kingdom', 'United States', 'Canada', 'Australia', 'Germany',
  'France', 'Netherlands', 'Spain', 'Italy', 'Sweden', 'Denmark', 'Other',
];

const BRAND_SIZES = [
  { value: 'solo', label: 'Solo (just me)' },
  { value: 'small', label: 'Small (1–5 people)' },
  { value: 'medium', label: 'Medium (6–20 people)' },
  { value: 'large', label: 'Large (20+ people)' },
];

const INDUSTRY_SEGMENTS = [
  { value: 'womenswear', label: 'Womenswear' },
  { value: 'menswear', label: 'Menswear' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'multi-category', label: 'Multi-category' },
];

export const ProfilePage: React.FC = () => {
  const { user, updateEmail, updateProfile, resetPassword, deleteAccount } = useAuth();

  // Profile edit
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState(user?.firstName ?? '');
  const [profileLastName, setProfileLastName] = useState(user?.lastName ?? '');
  const [profileBrandName, setProfileBrandName] = useState(user?.brandName ?? '');
  const [profileBrandSize, setProfileBrandSize] = useState(user?.brandSize ?? '');
  const [profileIndustrySegment, setProfileIndustrySegment] = useState(user?.industrySegment ?? '');
  const [profileCountry, setProfileCountry] = useState(user?.country ?? 'United Kingdom');
  const [profileCurrency, setProfileCurrency] = useState<'GBP' | 'USD' | 'EUR'>(user?.currency ?? 'GBP');
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

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

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    if (!profileFirstName.trim()) { setProfileError('First name is required.'); return; }
    setProfileLoading(true);
    try {
      await updateProfile({
        firstName: profileFirstName.trim(),
        lastName: profileLastName.trim(),
        brandName: profileBrandName.trim() || undefined,
        brandSize: profileBrandSize || undefined,
        industrySegment: profileIndustrySegment || undefined,
        country: profileCountry,
        currency: profileCurrency,
        phone: profilePhone.trim() || undefined,
      });
      setProfileSuccess('Profile updated.');
      setShowProfileForm(false);
    } catch (err: any) {
      setProfileError(err?.message ?? 'Failed to update profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

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

      {/* Account info + edit */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4" />
              Account Details
            </h2>
            {!showProfileForm && (
              <button
                onClick={() => {
                  setProfileFirstName(user.firstName ?? '');
                  setProfileLastName(user.lastName ?? '');
                  setProfileBrandName(user.brandName ?? '');
                  setProfileBrandSize(user.brandSize ?? '');
                  setProfileIndustrySegment(user.industrySegment ?? '');
                  setProfileCountry(user.country ?? 'United Kingdom');
                  setProfileCurrency(user.currency ?? 'GBP');
                  setProfilePhone(user.phone ?? '');
                  setProfileError('');
                  setProfileSuccess('');
                  setShowProfileForm(true);
                }}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Edit
              </button>
            )}
          </div>

          {/* Read-only display */}
          {!showProfileForm && (
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
                ...(user.brandSize ? [{ label: 'Team size', value: BRAND_SIZES.find(b => b.value === user.brandSize)?.label ?? user.brandSize }] : []),
                ...(user.industrySegment ? [{ label: 'Segment', value: INDUSTRY_SEGMENTS.find(s => s.value === user.industrySegment)?.label ?? user.industrySegment }] : []),
                ...(user.country ? [{ label: 'Country', value: user.country }] : []),
                ...(user.currency ? [{ label: 'Currency', value: user.currency }] : []),
                ...(user.phone ? [{ label: 'Phone', value: user.phone }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-3">
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="text-sm font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {profileSuccess && !showProfileForm && (
            <div className="flex items-start gap-2 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {/* Edit form */}
          {showProfileForm && (
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={profileFirstName}
                    onChange={(e) => setProfileFirstName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                    placeholder="First"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={profileLastName}
                    onChange={(e) => setProfileLastName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                    placeholder="Last"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Brand Name</label>
                <input
                  type="text"
                  value={profileBrandName}
                  onChange={(e) => setProfileBrandName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                  placeholder="Your Shopify store name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Industry Segment</label>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRY_SEGMENTS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setProfileIndustrySegment(value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left flex items-center gap-2 ${
                        profileIndustrySegment === value
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {profileIndustrySegment === value && <Check className="w-3.5 h-3.5 shrink-0" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Team Size</label>
                <select
                  value={profileBrandSize}
                  onChange={(e) => setProfileBrandSize(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                >
                  <option value="">Select team size</option>
                  {BRAND_SIZES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                  <select
                    value={profileCountry}
                    onChange={(e) => setProfileCountry(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
                  <select
                    value={profileCurrency}
                    onChange={(e) => setProfileCurrency(e.target.value as 'GBP' | 'USD' | 'EUR')}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                  >
                    <option value="GBP">GBP (£)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                    placeholder="+44 7700 000000"
                  />
                </div>
              </div>

              {profileError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="submit" size="sm" loading={profileLoading}>Save Changes</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowProfileForm(false); setProfileError(''); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
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
