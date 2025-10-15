import React, { useState } from 'react';
import WalletButton from './WalletButton';
import './Header.css';

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (page: string) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo" onClick={() => handleNavClick('home')}>
          <h1>STR Domains</h1>
        </div>
        
        <button 
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        <nav className={`header-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <a 
            className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => handleNavClick('home')}
          >
            Home
          </a>
          <a 
            className={`nav-link ${currentPage === 'marketplace' ? 'active' : ''}`}
            onClick={() => handleNavClick('marketplace')}
          >
            Marketplace
          </a>
          <a 
            className={`nav-link ${currentPage === 'my-domains' ? 'active' : ''}`}
            onClick={() => handleNavClick('my-domains')}
          >
            My Domains
          </a>
          <a 
            className={`nav-link ${currentPage === 'my-listings' ? 'active' : ''}`}
            onClick={() => handleNavClick('my-listings')}
          >
            My Listings
          </a>
          <a 
            className={`nav-link ${currentPage === 'royalties' ? 'active' : ''}`}
            onClick={() => handleNavClick('royalties')}
          >
            Royalties
          </a>
          <a 
            className={`nav-link ${currentPage === 'mint' ? 'active' : ''}`}
            onClick={() => handleNavClick('mint')}
          >
            Mint
          </a>
          <a 
            className={`nav-link ${currentPage === 'debug' ? 'active' : ''}`}
            onClick={() => handleNavClick('debug')}
            style={{ opacity: 0.7 }}
          >
            🔧
          </a>
        </nav>

        <div className="header-actions">
          <WalletButton />
        </div>
      </div>
    </header>
  );
};

export default Header;

