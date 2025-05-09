import React, { useState, useEffect, useRef } from 'react';

export default function TextEditor({ socket, initialText = '', setLastUpdated }) {
  const [text, setText] = useState(initialText);
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimeoutRef = useRef(null);
  
  // Initialize with initial text when it becomes available
  useEffect(() => {
    if (initialText !== undefined) {
      setText(initialText);
    }
  }, [initialText]);
  
  // Handle socket events
  useEffect(() => {
    if (!socket) return;
    
    const handleTextUpdate = (newText) => {
      setText(newText);
    };
    
    socket.on('text-update', handleTextUpdate);
    
    return () => {
      socket.off('text-update', handleTextUpdate);
    };
  }, [socket]);
  
  // Handle text changes with debounce
  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set saving indicator
    setIsSaving(true);
    
    // Debounce emit to reduce updates
    debounceTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit('text-update', newText);
        setLastUpdated && setLastUpdated(new Date());
        setIsSaving(false);
      }
    }, 300);
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium text-gray-700">Notes</h2>
        {isSaving && (
          <span className="text-xs text-gray-500">Saving...</span>
        )}
      </div>
      
      <textarea
        value={text}
        onChange={handleTextChange}
        className="flex-1 w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        placeholder="Type your notes here..."
      />
    </div>
  );
}
