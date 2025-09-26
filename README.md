# MergeMate (MM) Web App

MergeMate (MM) is a modern, minimalistic PDF toolkit built with React. It features a beautiful orange-themed UI with glowing effects and smooth animations.

## ✨ Features

- **Drag & Drop Support**: Simply drag and drop your PDF files onto the MergeMate upload area
- **File Selection**: Click to browse and select PDF files from your computer
- **Reorder PDFs**: Drag to reorder files before merging with MergeMate
- **Beautiful UI**: Modern design with orange gradient theme and glowing effects
- **Responsive**: Works perfectly on desktop and mobile devices
- **Instant Download**: Download your processed PDFs with one click
- **Visual Feedback**: Smooth animations and notifications for all actions

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository or navigate to the project folder

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## 🎨 Design Features

- **Orange Color Scheme**: Beautiful orange gradients (#FF6B35 to #FFA500)
- **Glassmorphism Effects**: Transparent cards with backdrop blur
- **Glowing Orbs**: Animated background effects for visual appeal
- **Smooth Animations**: Powered by Framer Motion
- **Modern Icons**: Clean iconography with React Icons

## 🛠️ Technologies Used

- **React 18**: Modern React with hooks
- **pdf-lib**: For PDF manipulation and merging
- **react-beautiful-dnd**: For drag-and-drop file reordering
- **react-dropzone**: For file upload functionality
- **framer-motion**: For smooth animations
- **react-icons**: For beautiful icons

## 📦 Build for Production

To create a production build:

```bash
npm run build
```

The build folder will contain the optimized production-ready files.

## 🔧 Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Creates a production build
- `npm test` - Runs the test suite
- `npm eject` - Ejects from Create React App (one-way operation)

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🌟 Key Features Implementation

### Drag and Drop
Files can be dragged directly onto the upload area for quick addition.

### File Reordering
Click and drag files in the list to reorder them before merging with MergeMate.

### PDF Merging
All PDFs are merged in the order shown, maintaining their original formatting thanks to MergeMate.

### Download
Processed PDFs are generated client-side and can be downloaded instantly through MergeMate.

## 💡 Tips

- For best results, ensure all PDF files are valid and not corrupted
- Large files may take a moment to process
- The order of files in the list will be the order in the merged PDF

## 📄 License

This project is open source and available under the ISC License.
