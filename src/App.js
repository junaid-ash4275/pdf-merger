import React from 'react';
import PDFMerger from './components/PDFMerger';
import './App.css';
import { motion } from 'framer-motion';

function App() {
  return (
    <div className="App">
      <div className="background-effects">
        <div className="glow-orb glow-orb-1"></div>
        <div className="glow-orb glow-orb-2"></div>
        <div className="glow-orb glow-orb-3"></div>
      </div>
      
      <motion.header 
        className="app-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="app-title">
          <span className="title-icon">📄</span>
          PDF Merger
        </h1>
        <p className="app-subtitle">Combine multiple PDFs into one seamlessly</p>
      </motion.header>

      <motion.main 
        className="app-main"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <PDFMerger />
      </motion.main>

      <motion.footer 
        className="app-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <p>Made with <span className="heart">❤️</span> using React</p>
      </motion.footer>
    </div>
  );
}

export default App;
