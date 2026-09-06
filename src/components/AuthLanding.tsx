import React, { useState } from 'react';
import { BookOpen, ShieldCheck, Sparkles, MessageSquareText, Lock, ArrowRight } from 'lucide-react';
import { signInWithGoogle } from '../firebase';
import { ErrorBanner } from './ErrorBanner';

interface AuthLandingProps {
  onAuthSuccess?: () => void;
}

export const AuthLanding: React.FC<AuthLandingProps> = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      // Friendly message
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed before completing authentication. Please try again.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        setErrorMsg('Authentication request cancelled. Please try again.');
      } else {
        setErrorMsg(err?.message || 'Failed to authenticate with Google. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-center items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#EAE4DB] text-[#70665C] border border-[#E5E0D8] mb-6 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#7A8D74]" />
          Powered by Gemini 3.6 Flash & Cloud Firestore
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif italic font-semibold tracking-tight text-[#4A3E3E] leading-tight">
          Your Private Reflective Journal,{' '}
          <span className="text-[#7A8D74] underline decoration-[#7A8D74]/40 decoration-wavy underline-offset-6">
            Grounded by AI
          </span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-[#70665C] max-w-xl leading-relaxed">
          Record your thoughts, emotions, and creative brainstorms in a secure,
          isolated workspace. Converse with Gemini for deep reflections, thematic
          synthesis, and introspective guidance.
        </p>

        {/* Error notification if any */}
        {errorMsg && (
          <div className="w-full max-w-md mt-6 text-left">
            <ErrorBanner
              id="auth-error-banner"
              title="Authentication Notice"
              message={errorMsg}
              onRetry={handleGoogleSignIn}
              onDismiss={() => setErrorMsg(null)}
            />
          </div>
        )}

        {/* Primary CTA Box */}
        <div className="mt-8 w-full max-w-sm bg-white p-6 sm:p-8 rounded-2xl border border-[#E5E0D8] shadow-xs">
          <button
            id="btn-google-login"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 bg-[#4A3E3E] hover:bg-[#332B2B] text-white font-medium rounded-full text-sm transition-all duration-150 flex items-center justify-center gap-3 shadow-xs hover:shadow active:scale-98 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>{loading ? 'Authenticating...' : 'Sign In with Google'}</span>
            {!loading && <ArrowRight className="w-4 h-4 text-[#A69D91]" />}
          </button>

          <p className="mt-3 text-[11px] text-[#A69D91] leading-normal">
            Secure federated identity. We never handle or store custom passwords in client code.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-4xl text-left">
          <div className="bg-white p-5 rounded-2xl border border-[#E5E0D8] shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-[#EAF0E8] text-[#55694F] flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-serif italic font-semibold text-[#4A3E3E]">Isolated Storage</h3>
            <p className="text-xs text-[#70665C] mt-1 leading-relaxed">
              Every reflection is stored under your unique user ID in Firestore. Security rules enforce that other users cannot read your entries.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E5E0D8] shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-[#EAE4DB] text-[#7A8D74] flex items-center justify-center mb-3">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-serif italic font-semibold text-[#4A3E3E]">Multi-Turn Reflections</h3>
            <p className="text-xs text-[#70665C] mt-1 leading-relaxed">
              Converse with Gemini across multiple turns to unpack complex emotions, challenge assumptions, and explore new perspectives.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E5E0D8] shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-[#F5EFE6] text-[#7A6451] flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-serif italic font-semibold text-[#4A3E3E]">Automated Synthesis</h3>
            <p className="text-xs text-[#70665C] mt-1 leading-relaxed">
              Generate instant summaries, identify key recurring themes, and brainstorm creative journaling prompts on demand.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-[#A69D91]">
        <p>Private & User-Isolated • Built with Firebase Auth, Cloud Firestore & Google Gemini</p>
      </footer>
    </div>
  );
};
