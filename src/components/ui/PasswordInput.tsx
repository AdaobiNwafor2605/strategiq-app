import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

function getStrength(pw: string): { score: number; label: string; barColor: string; textColor: string } {
  if (!pw) return { score: 0, label: '', barColor: '', textColor: '' };
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score <= 2) return { score: 1, label: 'Weak', barColor: 'bg-red-500', textColor: 'text-red-600' };
  if (score <= 3) return { score: 2, label: 'Fair', barColor: 'bg-yellow-500', textColor: 'text-yellow-600' };
  return { score: 3, label: 'Strong', barColor: 'bg-green-500', textColor: 'text-green-600' };
}

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showStrength?: boolean;
  required?: boolean;
  name?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  label = 'Password',
  placeholder = 'Enter your password',
  showStrength = false,
  required = false,
  name,
}) => {
  const [show, setShow] = useState(false);
  const strength = showStrength && value ? getStrength(value) : null;

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      )}
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={10}
          className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {strength && strength.label && (
        <div className="mt-2 space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= strength.score ? strength.barColor : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <p className={`text-xs font-medium ${strength.textColor}`}>{strength.label}</p>
        </div>
      )}
    </div>
  );
};
