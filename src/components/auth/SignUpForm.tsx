import React, { useState } from 'react';
import { TrendingUp, Mail, User, Phone, AlertCircle, ChevronRight, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { PasswordInput } from '../ui/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';

interface SignUpFormProps {
  onBack: () => void;
  onNavigateToLogin: () => void;
}

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

const REFERRAL_SOURCES = [
  'Google search', 'Social media', 'Word of mouth', 'Shopify App Store', 'Newsletter', 'Other',
];

export const SignUpForm: React.FC<SignUpFormProps> = ({ onBack, onNavigateToLogin }) => {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2
  const [brandName, setBrandName] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [currency, setCurrency] = useState<'GBP' | 'USD' | 'EUR'>('GBP');
  const [brandSize, setBrandSize] = useState('');
  const [industrySegment, setIndustrySegment] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  function friendlyError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('user already registered')) return 'An account with this email already exists. Try signing in.';
    if (m.includes('password should be at least')) return 'Password must be at least 10 characters.';
    if (m.includes('unable to validate email')) return 'Please enter a valid email address.';
    if (m.includes('signup is disabled')) return 'New accounts are currently paused. Contact support.';
    return msg;
  }

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { setError('Please enter your first name.'); return; }
    if (!lastName.trim()) { setError('Please enter your last name.'); return; }
    if (password.length < 10) { setError('Password must be at least 10 characters.'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) { setError('Please enter your brand name.'); return; }
    if (!brandSize) { setError('Please select your team size.'); return; }
    if (!industrySegment) { setError('Please select your industry segment.'); return; }
    if (!agreedToTerms) { setError('Please agree to the Terms & Conditions to continue.'); return; }

    setError('');
    setLoading(true);
    try {
      await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        country,
        currency,
        brandName: brandName.trim(),
        brandSize,
        industrySegment,
        dateOfBirth: dateOfBirth || undefined,
        referralSource: referralSource || undefined,
      });
    } catch (err: any) {
      setError(friendlyError(err?.message ?? 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={step === 1 ? onBack : () => { setStep(1); setError(''); }}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-8 transition-colors text-sm"
        >
          ← {step === 1 ? 'Back to home' : 'Back'}
        </button>

        <Card>
          <CardContent className="p-8">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {step === 1 ? 'Create your account' : 'Tell us about your brand'}
              </h2>
              <p className="text-slate-500 mt-1 text-sm">Step {step} of 2</p>
            </div>

            {/* Step progress bar */}
            <div className="flex gap-2 mb-8">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-purple-600' : 'bg-slate-200'}`}
                />
              ))}
            </div>

            {step === 1 ? (
              <form onSubmit={handleStep1} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full pl-9 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                        placeholder="First"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                      placeholder="Last"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder="you@yourbrand.com"
                      required
                    />
                  </div>
                </div>

                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  label="Password"
                  placeholder="At least 10 characters"
                  showStrength
                  required
                />

                <div>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    required
                  />
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">Passwords don't match</p>
                  )}
                  {confirmPassword.length > 0 && password === confirmPassword && password.length >= 10 && (
                    <p className="mt-1 text-xs text-green-600">Passwords match ✓</p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg">
                  Continue <ChevronRight className="w-4 h-4 ml-1 inline" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Brand Name</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="Your Shopify store name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Industry Segment</label>
                  <div className="grid grid-cols-2 gap-2">
                    {INDUSTRY_SEGMENTS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setIndustrySegment(value)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left flex items-center gap-2 ${
                          industrySegment === value
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-slate-300 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {industrySegment === value && <Check className="w-3.5 h-3.5 shrink-0" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Team Size</label>
                  <select
                    value={brandSize}
                    onChange={(e) => setBrandSize(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    required
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
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'GBP' | 'USD' | 'EUR')}
                      className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
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
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder="+44 7700 000000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Date of Birth <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      How did you hear? <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <select
                      value={referralSource}
                      onChange={(e) => setReferralSource(e.target.value)}
                      className="w-full px-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors text-sm"
                    >
                      <option value="">Select...</option>
                      {REFERRAL_SOURCES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-purple-600 border-slate-300 rounded focus:ring-purple-500 shrink-0"
                  />
                  <span className="text-sm text-slate-600">
                    I agree to the{' '}
                    <a href="#" className="text-purple-600 hover:underline">Terms & Conditions</a>
                    {' '}and{' '}
                    <a href="#" className="text-purple-600 hover:underline">Privacy Policy</a>
                  </span>
                </label>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Create Account
                </Button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <button
                onClick={onNavigateToLogin}
                className="text-purple-600 hover:text-purple-700 font-medium transition-colors"
              >
                Sign in
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
