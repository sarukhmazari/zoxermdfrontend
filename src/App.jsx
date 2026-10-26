import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  ArrowRight,
  ExternalLink,
  Wifi,
  WifiOff
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '') 
  : (window.location.hostname === 'localhost' ? 'http://localhost:3000' : '');

const COUNTRY_CODES = [
  { code: '92', name: 'Pakistan (+92)', flag: '🇵🇰' },
  { code: '91', name: 'India (+91)', flag: '🇮🇳' },
  { code: '1', name: 'United States (+1)', flag: '🇺🇸' },
  { code: '44', name: 'United Kingdom (+44)', flag: '🇬🇧' },
  { code: '234', name: 'Nigeria (+234)', flag: '🇳🇬' },
  { code: '971', name: 'UAE (+971)', flag: '🇦🇪' },
  { code: '966', name: 'Saudi Arabia (+966)', flag: '🇸🇦' },
  { code: '62', name: 'Indonesia (+62)', flag: '🇮🇩' },
  { code: '880', name: 'Bangladesh (+880)', flag: '🇧🇩' },
  { code: '55', name: 'Brazil (+55)', flag: '🇧🇷' },
  { code: '27', name: 'South Africa (+27)', flag: '🇿🇦' },
  { code: '49', name: 'Germany (+49)', flag: '🇩🇪' },
  { code: '33', name: 'France (+33)', flag: '🇫🇷' },
  { code: '39', name: 'Italy (+39)', flag: '🇮🇹' },
  { code: '34', name: 'Spain (+34)', flag: '🇪🇸' },
  { code: '90', name: 'Turkey (+90)', flag: '🇹🇷' },
  { code: '20', name: 'Egypt (+20)', flag: '🇪🇬' },
  { code: '60', name: 'Malaysia (+60)', flag: '🇲🇾' },
  { code: '63', name: 'Philippines (+63)', flag: '🇵🇭' }
];

export default function App() {
  const [countryCode, setCountryCode] = useState('92');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  
  // Status states: 'READY' | 'REQUESTING' | 'WAITING_WHATSAPP' | 'CONNECTING' | 'CONNECTED' | 'EXPIRED' | 'FAILED'
  const [status, setStatus] = useState('READY');
  const [pairingCode, setPairingCode] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [token, setToken] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState(300); // 5 mins in seconds

  // Backend Health State
  const [backendHealth, setBackendHealth] = useState({ online: false, checking: true });

  const pollIntervalRef = useRef(null);
  const timerRef = useRef(null);

  // Check Backend Health on mount & periodically
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          setBackendHealth({ online: true, checking: false, activeSessions: data.activeSessions });
        } else {
          setBackendHealth({ online: false, checking: false });
        }
      } catch (_) {
        setBackendHealth({ online: false, checking: false });
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer when pairing code is active
  useEffect(() => {
    if (status === 'WAITING_WHATSAPP' && expiresIn > 0) {
      timerRef.current = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setStatus('EXPIRED');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timerRef.current);
  }, [status, expiresIn]);

  // Polling backend for connection status
  useEffect(() => {
    if ((status === 'WAITING_WHATSAPP' || status === 'CONNECTING') && requestId) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const headers = token ? { 'X-Pairing-Token': token } : {};
          const res = await fetch(`${API_BASE_URL}/api/pairing/status/${requestId}`, { headers });
          if (!res.ok) {
            if (res.status === 404) {
              setStatus('EXPIRED');
              clearInterval(pollIntervalRef.current);
            }
            return;
          }

          const data = await res.json();
          if (data.status === 'CONNECTED') {
            setStatus('CONNECTED');
            clearInterval(pollIntervalRef.current);
            clearInterval(timerRef.current);
          } else if (data.status === 'EXPIRED') {
            setStatus('EXPIRED');
            clearInterval(pollIntervalRef.current);
          } else if (data.status === 'FAILED') {
            setStatus('FAILED');
            setErrorMsg(data.message || 'WhatsApp rejected the connection request.');
            clearInterval(pollIntervalRef.current);
          }
        } catch (err) {
          // Keep polling silently on temporary network glitches
        }
      }, 2500);
    }

    return () => clearInterval(pollIntervalRef.current);
  }, [status, requestId, token]);

  const handleGenerateCode = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanInput = phoneNumber.replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (!cleanInput || cleanInput.length < 7) {
      setErrorMsg('Please enter a valid phone number.');
      return;
    }

    const combined = `${countryCode}${cleanInput}`;
    setFullPhone(combined);
    setStatus('REQUESTING');
    setPairingCode(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/pairing/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: combined })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus('FAILED');
        setErrorMsg(data.error || 'Failed to request pairing code. Please try again.');
        return;
      }

      if (data.alreadyConnected) {
        setStatus('CONNECTED');
        return;
      }

      setPairingCode(data.pairingCode);
      setRequestId(data.requestId);
      setToken(data.token);
      setExpiresIn(300);
      setStatus('WAITING_WHATSAPP');
    } catch (err) {
      setStatus('FAILED');
      setErrorMsg('Could not reach backend service. Please check your network or server URL.');
    }
  };

  const copyToClipboard = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/-/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setStatus('READY');
    setPairingCode(null);
    setRequestId(null);
    setToken(null);
    setErrorMsg(null);
    setExpiresIn(300);
    clearInterval(pollIntervalRef.current);
    clearInterval(timerRef.current);
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
              Z
            </div>
            <div>
              <span className="font-semibold tracking-tight text-slate-900 text-base">ZOXER BOT</span>
              <span className="text-xs text-slate-500 block leading-none">Session Gateway</span>
            </div>
          </div>

          {/* Backend Service Health Indicator */}
          <div className="flex items-center space-x-2 text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50">
            {backendHealth.checking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                <span className="text-slate-500">Connecting...</span>
              </>
            ) : backendHealth.online ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-700">Service Online</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-600">Service Unavailable</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-12 flex flex-col justify-center">
        
        {/* Step: CONNECTED */}
        {status === 'CONNECTED' ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
              WhatsApp Connected!
            </h1>
            <p className="text-sm text-slate-600 mb-6 max-w-sm mx-auto">
              Your session for <span className="font-mono font-semibold text-slate-900">+{fullPhone}</span> has been authenticated and persisted in the database.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left mb-6 space-y-2">
              <div className="flex items-center text-xs text-slate-700 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0" />
                Session security keys stored persistently
              </div>
              <div className="flex items-center text-xs text-slate-700 font-medium">
                <Check className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0" />
                Autofollow verified for official channel
              </div>
              <div className="flex items-center text-xs text-slate-700 font-medium">
                <Check className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0" />
                Newsletter automated reaction engine active
              </div>
            </div>

            <button
              onClick={resetForm}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              Connect Another Number
            </button>
          </div>
        ) : status === 'WAITING_WHATSAPP' && pairingCode ? (
          /* Step: DISPLAY PAIRING CODE & INSTRUCTIONS */
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="text-center mb-6">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Pairing Code Generated
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Enter Code on WhatsApp
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                For number: <span className="font-mono font-medium text-slate-800">+{fullPhone}</span>
              </p>
            </div>

            {/* Code Display Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-center mb-6 relative">
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
                Your 8-Digit Pairing Code
              </div>
              <div className="font-mono text-3xl sm:text-4xl font-bold tracking-wider text-slate-900 mb-3 select-all">
                {pairingCode}
              </div>

              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-md text-xs font-medium transition shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
                      Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      Copy Code
                    </>
                  )}
                </button>
                <span className="text-xs text-slate-400">
                  Expires in: <strong className="font-mono text-slate-600">{formatTimer(expiresIn)}</strong>
                </span>
              </div>
            </div>

            {/* Instructions */}
            <div className="border-t border-slate-100 pt-5 mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                How to link on your phone:
              </h3>
              <ol className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-start">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] mr-2.5 flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Open <strong>WhatsApp</strong> on your mobile phone.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] mr-2.5 flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Tap <strong>Settings</strong> (iOS) or <strong>Three Dots ⋮</strong> (Android) &gt; <strong>Linked Devices</strong>.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] mr-2.5 flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>Tap <strong>Link a Device</strong>.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] mr-2.5 flex-shrink-0 mt-0.5">
                    4
                  </span>
                  <span>At the bottom, tap <strong>"Link with phone number instead"</strong>.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] mr-2.5 flex-shrink-0 mt-0.5">
                    5
                  </span>
                  <span>Enter the 8-digit code: <strong className="font-mono text-slate-900">{pairingCode}</strong></span>
                </li>
              </ol>
            </div>

            {/* Live Waiting Status Footer */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center justify-between text-xs mb-4">
              <div className="flex items-center space-x-2 text-slate-700">
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                <span>Waiting for WhatsApp confirmation...</span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">Polling auto-active</span>
            </div>

            <button
              onClick={resetForm}
              className="w-full py-2 text-center text-xs font-medium text-slate-500 hover:text-slate-800 transition"
            >
              Cancel / Try another number
            </button>
          </div>
        ) : (
          /* Step: ENTER PHONE NUMBER */
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Connect Your WhatsApp
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Link your WhatsApp account to get started with Zoxer Bot.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {status === 'EXPIRED' && (
              <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Pairing code expired. Please generate a new code.</span>
              </div>
            )}

            <form onSubmit={handleGenerateCode} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <div className="flex rounded-lg border border-slate-200 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-400 transition bg-white shadow-sm overflow-hidden">
                  {/* Country Selector */}
                  <div className="flex-shrink-0 border-r border-slate-200 bg-slate-50">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="h-10 px-3 bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} +{c.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Number Input */}
                  <input
                    type="tel"
                    required
                    placeholder="3001234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={status === 'REQUESTING'}
                    className="flex-1 h-10 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Enter digits without spaces or leading zero (e.g. 3232391033).
                </p>
              </div>

              <button
                type="submit"
                disabled={status === 'REQUESTING' || !phoneNumber}
                className="w-full h-10 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center justify-center space-x-2"
              >
                {status === 'REQUESTING' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Requesting Pairing Code...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Pairing Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center space-x-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Official WhatsApp Multi-Device Pairing Protocol</span>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Zoxer Bot • Professional WhatsApp Automation</span>
          <span className="font-mono text-[11px]">Powered by Baileys Multi-Session</span>
        </div>
      </footer>
    </div>
  );
}
