'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScannerState } from 'html5-qrcode';
import { Button } from './ui/button';
import { X, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Stop scanner after successful scan
        scanner.clear().then(() => {
          onScan(decodedText);
          onClose();
        }).catch(err => {
            console.error("Failed to clear scanner", err);
            onScan(decodedText);
            onClose();
        });
      },
      (errorMessage) => {
        // We don't want to show every frame's "no QR found" error
        // But we could log it if needed for debugging
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner on unmount", err));
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-gray-900/90 rounded-2xl border border-gray-800 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
      <div className="w-full flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Scan USDC Address</h3>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="relative w-full aspect-square max-w-[300px] bg-black rounded-xl overflow-hidden border border-gray-700">
        <div id="qr-reader" className="w-full h-full"></div>
        
        {/* Scanning Overlay Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
             <div className="w-[250px] h-[250px] border-2 border-teal-500/50 rounded-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-teal-400/80 shadow-[0_0_15px_rgba(45,212,191,0.5)] animate-scan-line"></div>
             </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 w-full">
        <p className="text-sm text-gray-400 text-center">
            Position the QR code within the frame to scan.
        </p>
        
        <div className="flex items-center gap-2 text-xs text-teal-400/60 font-medium uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></div>
            Searching for QR Code
        </div>
      </div>

      <style jsx global>{`
        #qr-reader {
          border: none !important;
        }
        #qr-reader img {
          display: none !important;
        }
        #qr-reader__scan_region {
           background: black !important;
        }
        #qr-reader__dashboard_section_csr button {
            background-color: #111827 !important;
            color: #9ca3af !important;
            border: 1px solid #374151 !important;
            padding: 8px 16px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            cursor: pointer !important;
            margin-bottom: 10px !important;
        }
        #qr-reader__dashboard_section_csr button:hover {
            color: white !important;
            border-color: #4b5563 !important;
        }
        #qr-reader__status_span {
            display: none !important;
        }
        @keyframes scan-line {
            0% { transform: translateY(0); }
            100% { transform: translateY(250px); }
        }
        .animate-scan-line {
            animation: scan-line 2.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
