import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, User, Users, Target } from "lucide-react";
import type { InjuryInsight } from "@/types/sports";

interface InjuryInsightsCardProps {
  insight: InjuryInsight;
  onAnalyze?: (insight: InjuryInsight) => void;
  onAddToWatchlist?: (insight: InjuryInsight) => void;
}

export const InjuryInsightsCard = ({ 
  insight, 
  onAnalyze, 
  onAddToWatchlist 
}: InjuryInsightsCardProps) => {
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-white';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'points':
        return <Target className="h-4 w-4" />;
      case 'rebounds':
        return <TrendingUp className="h-4 w-4" />;
      case 'assists':
        return <Users className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-red-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-lg">{insight.teamName}</CardTitle>
          </div>
          <Badge className={getImpactColor(insight.impact)}>
            {insight.impact.toUpperCase()} IMPACT
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Injured Player */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Injured Player</span>
          </div>
          <div className="font-semibold text-foreground">
            {insight.injuredPlayer}
          </div>
        </div>

        {/* Next Player */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Next Player Up</span>
          </div>
          <div className="font-semibold text-foreground">
            {insight.nextPlayer}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getCategoryIcon(insight.category)}
            <span>Category</span>
          </div>
          <Badge variant="outline" className="text-foreground">
            {insight.category.toUpperCase()}
          </Badge>
        </div>

        {/* Timestamp */}
        <div className="text-xs text-muted-foreground">
          Updated: {formatDate(insight.createdAt)}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {onAnalyze && (
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => onAnalyze(insight)}
            >
              <Target className="h-4 w-4 mr-2" />
              Analyze
            </Button>
          )}
          
          {onAddToWatchlist && (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={() => onAddToWatchlist(insight)}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Watch
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

























