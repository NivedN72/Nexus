import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cognitoService } from '../services/cognito';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'confirm' | 'newpassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('visitor');
  const [signInType, setSignInType] = useState('visitor');
  const [challenge, setChallenge] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requiredDetails, setRequiredDetails] = useState({});
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setChallenge(null); setNewPassword(''); setConfirmPassword(''); setRequiredDetails({});
    if (isOpen) {
      setMode('signin'); setError(''); setSuccessMsg(''); setPassword(''); setCode('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const acceptAuthResult = (result) => {
    setPassword(''); setNewPassword(''); setConfirmPassword(''); setSuccessMsg('');
    if (result.challengeName === 'NEW_PASSWORD_REQUIRED') {
      setChallenge(result);
      setRequiredDetails(Object.fromEntries(result.requiredAttributes.map(key => [key, result.attributes?.[key] || (key === 'email' ? result.email : '')])));
      setMode('newpassword');
    } else {
      setChallenge(null); setRequiredDetails({});
      onAuthSuccess(result);
    }
  };

  const handleNewPassword = async (e) => {
    e.preventDefault(); setError('');
    if (newPassword !== confirmPassword) { setError('The new passwords do not match.'); return; }
    try {
      setLoading(true);
      const result = await cognitoService.completeNewPassword(challenge, newPassword, requiredDetails);
      acceptAuthResult(result);
    } catch (err) {
      if (err.passwordChanged || err.code === 'NotAuthorizedException') {
        setChallenge(null); setNewPassword(''); setConfirmPassword(''); setRequiredDetails({}); setMode('signin');
      }
      setError(err.passwordChanged ? `Password updated. ${err.message}` : err.message || 'Could not set your new password.');
    } finally { setLoading(false); }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const user = await cognitoService.signIn(email.trim(), password, signInType);
      acceptAuthResult(user);
    } catch (err) {
      console.error(err);
      if (err.code === 'UserNotConfirmedException' || err.message?.includes('UserNotConfirmedException')) {
        setMode('confirm');
        setError('Your account is not verified yet. Enter the code sent to your email.');
      } else {
        setError(err.message || 'Incorrect email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await cognitoService.signUp(email.trim(), password, name.trim(), accountType);
      setSuccessMsg('Account created! Please check your email for the verification code.');
      setMode('confirm');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await cognitoService.confirmSignUp(email.trim(), code.trim());
      setSuccessMsg('Email verified! You can now sign in.');
      setMode('signin');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6 border border-white/10 shadow-2xl relative">
        
        {/* Close Button */}
        <button
          disabled={loading}
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {mode === 'signin' && 'Sign In with Cognito'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'confirm' && 'Verify Your Email'}
              {mode === 'newpassword' && 'Set Your New Password'}
            </h2>
            <p className="text-xs text-slate-400">One account for event booking and your tickets</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'newpassword' && (
          <form onSubmit={handleNewPassword} className="space-y-4">
            <p className="text-sm text-slate-300">Your account uses a temporary password. Choose a permanent password to finish signing in.</p>
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-slate-400 mb-1">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={loading} required className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="block text-xs font-semibold text-slate-400 mb-1">Confirm new password</label>
              <input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={loading} required className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
            </div>
            {challenge?.requiredAttributes.map(key => (
              <div key={key}>
                <label htmlFor={`required-${key}`} className="block text-xs font-semibold text-slate-400 mb-1 capitalize">{key === 'name' ? 'Full name' : key.replace(/_/g, ' ')}</label>
                <input id={`required-${key}`} type={key === 'email' ? 'email' : 'text'} value={requiredDetails[key] || ''} onChange={e => setRequiredDetails(previous => ({ ...previous, [key]: e.target.value }))} disabled={loading} required className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
            ))}
            <p className="text-xs text-slate-400">Use a password that meets your account's password policy. Any password requirements will be shown if it is rejected.</p>
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50">{loading ? 'Updating…' : 'Set Password & Sign In'}</button>
            <button type="button" disabled={loading} onClick={() => { setChallenge(null); setNewPassword(''); setConfirmPassword(''); setRequiredDetails({}); setMode('signin'); setError(''); }} className="w-full text-xs text-indigo-400">Back to Sign In</button>
          </form>
        )}

        {/* SIGN IN FORM */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <fieldset disabled={loading}>
              <legend className="text-xs font-semibold text-slate-400 mb-2">Sign in as</legend>
              <div className="grid grid-cols-2 gap-2">
                {['visitor', 'student'].map(type => (
                  <label key={type} className={`flex items-center justify-center gap-2 cursor-pointer px-4 py-3 rounded-xl border text-sm font-semibold ${signInType === type ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200' : 'bg-slate-900/60 border-white/10 text-slate-400'}`}>
                    <input type="radio" name="sign-in-type" value={type} checked={signInType === type} onChange={() => { setSignInType(type); setError(''); }} className="accent-indigo-500" />
                    {type === 'visitor' ? 'Visitor' : 'Student'}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">{signInType === 'visitor' ? 'Book campus events and view your tickets.' : 'For approved students and campus admins. Student access is required for Lost & Found.'}</p>
            </fieldset>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" /> Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" /> Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="pt-2 text-center text-xs text-slate-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setAccountType(signInType); setMode('signup'); setError(''); setSuccessMsg(''); }}
                className="text-indigo-400 font-semibold hover:underline"
              >
                Sign Up
              </button>
            </div>
          </form>
        )}

        {/* SIGN UP FORM */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label htmlFor="account-type" className="block text-xs font-semibold text-slate-400 mb-1">Account Type</label>
              <select id="account-type" value={accountType} onChange={e => setAccountType(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white">
                <option value="visitor">Visitor</option>
                <option value="student">Student — request campus access</option>
              </select>
              <p className="text-xs text-slate-400 mt-2">Everyone can book events. Student access to Lost & Found requires campus admin approval; you can book while approval is pending.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Full Name
              </label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400" /> Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" /> Password (Min 8 chars, 1 uppercase, 1 number)
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="pt-2 text-center text-xs text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
                className="text-indigo-400 font-semibold hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* CONFIRM CODE FORM */}
        {mode === 'confirm' && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <p className="text-xs text-slate-300">
              Enter the 6-digit confirmation code Cognito sent to <span className="font-semibold text-white">{email}</span>:
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Verification Code
              </label>
              <input
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Confirm Account'
              )}
            </button>

            <div className="pt-2 text-center text-xs text-slate-400">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); }}
                className="text-indigo-400 font-semibold hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
