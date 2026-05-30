import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Zap, 
  Terminal, 
  ArrowRight, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles,
  FileText,
  Image as ImageIcon,
  Mail,
  User,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { GithubIcon as Github } from './GithubIcon';
import { WebGPURedraw } from './WebGPURedraw';
import { AstroBucketLogo } from './AstroBucketLogo';

// Import CSS
import '../styles/landing.css';

/**
 * LandingPageProps
 * 
 * - onConnect: Callback function triggered to open the repository connection modal.
 * - hasCreds: Boolean indicating if there are already active repository credentials.
 * - onLaunchConsole: Callback function to directly transition to the file explorer page.
 */
interface LandingPageProps {
  onConnect: () => void;
  hasCreds: boolean;
  onLaunchConsole: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onConnect, 
  hasCreds, 
  onLaunchConsole 
}) => {
  // Navigation scrolling and FAQ accordion state
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Monitor scroll height to trigger the scrolled class shrink animation
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Simulated files for the interactive CDN link preview mockup
  const mockFiles = [
    { name: 'avatar.png', type: 'image', path: 'assets/avatar.png', size: '1.2 MB' },
    { name: 'app.css', type: 'css', path: 'dist/app.css', size: '24 KB' },
    { name: 'index.js', type: 'js', path: 'js/index.js', size: '156 KB' },
  ];

  const [activeMockFile, setActiveMockFile] = useState(mockFiles[0]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Generates CDN link based on selected mock file
  const getMockCdnUrl = (path: string) => {
    return `https://cdn.jsdelivr.net/gh/Priyanshu0007/cdn-vault@main/${path}`;
  };

  const handleCopyMockCdn = (path: string, index: number) => {
    const url = getMockCdnUrl(path);
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Scroll to section helper
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Offset by 100px to account for the floating navbar
      const yOffset = -100;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Curated FAQ dataset
  const faqs = [
    {
      q: "What is AstroBucket?",
      a: "AstroBucket is an open-source, serverless S3-style console that allows you to manage assets inside your GitHub repositories and generate edge-cached jsDelivr CDN links. It acts as a free, lightweight content delivery network backend."
    },
    {
      q: "Is my GitHub Personal Access Token secure?",
      a: "Absolutely. AstroBucket is a 100% client-side application. Your credentials, repos, and tokens are stored solely in your browser's local storage and used directly to communicate with GitHub's secure API. No data is transmitted to middleman servers."
    },
    {
      q: "Are there any storage limits or bandwidth costs?",
      a: "AstroBucket is entirely free. All file storage limits depend on GitHub's repository rules (typically up to 1GB - 5GB for standard repos). Global CDN hosting is provided by jsDelivr with infinite bandwidth and no fees."
    },
    {
      q: "Can I manage subdirectories and file organization?",
      a: "Yes. You can create folder hierarchies, drop files into specific subfolders, view and copy paths, delete assets, and review raw file configurations in real-time, just like AWS S3."
    },
    {
      q: "Should I use my primary GitHub account?",
      a: "For the cleanest setup, we recommend using a secondary or burner GitHub account. Since AstroBucket writes commits to your repositories for every file upload or deletion, using a secondary account avoids polluting your primary developer account's git history and contribution graphs."
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="landing-page" style={{ paddingTop: '5rem' }}>
      {/* WebGPU Redraw Animated Vector Wave Backdrop */}
      <WebGPURedraw />

      {/* Liquid Glass Floating Navbar */}
      <nav className={`landing-navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <a href="#" className="brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div className="brand-icon-wrapper" style={{ padding: scrolled ? '0.2rem' : '0.25rem' }}>
              <AstroBucketLogo size={scrolled ? 22 : 26} />
            </div>
            <span className="text-gradient-hero">AstroBucket</span>
          </a>
          
          <div className="nav-links">
            <a href="#features" className="nav-link" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a>
            <a href="#faq" className="nav-link" onClick={(e) => { e.preventDefault(); scrollToSection('faq'); }}>FAQ</a>
            <a href="#developer" className="nav-link" onClick={(e) => { e.preventDefault(); scrollToSection('developer'); }}>Contact</a>
            
            {hasCreds ? (
              <button className="btn-glowing" onClick={onLaunchConsole}>
                Console <ArrowRight size={14} />
              </button>
            ) : (
              <button className="btn-glowing" onClick={onConnect}>
                Connect Repo <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button 
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Mobile Dropdown Panel */}
          {mobileMenuOpen && (
            <div className="mobile-dropdown-menu">
              <a href="#features" className="nav-link" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); scrollToSection('features'); }}>Features</a>
              <a href="#faq" className="nav-link" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); scrollToSection('faq'); }}>FAQ</a>
              <a href="#developer" className="nav-link" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); scrollToSection('developer'); }}>Contact</a>
              
              {hasCreds ? (
                <button className="btn-glowing" onClick={() => { setMobileMenuOpen(false); onLaunchConsole(); }}>
                  Console <ArrowRight size={14} />
                </button>
              ) : (
                <button className="btn-glowing" onClick={() => { setMobileMenuOpen(false); onConnect(); }}>
                  Connect Repo <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero" style={{ paddingTop: '5rem' }}>
        <div className="badge">
          <div className="badge-dot"></div>
          <span>Local & Privacy First</span>
        </div>
        
        <h1>
          Transform Your GitHub Repositories into <span className="text-gradient-hero">Lightning-Fast CDNs</span>
        </h1>
        
        <p>
          AstroBucket is an open-source, serverless S3-style explorer that uses your GitHub repositories as CDN-backed storage. Upload, organize, and copy static asset links instantly with zero server configurations.
        </p>
        
        <div className="hero-actions">
          {hasCreds ? (
            <button className="btn btn-primary btn-hero-primary btn-glowing" onClick={onLaunchConsole}>
              Launch Storage Console <ArrowRight size={18} />
            </button>
          ) : (
            <button className="btn btn-primary btn-hero-primary btn-glowing" onClick={onConnect}>
              Connect Repository <ArrowRight size={18} />
            </button>
          )}
          <a 
            href="https://github.com/Priyanshu0007" 
            target="_blank" 
            rel="noreferrer" 
            className="btn-hero-secondary"
          >
            <Github size={18} /> Follow on GitHub <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* Features Grid Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <div className="badge" style={{ marginBottom: '1rem' }}>
            <Sparkles size={14} />
            <span>Robust Tech Stack</span>
          </div>
          <h2>Designed for Speed & Security</h2>
          <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto' }}>
            Enjoy the performance of specialized cloud buckets with the cost-efficiency of git repository file storage.
          </p>
        </div>

        <div className="feature-grid-v2">
          <div className="feature-card-v2">
            <div className="feature-icon-box">
              <Shield size={24} />
            </div>
            <h3>On-Device Privacy</h3>
            <p>
              Your credentials and personal access tokens never leave your browser. AstroBucket acts 100% client-side, making direct secure calls to GitHub APIs.
            </p>
          </div>

          <div className="feature-card-v2">
            <div className="feature-icon-box">
              <Zap size={24} />
            </div>
            <h3>Instant Global CDN</h3>
            <p>
              Uploaded assets are immediately served using jsDelivr edge networks. Benefit from automated CDN caching, file minification, and gzip compression.
            </p>
          </div>

          <div className="feature-card-v2">
            <div className="feature-icon-box">
              <Terminal size={24} />
            </div>
            <h3>S3-Style Console</h3>
            <p>
              Create subdirectories, preview assets, delete files, and drag-and-drop uploads inside an intuitive visual workspace mimicking AWS S3.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Mockup Preview */}
      <section id="demo" className="demo-section">
        <div className="section-header">
          <h2>Interactive CDN Copying</h2>
          <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto' }}>
            Click on the simulated files below to see how AstroBucket converts uploaded files into globally accessible jsDelivr CDN links.
          </p>
        </div>

        <div className="demo-window">
          <div className="demo-header">
            <div className="demo-dots">
              <div className="demo-dot red"></div>
              <div className="demo-dot yellow"></div>
              <div className="demo-dot green"></div>
            </div>
            <div className="demo-title">astrobucket-cdn-simulation</div>
            <div style={{ width: '42px' }}></div>
          </div>

          <div className="demo-body">
            <div className="demo-files">
              {mockFiles.map((file) => (
                <div 
                  key={file.name}
                  className={`demo-file-card ${activeMockFile.name === file.name ? 'active' : ''}`}
                  onClick={() => setActiveMockFile(file)}
                >
                  <div className="demo-file-meta">
                    {file.type === 'image' ? <ImageIcon size={20} style={{ color: '#3b82f6' }} /> : <FileText size={20} style={{ color: '#a855f7' }} />}
                    <span>{file.name}</span>
                  </div>
                  <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{file.size}</span>
                </div>
              ))}
            </div>

            <div className="demo-copy-area">
              <div className="demo-code">
                {getMockCdnUrl(activeMockFile.path)}
              </div>
              <button 
                className="btn btn-outline" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => handleCopyMockCdn(activeMockFile.path, 1)}
              >
                {copiedIndex === 1 ? (
                  <>
                    <Check size={14} style={{ color: '#10b981' }} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Steps Section */}
      <section id="steps" className="how-it-works">
        <div className="section-header">
          <h2>Three Steps to Deploy</h2>
          <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto' }}>
            Connecting your repository is extremely simple and requires no specialized server setup.
          </p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Generate GitHub PAT</h3>
            <p>Create a classic personal access token on your GitHub account with read/write access to repository contents.</p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Provide Repository Path</h3>
            <p>Connect using your GitHub user profile, targeted repository name, and repository branch in the connection form.</p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Upload & Distribute</h3>
            <p>Drag and drop images, stylesheets, or scripts to start copying globally distributed edge-cached CDN urls.</p>
          </div>
        </div>
      </section>

      {/* Accordion FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="section-header">
          <div className="badge" style={{ marginBottom: '1rem' }}>
            <span>FAQ</span>
          </div>
          <h2>Frequently Asked Questions</h2>
          <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto' }}>
            Have questions about how it works? We have answers.
          </p>
        </div>

        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className={`faq-item ${openFaq === index ? 'active' : ''}`}
            >
              <button 
                className="faq-question" 
                onClick={() => toggleFaq(index)}
              >
                <span>{faq.q}</span>
                <ChevronDown size={18} className="faq-chevron" />
              </button>
              <div className="faq-answer">
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer & Developer Profile Card */}
      <footer id="developer" className="landing-footer">
        <div className="footer-content">
          <div className="developer-card">
            <div className="developer-avatar">
              <User size={40} />
            </div>
            <div className="developer-details">
              <h4>Priyanshu Gupta</h4>
              <div className="developer-title">Frontend Engineer & Architect</div>
              <p className="developer-bio">
                Passionate developer focused on building secure, fluid, and hardware-accelerated user interfaces. Creator of AstroBucket.
              </p>
              <div className="developer-links">
                <a 
                  href="https://github.com/Priyanshu0007" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="developer-btn primary"
                >
                  <Github size={14} /> GitHub
                </a>
                <a 
                  href="https://priyanshu0007.vercel.app" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="developer-btn secondary"
                >
                  <Sparkles size={14} /> Portfolio
                </a>
                <a 
                  href="mailto:priyanshu0007@vercel.app" 
                  className="developer-btn primary"
                >
                  <Mail size={14} /> Contact
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <div>&copy; {new Date().getFullYear()} AstroBucket. Released under the MIT License.</div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <a href="https://github.com/Priyanshu0007" target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://priyanshu0007.vercel.app" target="_blank" rel="noreferrer">Portfolio</a>
              <a href="mailto:priyanshu0007@vercel.app">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
