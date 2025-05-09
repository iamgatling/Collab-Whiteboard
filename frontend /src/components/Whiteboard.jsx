import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';

export default function Whiteboard({ socket, initialCanvasData, setLastUpdated }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const ignoreNextUpdateRef = useRef(false);
  
  // Initialize canvas
  useEffect(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: 800,
      height: 600
    });
    
    fabricRef.current = canvas;
    
    // Set up default brush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = brushSize;
    
    // Handle resize
    const handleResize = () => {
      const container = canvas.getElement().parentElement;
      const width = container.clientWidth;
      const height = Math.min(window.innerHeight - 200, 600);
      
      canvas.setDimensions({ width, height });
      canvas.renderAll();
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);
  
  // Set up tool and brush properties
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
  
  // Handle socket events
  useEffect(() => {
    if (!socket || !fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    // Update local canvas when receiving drawing from server
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
      canvas.renderAll();
      ignoreNextUpdateRef.current = false;
    };
    
    // Load initial canvas data
    if (initialCanvasData) {
      canvas.loadFromJSON(initialCanvasData, canvas.renderAll.bind(canvas));
    }
    
    // Set up socket event listeners
    socket.on('drawing', handleReceivedDrawing);
    socket.on('clear-canvas', handleClearCanvas);
    
    // Set up canvas event for sending updates
    const handleCanvasModified = () => {
      if (ignoreNextUpdateRef.current) return;
      
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
    socket.emit('clear-canvas');
    setLastUpdated && setLastUpdated(new Date());
  };
  
  const handleToolChange = (newTool) => {
    setTool(newTool);
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
      {/* Toolbar */}
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
        
        <div className="w-px h-6 bg-gray-200 mx-2"></div>
        
        <div className="flex items-center space-x-2">
          <label htmlFor="colorPicker" className="text-sm text-gray-600">Color:</label>
          <input
            id="colorPicker"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <label htmlFor="brushSize" className="text-sm text-gray-600">Size:</label>
          <input
            id="brushSize"
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-gray-600">{brushSize}px</span>
        </div>
        
        <div className="ml-auto">
          <button
            onClick={handleDownload}
            className="bg-blue-600 text-white py-1 px-3 text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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