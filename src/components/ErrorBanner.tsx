import React from 'react';
import { AlertCircle, RotateCcw, X } from 'lucide-react';

interface ErrorBannerProps {
  id?: string;
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  id = 'error-banner',
  title = 'Operation Error',
  message,
  onRetry,
  onDismiss,
}) => {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      className="p-3.5 bg-[#FBF2EF] border border-[#ECD1C8] text-[#7A362C] rounded-2xl flex items-start justify-between gap-3 text-sm my-2 shadow-xs transition-all"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-[#9E4738] shrink-0 mt-0.5" />
        <div>
          <h4 className="font-serif italic font-semibold text-[#662B22] text-xs uppercase tracking-wider">
            {title}
          </h4>
          <p className="text-[#7A362C] mt-0.5 text-xs sm:text-sm">{message}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-[#9E4738] text-white hover:bg-[#863C2E] active:scale-95 transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 text-[#9E4738] hover:text-[#662B22] hover:bg-[#F2DED8] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
