
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';

export default function Whiteboard({ socket, initialCanvasData, setLastUpdated }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success', 'error', or null
  const ignoreNextUpdateRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const modifiedSinceLastSaveRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);
  
  // Auto-save interval
  const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
  
  useEffect(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: 800,
      height: 600,
      backgroundColor: '#ffffff'
    });
    
    fabricRef.current = canvas;
    
    // default brush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = brushSize;
    
    const handleResize = () => {
      const container = canvas.getElement().parentElement;
      
      if (!container) return;
      
      const width = container.clientWidth;
      
      const isMobile = window.innerWidth < 768;
      const height = isMobile 
        ? Math.min(window.innerHeight - 150, 500) 
        : Math.min(window.innerHeight - 200, 600);
      
      canvas.setDimensions({ width, height });
      canvas.renderAll();
    };
    
    window.addEventListener('resize', handleResize);
    
    setTimeout(handleResize, 100); 
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(autoSaveTimerRef.current);
      canvas.dispose();
    };
  }, []);

  // Mobile touch event handling
  useEffect(() => {
    if (!fabricRef.current) return;

    const handleTouchStart = () => {
      // Prevent scrolling on mobile
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    };

    const handleTouchEnd = () => {
      // Re-enable scrolling
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };

    const canvas = fabricRef.current.getElement();
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
  
  // brush properties
  useEffect(() => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    canvas.isDrawingMode = tool === 'pencil' || tool === 'eraser';
    
    if (tool === 'pencil') {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
    } else if (tool === 'eraser') {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = '#ffffff';
    }
    
    canvas.freeDrawingBrush.width = brushSize;
  }, [tool, color, brushSize]);
  
  // auto-save
  const performAutoSave = useCallback(() => {
    if (!socket || !fabricRef.current) return;
    
    
    if (!modifiedSinceLastSaveRef.current && initialLoadCompleteRef.current) {
      return;
    }
    
    try {
      const canvas = fabricRef.current;
      const jsonData = canvas.toJSON();
      
      setIsSaving(true);
      
      
      socket.emit('periodic-save', { 
        canvasData: jsonData,
        textData: document.querySelector('textarea')?.value || '' // Get text from textarea
      });
      
      modifiedSinceLastSaveRef.current = false;
    } catch (err) {
      console.error('Auto-save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }, [socket]);
  
  // auto-save timer
  useEffect(() => {
    if (!socket) return;
    
    // remove existing timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    
  
    autoSaveTimerRef.current = setInterval(performAutoSave, AUTO_SAVE_INTERVAL);
    
  
    const handleSaveConfirmed = ({ timestamp }) => {
      setIsSaving(false);
      setSaveStatus('success');
      setLastUpdated && setLastUpdated(new Date(timestamp));
      setTimeout(() => setSaveStatus(null), 3000);
    };
    
    const handleSaveFailed = () => {
      setIsSaving(false);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    };
    
    socket.on('save-confirmed', handleSaveConfirmed);
    socket.on('save-failed', handleSaveFailed);
    
    return () => {
      clearInterval(autoSaveTimerRef.current);
      socket.off('save-confirmed', handleSaveConfirmed);
      socket.off('save-failed', handleSaveFailed);
    };
  }, [socket, performAutoSave, setLastUpdated]);
  
  
  useEffect(() => {
    if (!socket || !fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    
    const handleReceivedDrawing = (canvasData) => {
      ignoreNextUpdateRef.current = true;
      canvas.loadFromJSON(canvasData, () => {
        canvas.renderAll();
        ignoreNextUpdateRef.current = false;
      });
    };
    
    // Clear canvas
    const handleClearCanvas = () => {
      ignoreNextUpdateRef.current = true;
      canvas.clear();
      canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
      canvas.renderAll();
      ignoreNextUpdateRef.current = false;
    };
    
    // Load canvas data
    if (initialCanvasData) {
      ignoreNextUpdateRef.current = true;
      canvas.loadFromJSON(initialCanvasData, () => {
        canvas.renderAll();
        ignoreNextUpdateRef.current = false;
        initialLoadCompleteRef.current = true;
      });
    } else {
      
      canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
      initialLoadCompleteRef.current = true;
    }
    
    
    socket.on('drawing', handleReceivedDrawing);
    socket.on('clear-canvas', handleClearCanvas);
    
    // sending updates for canvas
    const handleCanvasModified = () => {
      if (ignoreNextUpdateRef.current) return;
      
      modifiedSinceLastSaveRef.current = true;
      const jsonData = canvas.toJSON();
      socket.emit('drawing', jsonData);
      setLastUpdated && setLastUpdated(new Date());
    };
    
    canvas.on('path:created', handleCanvasModified);
    canvas.on('object:modified', handleCanvasModified);
    
    return () => {
      socket.off('drawing', handleReceivedDrawing);
      socket.off('clear-canvas', handleClearCanvas);
      canvas.off('path:created', handleCanvasModified);
      canvas.off('object:modified', handleCanvasModified);
    };
  }, [socket, initialCanvasData, setLastUpdated]);
  
  const handleClearCanvas = () => {
    if (!socket || !fabricRef.current) return;
    
    const canvas = fabricRef.current;
    canvas.clear();
    canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
    modifiedSinceLastSaveRef.current = true;
    socket.emit('clear-canvas');
    setLastUpdated && setLastUpdated(new Date());
  };
  
  const handleToolChange = (newTool) => {
    setTool(newTool);
  };
  
  const handleSaveNow = () => {
    performAutoSave();
  };
  
  const handleDownload = () => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1.0
    });
    
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-lg shadow-sm">
        <div className="flex space-x-1">
          <button 
            className={`tool-btn ${tool === 'pencil' ? 'active' : ''}`}
            onClick={() => handleToolChange('pencil')}
            title="Pencil"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-10 10a2 2 0 01-1.414.586H4a1 1 0 01-1-1v-1a2 2 0 01.586-1.414l10-10z" />
            </svg>
          </button>
          
          <button 
            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => handleToolChange('eraser')}
            title="Eraser"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.086 2.207a2 2 0 012.828 0l3.879 3.879a2 2 0 010 2.828l-5.5 5.5A2 2 0 017.879 15H5.12a2 2 0 01-1.414-.586l-2.5-2.5a2 2 0 010-2.828l6.879-6.879zm.66 11.34L3.453 8.254 1.914 9.793a1 1 0 000 1.414l2.5 2.5a1 1 0 00.707.293H7.88a1 1 0 00.707-.293l.16-.16z" clipRule="evenodd" />
            </svg>
          </button>
          
          <button 
            className={`tool-btn`}
            onClick={handleClearCanvas}
            title="Clear Canvas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="w-px h-6 bg-gray-200 mx-2 hidden sm:block"></div>
        
        <div className="flex items-center space-x-2">
          <label htmlFor="colorPicker" className="text-sm text-gray-600 hidden xs:inline">Color:</label>
          <input
            id="colorPicker"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <label htmlFor="brushSize" className="text-sm text-gray-600 hidden xs:inline">Size:</label>
          <input
            id="brushSize"
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-16 sm:w-24"
          />
          <span className="text-sm text-gray-600 hidden sm:inline">{brushSize}px</span>
        </div>
        
        <div className="ml-auto flex space-x-2">
          <button
            onClick={handleSaveNow}
            className={`py-1 px-2 sm:px-3 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center space-x-1
              ${isSaving ? 'bg-gray-300 text-gray-600' : 'bg-green-600 text-white hover:bg-green-700'}
              ${saveStatus === 'success' ? 'bg-green-500' : ''}
              ${saveStatus === 'error' ? 'bg-red-500' : ''}
            `}
            disabled={isSaving}
            title="Save Now"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="hidden sm:inline">Saving</span>
              </>
            ) : saveStatus === 'success' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Saved</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Failed</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h1a2 2 0 012 2v7a2 2 0 01-2 2H8a2 2 0 01-2-2v-7a2 2 0 012-2h1v5.586l-1.293-1.293zM13 6a1 1 0 10-2 0v.586l1-1V6z" />
                </svg>
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="bg-blue-600 text-white py-1 px-2 sm:px-3 text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            title="Download as PNG"
          >
            Export
          </button>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="canvas-container">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}
