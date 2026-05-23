import React, { useEffect } from 'react';
import { CheckCircle, Circle, Upload, User, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { useAuth } from '../../contexts/AuthContext';

interface OnboardingScreenProps {
  onNavigate: (page: string) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onNavigate }) => {
  const { user, markOnboardingSeen } = useAuth();

  useEffect(() => {
    // Mark immediately so this screen is never shown again on login
    markOnboardingSeen();
  }, []);

  const steps = [
    {
      id: 'account',
      label: 'Create your account',
      description: 'Done! Welcome to StrategIQ.',
      done: true,
    },
    {
      id: 'csv',
      label: 'Upload your first Shopify export',
      description: 'Drop your orders CSV to unlock insights.',
      done: user?.csvUploaded ?? false,
      action: () => onNavigate('upload'),
      actionLabel: 'Upload CSV',
      icon: Upload,
    },
    {
      id: 'brand',
      label: 'Complete your brand profile',
      description: 'Tell us more about your store.',
      done: user?.brandDetailsComplete ?? false,
      action: () => onNavigate('profile'),
      actionLabel: 'Complete profile',
      icon: User,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-slate-900">
                Welcome{user?.firstName ? `, ${user.firstName}` : ''}!
              </h1>
              <p className="text-slate-600 mt-2">
                StrategIQ is ready. Here's how to get the most out of it.
              </p>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Setup progress</span>
                <span className="font-semibold text-slate-800">{completedCount} / {steps.length}</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / steps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-3 mb-8">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    step.done
                      ? 'border-green-200 bg-green-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {step.done ? (
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${step.done ? 'text-green-800 line-through opacity-60' : 'text-slate-900'}`}>
                        {step.label}
                      </p>
                      {!step.done && (
                        <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                      )}
                    </div>
                  </div>
                  {!step.done && step.action && (
                    <button
                      onClick={step.action}
                      className="shrink-0 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors flex items-center gap-1 ml-2"
                    >
                      {step.actionLabel}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={() => onNavigate('upload')}
              className="w-full"
              size="lg"
            >
              Get started — Upload your data
            </Button>

            <p className="text-center text-xs text-slate-400 mt-4">
              You can find these steps later in your account settings
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
