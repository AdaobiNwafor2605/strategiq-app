import React from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

interface GlossaryPageProps {
  onBack: () => void;
}

interface GlossaryTerm {
  term: string;
  definition: string;
}

interface GlossarySection {
  heading: string;
  terms: GlossaryTerm[];
}

const GLOSSARY: GlossarySection[] = [
  {
    heading: 'Customer Segments',
    terms: [
      { term: 'VIPs', definition: 'Your highest-value, full-price loyal buyers — high revenue, never used a discount, and haven’t lapsed.' },
      { term: 'Regulars', definition: 'Repeat buyers who purchase at a steady pace, without a strong VIP or risk signal.' },
      { term: 'New Customers', definition: 'First-time buyers whose most recent order was in the last 30 days.' },
      { term: 'One-Time Buyers', definition: 'Customers who have bought exactly once.' },
      { term: 'Going Quiet', definition: 'Repeat buyers who are overdue compared to their own usual buying pattern — a warning sign before they lapse.' },
      { term: 'Lapsed', definition: 'Customers with no purchase in 180 days or more, measured from the most recent order date in your uploaded data.' },
      { term: 'Discount Shoppers', definition: 'Buyers who used a discount code on 70% or more of their orders.' },
    ],
  },
  {
    heading: 'Headline Metrics',
    terms: [
      { term: 'Total Revenue', definition: 'The sum of every order in your uploaded data, before refunds.' },
      { term: 'Active Customers', definition: 'The number of unique customers who placed at least one order in your uploaded data.' },
      { term: 'Average Order Value (AOV)', definition: 'Total revenue divided by number of orders — how much a typical order is worth.' },
      { term: 'Churn Risk', definition: 'The share of customers who are Lapsed or Going Quiet. Based on your data’s most recent order date, not today’s date.' },
      { term: 'Repeat Purchase Rate', definition: 'The share of customers who have placed more than one order — a sign of how much revenue depends on repeat buyers vs. one-time purchases.' },
    ],
  },
  {
    heading: 'Revenue & Opportunity',
    terms: [
      { term: 'Revenue at Risk', definition: 'Estimated lifetime spend from customers who are Lapsed or Going Quiet — revenue you stand to lose if they don’t return.' },
      { term: 'Revenue Opportunity', definition: 'Estimated revenue from new customers and one-time buyers who are in their window to make a second purchase.' },
      { term: 'Revenue Forecast', definition: 'A projection of future revenue based on your historical order pattern. Solid line = actual revenue, dashed line = the model’s prediction.' },
      { term: 'Opportunity Score', definition: 'A 0–100 score representing how commercially valuable it is to act on a customer right now, based on their value, urgency, and likelihood of converting.' },
    ],
  },
  {
    heading: 'Weekly Growth Plan',
    terms: [
      { term: 'Protect Revenue', definition: 'Actions aimed at retaining valuable customers who are at risk of leaving.' },
      { term: 'Grow Revenue', definition: 'Actions aimed at converting customers toward their next purchase.' },
      { term: 'Improve Margin', definition: 'Actions aimed at reducing unnecessary discounting.' },
      { term: 'Strengthen Loyalty', definition: 'Actions aimed at rewarding and retaining your best customers.' },
    ],
  },
];

export const GlossaryPage: React.FC<GlossaryPageProps> = ({ onBack }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Glossary</h1>
          <p className="text-sm text-slate-500">Plain-English definitions for every term StrategIQ uses.</p>
        </div>
      </div>

      {GLOSSARY.map((section) => (
        <Card key={section.heading}>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              {section.heading}
            </h2>
            <dl className="space-y-4">
              {section.terms.map((t) => (
                <div key={t.term}>
                  <dt className="text-sm font-semibold text-slate-900">{t.term}</dt>
                  <dd className="text-sm text-slate-600 mt-0.5">{t.definition}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
