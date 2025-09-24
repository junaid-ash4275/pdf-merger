/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FF6B35',
          orangeLight: '#FF8C42',
          orangeLighter: '#FFA500',
          success: '#4CAF50',
          successDark: '#45a049',
          error: '#FF6B6B',
        },
      },
      backgroundImage: {
        'gradient-app': 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%)',
        'gradient-orange': 'linear-gradient(135deg, #FF6B35, #FF8C42)',
        'gradient-orange-strong': 'linear-gradient(135deg, #FF8C42, #FFA500)',
        'gradient-success': 'linear-gradient(135deg, #4CAF50, #45a049)',
      },
      boxShadow: {
        'merger-card': '0 20px 60px rgba(0, 0, 0, 0.3)',
        'merger-card-hover': '0 6px 30px rgba(255, 107, 53, 0.4)',
        action: '0 4px 20px rgba(255, 107, 53, 0.3)',
        'action-hover': '0 6px 30px rgba(255, 107, 53, 0.4)',
        'action-success': '0 4px 20px rgba(76, 175, 80, 0.3)',
        'action-success-hover': '0 6px 30px rgba(76, 175, 80, 0.4)',
        dropzone: '0 0 30px rgba(255, 107, 53, 0.2)',
      },
      dropShadow: {
        icon: '0 0 20px rgba(255, 107, 53, 0.4)',
        title: '0 0 40px rgba(255, 107, 53, 0.3)',
        emoji: '0 0 10px rgba(255, 107, 53, 0.5)',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '0.4' },
        },
        'pulse-ring': {
          '0%, 100%': {
            transform: 'translate(-50%, -50%) scale(1)',
          },
          '50%': {
            transform: 'translate(-50%, -50%) scale(1.1)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(30px, -30px) scale(1.05)' },
          '50%': { transform: 'translate(-20px, 20px) scale(0.95)' },
          '75%': { transform: 'translate(20px, 10px) scale(1.02)' },
        },
        'float-icon': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1s ease-in-out infinite',
        float: 'float 20s ease-in-out infinite',
        'float-icon': 'float-icon 3s ease-in-out infinite',
        heartbeat: 'heartbeat 1.5s ease-in-out infinite',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen', 
          'Ubuntu',
          'Cantarell',
          'Fira Sans',
          'Droid Sans',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

