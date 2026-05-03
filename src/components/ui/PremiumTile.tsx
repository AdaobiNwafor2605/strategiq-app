import React, { useState } from 'react';
import { Lock, Star, Zap, Crown, Info, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from './Card';
import { Button } from './Button';
import { PremiumFeature } from '../../utils/columnUtils';

interface PremiumTileProps {
  feature: PremiumFeature;
  locked?: boolean;
  userHasPremiumAccess?: boolean;
  onUpgradeClick?: () => void;
}

export const PremiumTile: React.FC<PremiumTileProps> = ({
  feature,
  locked = true,
  userHasPremiumAccess = false,
  onUpgradeClick
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getTierIcon = (tier: 'Starter' | 'Pro') => {
    return tier === 'Pro' ? (
      <Crown className="w-4 h-4 text-purple-600" />
    ) : (
      <Star className="w-4 h-4 text-blue-600" />
    );
  };

  const getTierColor = (tier: 'Starter' | 'Pro') => {
    return tier === 'Pro' 
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getAvailabilityBadge = () => {
    if (!feature.available) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <Info className="w-3 h-3 mr-1" />
          Data Required
        </span>
      );
    }
    
    if (userHasPremiumAccess) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Zap className="w-3 h-3 mr-1" />
          Available
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        <Lock className="w-3 h-3 mr-1" />
          Ready to Unlock
      </span>
    );
  };

  return (
    <Card className={`relative transition-all duration-200 hover:shadow-md ${
      locked && !userHasPremiumAccess ? 'opacity-75' : ''
    }`}>
      {/* Tier Badge */}
      <div className="absolute top-3 right-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTierColor(feature.requiredTier)}`}>
          {getTierIcon(feature.requiredTier)}
          <span className="ml-1">{feature.requiredTier}</span>
        </span>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {feature.title}
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              {feature.description}
            </p>
            {getAvailabilityBadge()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Feature Benefits */}
        <div className="mb-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
          >
            <Info className="w-4 h-4 mr-1" />
            What you'll get
            <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
          </button>
          
          {showDetails && (
            <ul className="mt-2 space-y-1">
              {feature.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start text-sm text-slate-600">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          {!feature.available ? (
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-2">
                Missing required data columns:
              </p>
              <div className="flex flex-wrap gap-1">
                {feature.requiredColumns.map((col, index) => (
                  <span key={index} className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                    {col}
                  </span>
                ))}
              </div>
            </div>
          ) : userHasPremiumAccess ? (
            <Button className="w-full" onClick={() => {/* Navigate to feature */}}>
              <Zap className="w-4 h-4 mr-2" />
              View Analysis
            </Button>
          ) : (
            <div className="w-full space-y-2">
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={onUpgradeClick}
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to {feature.requiredTier}
              </Button>
              <p className="text-xs text-center text-slate-500">
                Your data is ready for this analysis
              </p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Lock Overlay for Locked Features */}
      {locked && !userHasPremiumAccess && (
        <div className="absolute inset-0 bg-white bg-opacity-50 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-full p-3 shadow-lg">
            <Lock className="w-6 h-6 text-slate-400" />
          </div>
        </div>
      )}
    </Card>
  );
}; 