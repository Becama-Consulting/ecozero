import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'green' | 'red' | 'blue' | 'orange' | 'gray';
  onClick?: () => void;
}

const colorClasses = {
  green: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  red: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950',
  blue: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  orange: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950',
  gray: 'text-muted-foreground bg-muted'
};

export const MetricCard = ({ title, value, icon: Icon, color = 'gray', onClick }: MetricCardProps) => {
  return (
    <Card 
      className={cn(
        "p-6 transition-shadow",
        onClick && "cursor-pointer hover:shadow-lg"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-bold mt-2">{value}</h3>
        </div>
        <div className={cn("p-3 rounded-full", colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  );
};
