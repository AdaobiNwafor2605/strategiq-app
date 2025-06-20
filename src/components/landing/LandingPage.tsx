import React from 'react';
import { ArrowRight, Check, BarChart3, Users, Brain, Crown, Shield, Zap } from 'lucide-react';
import { Button } from '../ui/Button';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const features = [
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Powerful segmentation, forecasting, and market basket analysis tailored for fashion brands.'
    },
    {
      icon: Brain,
      title: 'AI-Powered Insights',
      description: 'GPT-driven recommendations that translate complex data into actionable business strategies.'
    },
    {
      icon: Users,
      title: 'Customer Segmentation',
      description: 'Automatically identify high-value customer segments and their unique characteristics.'
    },
    {
      icon: Shield,
      title: 'Churn Prevention',
      description: 'Predict and prevent customer churn with ML-powered risk assessment and retention strategies.'
    }
  ];

  const plans = [
    {
      name: 'Micro',
      price: '£20',
      period: '/month',
      description: 'Perfect for small fashion startups',
      features: [
        'Up to 4K orders/month',
        'Basic analytics dashboard',
        'Customer segmentation',
        'Email support',
        'Standard integrations',
        'Basic forecasting'
      ],
      popular: false,
      highlight: 'Great for getting started'
    },
    {
      name: 'Starter',
      price: '£99',
      period: '/month',
      description: 'For growing fashion brands',
      features: [
        'Up to 15K orders/month',
        'Advanced analytics dashboard',
        'Limited AI insights (10/month)',
        'Priority email support',
        'Standard integrations',
        'Advanced forecasting',
        'Churn prediction'
      ],
      popular: true,
      highlight: 'Most popular choice'
    },
    {
      name: 'Professional',
      price: '£299',
      period: '/month',
      description: 'For established fashion businesses',
      features: [
        'Up to 100K orders/month',
        'Full AI insights (unlimited)',
        'Advanced market basket analysis',
        'Priority support',
        'Custom integrations',
        'Advanced forecasting',
        'Full churn prediction suite',
        'Custom reporting'
      ],
      popular: false,
      highlight: 'Premium features'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large fashion enterprises',
      features: [
        'Unlimited orders',
        'Custom AI models',
        'Dedicated account manager',
        'White-label options',
        'API access',
        'Advanced security',
        'Custom integrations',
        'On-premise deployment'
      ],
      popular: false,
      highlight: 'Tailored solutions'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-purple-600">StrategIQ</span>
            </div>
            <Button onClick={onGetStarted}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
            AI-Powered Analytics for
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent"> Fashion Brands</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Transform your Shopify data into actionable insights. Get AI-powered recommendations
            for customer segmentation, sales forecasting, and churn prevention.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={onGetStarted}>
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything you need to grow your fashion brand
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Our platform combines advanced analytics with AI-powered insights to help you make
              data-driven decisions that drive growth.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                  <feature.icon className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Choose the perfect plan for your brand
            </h2>
            <p className="text-xl text-slate-600">
              Start small, scale as you grow. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`bg-white rounded-2xl shadow-sm border-2 p-6 relative transition-all duration-200 hover:shadow-lg ${plan.popular ? 'border-purple-500 scale-105 lg:scale-110' : 'border-slate-200'
                  }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-slate-600 mb-3">{plan.description}</p>
                  <div className="flex items-baseline justify-center mb-2">
                    <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-slate-600 ml-1">{plan.period}</span>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                    {plan.highlight}
                  </span>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? 'primary' : 'outline'}
                  className="w-full"
                  size="sm"
                  onClick={onGetStarted}
                >
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-600 mb-4">All plans include:</p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600">
              <div className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                7 day free trial
              </div>
              <div className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                Cancel anytime
              </div>
              <div className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                Data security & privacy
              </div>
              <div className="flex items-center">
                <Check className="w-4 h-4 text-green-500 mr-2" />
                Regular updates
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to transform your fashion business?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join hundreds of businesses already using StrategIQ to make smarter decisions.
          </p>
          <Button
            variant="secondary"
            size="lg"
            onClick={onGetStarted}
          >
            Start Your Free Trial
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">StrategIQ</span>
          </div>
          <p>© 2024 StrategIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};