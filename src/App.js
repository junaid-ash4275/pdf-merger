import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiChevronRight, FiLayers, FiScissors } from 'react-icons/fi';

import PDFMerger from './components/PDFMerger';
import PDFPageRemover from './components/PDFPageRemover';

function App() {
  const [activeTool, setActiveTool] = useState(null);

  const tools = useMemo(
    () => [
      {
        id: 'merge',
        name: 'Merge PDFs',
        description: 'Combine multiple PDFs into one seamless document.',
        icon: FiLayers,
        accent: 'from-[rgba(255,107,53,0.18)] via-[rgba(255,140,66,0.14)] to-transparent',
        component: <PDFMerger />
      },
      {
        id: 'remove',
        name: 'Remove Pages',
        description: 'Upload a PDF, preview thumbnails, and remove unwanted pages.',
        icon: FiScissors,
        accent: 'from-[rgba(255,107,107,0.18)] via-[rgba(255,140,140,0.14)] to-transparent',
        component: <PDFPageRemover />
      }
    ],
    []
  );

  const activeToolMeta = activeTool ? tools.find((tool) => tool.id === activeTool) : null;

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-[200px] -left-[100px] h-[400px] w-[400px] rounded-full bg-gradient-orange blur-[80px] opacity-30 animate-float"></div>
        <div
          className="absolute -right-[100px] -bottom-[150px] h-[350px] w-[350px] rounded-full bg-gradient-orange-strong blur-[80px] opacity-30 animate-float"
          style={{ animationDelay: '5s' }}
        ></div>
        <div
          className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-orangeLighter/60 blur-[80px] opacity-30 animate-float"
          style={{ animationDelay: '10s' }}
        ></div>
      </div>
      
      <motion.header
        className="relative z-[2] px-4 pb-8 pt-12 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="inline-flex items-center gap-4 text-5xl font-bold text-transparent drop-shadow-title sm:text-4xl bg-gradient-orange-strong bg-clip-text">
          <span className="text-4xl drop-shadow-emoji sm:text-3xl">🧰</span>
          {activeToolMeta ? activeToolMeta.name : 'PDF Toolkit'}
        </h1>
        <p className="mt-2 text-lg font-light text-white/70 sm:text-base">
          {activeToolMeta
            ? activeToolMeta.description
            : 'Select a tool to get started with your PDF workflows'}
        </p>
      </motion.header>

      <motion.main
        className="relative z-[2] flex flex-1 items-start justify-center px-4 pb-16 pt-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {activeToolMeta ? (
          <div className="flex w-full max-w-[960px] flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/15"
                onClick={() => setActiveTool(null)}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition duration-300 group-hover:bg-brand-orange/20 group-hover:text-brand-orange">
                  <FiArrowLeft />
                </span>
                Back to tools
              </button>

              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/70">
                {activeToolMeta.icon && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-brand-orange">
                    <activeToolMeta.icon />
                  </span>
                )}
                <span>{activeToolMeta.name}</span>
              </div>
            </div>

            {activeToolMeta.component}
          </div>
        ) : (
          <div className="grid w-full max-w-[1024px] grid-cols-1 gap-6 md:grid-cols-2">
            {tools.map(({ id, name, description, icon: Icon, accent }) => (
              <motion.button
                key={id}
                type="button"
                className="group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-[rgba(255,107,53,0.2)] bg-white/5 p-8 text-left shadow-merger-card backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-[rgba(255,107,53,0.35)] hover:bg-white/10 hover:shadow-merger-card-strong"
                onClick={() => setActiveTool(id)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-0 transition duration-300 group-hover:opacity-100`}></span>
                <div className="relative z-10 flex flex-1 flex-col gap-6">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl text-brand-orange drop-shadow-icon transition duration-300 group-hover:bg-brand-orange/20 group-hover:text-white">
                    <Icon />
                  </span>
                  <div className="flex flex-1 flex-col gap-3">
                    <h3 className="text-2xl font-semibold text-white/90">{name}</h3>
                    <p className="text-base text-white/60">{description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-orange transition duration-300 group-hover:gap-3 group-hover:text-white">
                    Open tool
                    <FiChevronRight />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </motion.main>

      <motion.footer
        className="relative z-[2] py-8 text-center text-sm text-white/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <p>
          Made with <span className="text-brand-orange animate-heartbeat">❤️</span> using React
        </p>
      </motion.footer>
    </div>
  );
}

export default App;
