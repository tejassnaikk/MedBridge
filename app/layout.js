import './globals.css';
import ChatWidget from './components/ChatWidget';

export const metadata = {
  title: 'MedBridge — Free Medication for Those Who Need It',
  description: 'Connecting unused medications to patients who need them. Coordination layer between donors, clinics, and patients.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="wrapper min-h-screen">
          {/* Nav */}
          <nav className="border-b border-[#1e2d45] bg-[#0a0e1a]/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-white">Med<span className="text-[#00d4aa]">Bridge</span></span>
                <span className="hidden sm:block font-mono text-[10px] text-[#64748b] border border-[#1e2d45] px-2 py-0.5 rounded-sm tracking-widest">COLORADO</span>
              </a>
              <div className="flex items-center gap-1">
                <a href="/donor" className="text-[#64748b] hover:text-[#10b981] text-sm px-3 py-1.5 rounded-md hover:bg-[#10b981]/10 transition-all">
                  Donate Meds
                </a>
                <a href="/clinic" className="text-[#64748b] hover:text-[#8b5cf6] text-sm px-3 py-1.5 rounded-md hover:bg-[#8b5cf6]/10 transition-all">
                  Clinic Portal
                </a>
                <a href="/register-clinic" className="text-[#64748b] hover:text-[#8b5cf6] text-sm px-3 py-1.5 rounded-md hover:bg-[#8b5cf6]/10 transition-all">
                  Join Network
                </a>
              </div>
            </div>
          </nav>

          {/* Page content */}
          {children}

          {/* Global chat widget */}
          <ChatWidget />

          {/* Footer */}
          <footer className="border-t border-[#1e2d45] mt-20 py-8 px-4">
            <div className="max-w-6xl mx-auto text-center">
              <p className="text-[#64748b] text-xs leading-relaxed max-w-2xl mx-auto">
                MedBridge is not a medical provider. We are a coordination layer — we never dispense, ship, or handle medications.
                All dispensing is performed by licensed pharmacists at participating clinics. Consult your doctor or pharmacist for medical advice.
              </p>
              <p className="text-[#1e2d45] text-xs mt-3 font-mono">MedBridge v1.0 · Colorado Pilot</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
