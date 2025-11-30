import React from 'react';
import { UserIcon, BarChartIcon, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BetsHeaderProps {
  title?: string;
}

export const BetsHeader: React.FC<BetsHeaderProps> = ({ title = "STATIX BETS" }) => {
  const navigate = useNavigate();

  return (
    <div className="terminal-header p-3 flex justify-between items-center">
      <div className="flex items-center">
        <button 
          onClick={() => navigate('/bets')}
          className="terminal-button px-3 py-2 text-sm font-medium mr-4 flex items-center border-terminal-border hover:border-terminal-green transition-colors"
        >
          <ArrowLeft size={16} className="mr-2" />
          INÍCIO
        </button>
        <span className="text-base font-semibold mr-6 text-terminal-green tracking-wide">
          Betinho
        </span>
      </div>
      <div className="flex items-center space-x-2">
        <button className="terminal-button p-1.5">
          <BarChartIcon size={16} />
        </button>
        <button className="terminal-button p-1.5">
          <UserIcon size={16} />
        </button>
      </div>
    </div>
  );
};
