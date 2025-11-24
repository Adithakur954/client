import React from "react";

export const ChartContainer = React.forwardRef(
  ({ title, icon: Icon, children, actions }, ref) => {
    return (
      <div 
        ref={ref}
        className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-blue-400" />}
            {title}
          </h4>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    );
  }
);

ChartContainer.displayName = "ChartContainer";