import React, { useState } from "react";
import { WalletProvider, useWallet } from "./contexts/WalletContext";
import { ToastProvider } from "./contexts/ToastContext";
import Header from "./Components/Header";
import NetworkChecker from "./Components/NetworkChecker";
import ErrorDisplay from "./Components/ErrorDisplay";
import Home from "./Pages/Home";
import Marketplace from "./Pages/Marketplace";
import MyDomains from "./Pages/MyDomains";
import MyListings from "./Pages/MyListings";
import Royalties from "./Pages/Royalties";
import Mint from "./Pages/Mint";
import Debug from "./Pages/Debug";
import "./App.css";
import "./Components/Alchemy.css";

// Component that displays wallet errors
const AppContent: React.FC<{
  currentPage: string;
  setCurrentPage: (page: string) => void;
}> = ({ currentPage, setCurrentPage }) => {
  const { error, setError } = useWallet();

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home onNavigate={setCurrentPage} />;
      case "marketplace":
        return <Marketplace />;
      case "my-domains":
        return <MyDomains />;
      case "my-listings":
        return <MyListings />;
      case "royalties":
        return <Royalties />;
      case "mint":
        return <Mint />;
      case "debug":
        return <Debug />;
      default:
        return <Home onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="App">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <NetworkChecker />
      

      {renderPage()}
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />
    </div>
  );
};

function AppAlchemy() {
  const [currentPage, setCurrentPage] = useState("home");

  return (
    <WalletProvider>
      <ToastProvider>
        <AppContent 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage}
        />
      </ToastProvider>
    </WalletProvider>
  );
}

export default AppAlchemy;
