import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://127.0.0.1:8000';

function App() {
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creativity, setCreativity] = useState(0.7);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && !image) return;
    if (loading) return;

    // Add user message to chat
    const userMsg = {
      role: 'user',
      text: trimmedInput,
      image: imagePreview,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setInput('');

    try {
      let response;

      if (image) {
        // Use multipart form for image upload
        const formData = new FormData();
        formData.append('message', trimmedInput || 'What can you see in this image?');
        formData.append('creativity', creativity);
        formData.append('session_id', 'default');
        formData.append('image', image);

        response = await axios.post(`${API_URL}/chat-with-image`, formData);
      } else {
        // Use JSON for text-only
        response = await axios.post(`${API_URL}/chat`, {
          message: trimmedInput,
          creativity: creativity,
          session_id: 'default',
        });
      }

      const chefMsg = { role: 'chef', text: response.data.reply };
      setMessages((prev) => [...prev, chefMsg]);
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = {
        role: 'chef',
        text: "Oh no! 😰 I couldn't connect to the kitchen. Make sure the backend server and Ollama are running!",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setImage(null);
      setImagePreview(null);
    }
  };

  const resetConversation = async () => {
    try {
      await axios.post(`${API_URL}/reset?session_id=default`);
    } catch (e) {
      // Ignore reset errors
    }
    setMessages([]);
    setInput('');
    setImage(null);
    setImagePreview(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getCreativityLabel = () => {
    if (creativity <= 0.3) return '🔒 Classic';
    if (creativity <= 0.6) return '⚖️ Balanced';
    return '🎨 Creative';
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <span className="header-emoji">👩‍🍳</span>
        <h1>Chef Alaa's Kitchen</h1>
        <p>Your AI-powered culinary assistant ✨</p>
      </div>

      {/* Chat Container */}
      <div className="chat-container">
        {/* Messages */}
        <div className="messages-area">
          {messages.length === 0 && (
            <div className="welcome-message">
              <span className="welcome-icon">🍰</span>
              <h3>Welcome to Chef Alaa's Kitchen!</h3>
              <p>
                Tell me what ingredients you have, and I'll guide you step-by-step
                to create a delicious meal! 🍳✨
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message-row ${msg.role}`}>
              {msg.role === 'chef' && (
                <div className="message-avatar">👩‍🍳</div>
              )}
              <div className="message-bubble">
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="uploaded"
                    className="message-image"
                  />
                )}
                {msg.text && (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="message-avatar">💖</div>
              )}
            </div>
          ))}

          {loading && (
            <div className="loading-dots">
              <div className="message-avatar">👩‍🍳</div>
              <div className="dots-container">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Controls Bar */}
        <div className="controls-bar">
          <div className="creativity-control">
            <span className="creativity-label">
              {getCreativityLabel()}
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={creativity}
              onChange={(e) => setCreativity(parseFloat(e.target.value))}
              className="creativity-slider"
            />
            <span className="creativity-value">{creativity.toFixed(1)}</span>
          </div>
          <button className="reset-btn" onClick={resetConversation}>
            🔄 New Chat
          </button>
        </div>

        {/* Image Preview */}
        {imagePreview && (
          <div className="image-preview">
            <img src={imagePreview} alt="preview" />
            <button className="remove-image" onClick={removeImage}>
              ✕
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="text-input"
              placeholder="Tell Chef Alaa what's in your fridge... 🥕"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <div className="input-actions">
              <div className="upload-btn" title="Upload food image">
                📷
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </div>
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={loading || (!input.trim() && !image)}
                title="Send message"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;