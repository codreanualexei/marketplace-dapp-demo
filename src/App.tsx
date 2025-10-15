import React, { useState } from 'react';
import { WalletProvider } from './contexts/WalletContext';
import Header from './Components/Header';
import NetworkChecker from './Components/NetworkChecker';
import Home from './Pages/Home';
import Marketplace from './Pages/Marketplace';
import MyDomains from './Pages/MyDomains';
import MyListings from './Pages/MyListings';
import Royalties from './Pages/Royalties';
import Mint from './Pages/Mint';
import Debug from './Pages/Debug';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={setCurrentPage} />;
      case 'marketplace':
        return <Marketplace />;
      case 'my-domains':
        return <MyDomains />;
      case 'my-listings':
        return <MyListings />;
      case 'royalties':
        return <Royalties />;
      case 'mint':
        return <Mint />;
      case 'debug':
        return <Debug />;
      default:
        return <Home onNavigate={setCurrentPage} />;
    }
  };

  return (
    <WalletProvider>
      <div className="App">
        <Header currentPage={currentPage} onNavigate={setCurrentPage} />
        <NetworkChecker />
        {renderPage()}
      </div>
    </WalletProvider>
  );
}

export default App;
